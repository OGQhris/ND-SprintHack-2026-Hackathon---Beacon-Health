import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

test("Start demo seeds four fictional employees and sends a matching notification without modifying the real roster", async () => {
  const temp = await mkdtemp(join(tmpdir(), "beacon-tests-demo-"));
  process.env.DATABASE_URL = `file:${join(temp, "test.db")}`;
  process.env.DEMO_DATA_DIR = temp;
  const sql = new DatabaseSync(join(temp, "test.db"));
  sql.exec(
    await readFile(
      "prisma/migrations/20261003205645_init/migration.sql",
      "utf8",
    ),
  );
  sql.close();
  const { db } = await import("../lib/db");
  const { POST } = await import("../app/api/demo/start/route");
  const { serializeEmployee } = await import("../lib/employees");
  const { todayDate, daysUntilExpiration } = await import("../lib/expiration");
  const originalFetch = globalThis.fetch;
  const request = (origin = "http://localhost:3000") =>
    new Request("http://localhost:3000/api/demo/start", {
      method: "POST",
      headers: { origin },
    });
  try {
    await db.employee.create({
      data: {
        id: "jenna",
        firstName: "Jenna",
        lastName: "Norman",
        sourceRow: 13,
        sourceSheet: "RNS",
        manager: "Demo Manager",
        expirationDate: "2028-05-01",
      },
    });
    assert.equal((await POST(request("https://other.example"))).status, 403);
    delete process.env.RESEND_API_KEY;
    assert.equal((await POST(request())).status, 503);
    process.env.RESEND_API_KEY = "fixture-key";
    process.env.RESEND_TEST_EMAIL_TO = "owner@example.com";
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, "https://api.resend.com/emails");
      const body = JSON.parse(options?.body as string);
      assert.deepEqual(body.to, ["owner@example.com"]);
      assert.equal(body.from, "Beacon Demo <onboarding@resend.dev>");
      assert.equal(body.subject, "Jamie Morgan expires in 30 days!");
      assert.match(body.text, /fictional/);
      assert.match(body.text, /fictional/);
      assert.ok(options?.signal);
      return Response.json({ id: "fixture-email" });
    };
    const response = await POST(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).emailId, "fixture-email");
    assert.equal(calls, 1);
    const source = await db.employee.findUniqueOrThrow({
      where: { id: "jenna" },
    });
    assert.equal(source.expirationDate, "2028-05-01");
    const samples = await db.employee.findMany({
      where: { sourceSheet: "Sample employees" },
      orderBy: { sourceRow: "asc" },
    });
    assert.equal(samples.length, 4);
    assert.deepEqual(
      samples.map((e) => daysUntilExpiration(e.expirationDate, todayDate())),
      [30, 14, 17, -3],
    );
    for (const sample of samples) {
      assert.equal(serializeEmployee(sample).isSample, true);
      assert.equal(serializeEmployee(sample).demoExpiration, false);
    }
    assert.equal(serializeEmployee(source).expirationDate, "2028-05-01");
    globalThis.fetch = async () => Response.json({}, { status: 403 });
    const rejected = await POST(request());
    assert.equal(rejected.status, 502);
    const failed = await rejected.json();
    assert.equal(failed.samplesAdded, true);
    assert.equal(
      await db.employee.count({ where: { sourceSheet: "Sample employees" } }),
      4,
    );
    assert.match(failed.error, /account address/);
  } finally {
    globalThis.fetch = originalFetch;
    await db.$disconnect();
    await rm(temp, { recursive: true, force: true });
  }
});
