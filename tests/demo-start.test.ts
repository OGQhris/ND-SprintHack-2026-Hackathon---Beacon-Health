import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

test("Start demo waits 30 seconds before sending and preserves the real roster", async (t) => {
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
  sql.exec(
    await readFile(
      "prisma/migrations/20261004030000_alert_actions/migration.sql",
      "utf8",
    ),
  );
  sql.exec(
    await readFile(
      "prisma/migrations/20261004040000_demo_expirations/migration.sql",
      "utf8",
    ),
  );
  sql.close();
  const { db } = await import("../lib/db");
  const { POST } = await import("../app/api/demo/start/route");
  const { serializeEmployee } = await import("../lib/employees");
  const { todayDate, daysUntilExpiration } = await import("../lib/expiration");
  const { toSeedEmployee, toSeedCredential } =
    await import("../lib/data/beacon-adapter");
  const { persistVerification } = await import("../services/credentialService");
  const originalFetch = globalThis.fetch;
  const originalTimeout = globalThis.setTimeout;
  let releaseDelay: () => void = () => {};
  let delayObserved: () => void = () => {};
  const waiting = new Promise<void>((resolve) => {
    delayObserved = resolve;
  });
  let autoAdvance = false;
  t.mock.method(
    globalThis,
    "setTimeout",
    (callback: () => void, delay: number, ...args: unknown[]) => {
      if (delay > 20_000 && delay <= 30_000) {
        assert.ok(
          delay > 29_000,
          "send is scheduled about 30 seconds after the click",
        );
        releaseDelay = callback;
        delayObserved();
        if (autoAdvance) queueMicrotask(callback);
        return {};
      }
      return originalTimeout(callback, delay, ...args);
    },
  );
  const request = (origin = "http://localhost:3000") =>
    new Request("http://localhost:3000/api/demo/start", {
      method: "POST",
      headers: { origin },
    });
  await db.employee.createMany({
    data: [
      {
        id: "kathryn",
        firstName: "Kathryn",
        lastName: "Cell",
        sourceRow: 2,
        sourceSheet: "RNS",
        manager: "Demo Manager",
        expirationDate: "2028-03-04",
        verificationState: "VERIFIED",
      },
      {
        id: "alexandria",
        firstName: "Alexandria",
        lastName: "Truax",
        sourceRow: 3,
        sourceSheet: "RNS",
        manager: "Demo Manager",
        expirationDate: "2028-02-13",
        verificationState: "VERIFIED",
      },
    ],
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
    const withoutEmail = await POST(request());
    assert.equal(withoutEmail.status, 200);
    assert.equal((await withoutEmail.json()).emailSkipped, true);
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
    const pending = POST(request());
    await waiting;
    assert.equal(calls, 0, "email is not sent during the delay");
    assert.equal(
      (await POST(request())).status,
      409,
      "duplicate clicks cannot send another email during the delay",
    );
    releaseDelay();
    const response = await pending;
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
    assert.equal(samples.length, 8);
    assert.deepEqual(
      samples.map((e) => daysUntilExpiration(e.expirationDate, todayDate())),
      [30, 14, 7, -3, 30, 14, 30, 14],
    );
    for (const sample of samples) {
      assert.equal(serializeEmployee(sample).isSample, true);
      assert.equal(serializeEmployee(sample).demoExpiration, false);
    }
    assert.equal(serializeEmployee(source).expirationDate, "2028-05-01");
    assert.deepEqual(
      samples.slice(4).map((e) => toSeedEmployee(serializeEmployee(e)).group),
      ["US_TECHS", "US_TECHS", "RAD_TECHS", "RAD_TECHS"],
    );
    assert.deepEqual(
      samples
        .slice(4)
        .map((e) => toSeedCredential(serializeEmployee(e)).source),
      ["ARDMS", "ARDMS", "ARRT", "ARRT"],
    );
    for (const [id, days, actual] of [
      ["kathryn", 5, "2028-03-04"],
      ["alexandria", 6, "2028-02-13"],
    ] as const) {
      const demo = serializeEmployee(
        await db.employee.findUniqueOrThrow({ where: { id } }),
      );
      assert.equal(demo.daysUntilExpiration, days);
      assert.equal(demo.demoExpiration, true);
      assert.equal(demo.sourceExpirationDate, actual);
      const result = {
        state: "ERROR" as const,
        source: "Michigan MILARA" as const,
        sourceUrl: "https://example.com",
        checkedAt: new Date().toISOString(),
        credential: null,
        candidates: [],
        rawFields: null,
        error: "Site unavailable",
      };
      await persistVerification(id, result);
      assert.equal(
        serializeEmployee(
          await db.employee.findUniqueOrThrow({ where: { id } }),
        ).demoExpiration,
        true,
      );
      await persistVerification(id, {
        ...result,
        state: "VERIFIED",
        error: null,
        credential: {
          employeeName: demo.firstName + " " + demo.lastName,
          credentialType: "Registered Nurse",
          licenseNumber: "fixture-license",
          status: "Active",
          issueDate: null,
          expirationDate: actual,
          county: null,
          sourceUrl: "https://example.com",
        },
      });
      const verified = serializeEmployee(
        await db.employee.findUniqueOrThrow({ where: { id } }),
      );
      assert.equal(verified.expirationDate, actual);
      assert.equal(verified.demoExpiration, false);
    }
    globalThis.fetch = async () => Response.json({}, { status: 403 });
    autoAdvance = true;
    const rejected = await POST(request());
    assert.equal(rejected.status, 502);
    const failed = await rejected.json();
    assert.equal(failed.samplesAdded, true);
    assert.equal(
      await db.employee.count({ where: { sourceSheet: "Sample employees" } }),
      8,
    );
    assert.equal(
      serializeEmployee(
        await db.employee.findUniqueOrThrow({ where: { id: "kathryn" } }),
      ).daysUntilExpiration,
      5,
    );
    assert.equal(
      serializeEmployee(
        await db.employee.findUniqueOrThrow({ where: { id: "alexandria" } }),
      ).daysUntilExpiration,
      6,
    );
    assert.match(failed.error, /account address/);
  } finally {
    globalThis.fetch = originalFetch;
    await db.$disconnect();
    await rm(temp, { recursive: true, force: true });
  }
});
