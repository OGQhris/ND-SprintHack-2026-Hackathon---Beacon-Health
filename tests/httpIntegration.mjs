// Exercises the installed OpenAI SDK, Next.js route, SSE wire protocol, and browser UI
// against an explicit local Responses API fixture. This is NOT a live model test.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { chromium } from "playwright";
import assert from "node:assert/strict";
const temp = await mkdtemp(join(tmpdir(), "beacon-http-"));
const dbPath = join(temp, "integration.db");
const sql = new DatabaseSync(dbPath);
const folder = (await readdir("prisma/migrations")).find((n) =>
  n.endsWith("_init"),
);
sql.exec(await readFile(`prisma/migrations/${folder}/migration.sql`, "utf8"));
sql
  .prepare(
    `INSERT INTO Employee (id,sourceSheet,sourceRow,firstName,lastName,manager,licenseNumber,credentialStatus,expirationDate,verificationState,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  )
  .run(
    "fixture-rn",
    "RNS",
    2,
    "Kathryn",
    "Cell",
    "Kimblery Gjeltema",
    "fixture-4704",
    "Active",
    "2028-03-04",
    "VERIFIED",
    new Date().toISOString(),
  );
sql.close();
let requests = 0,
  sawFollowup = false;
const fixture = createServer(async (req, res) => {
  try {
    assert.equal(req.url, "/v1/responses");
    let raw = "";
    for await (const c of req) raw += c;
    const body = JSON.parse(raw);
    requests++;
    const user = body.input.filter((i) => i.role === "user").at(-1)?.content;
    if (user === "When does she expire?") {
      assert.ok(
        body.input.some(
          (i) => i.role === "assistant" && i.content.includes("Kathryn"),
        ),
      );
      sawFollowup = true;
    }
    const outputs = body.input.filter((i) => i.type === "function_call_output");
    const responseId = `resp_fixture_${requests}`;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    });
    const send = (event) =>
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    if (!outputs.length) {
      const call = {
        type: "function_call",
        id: `fc_${requests}`,
        call_id: `call_${requests}`,
        name: "get_employee_by_name",
        arguments: JSON.stringify({ firstName: "Kathryn", lastName: "Cell" }),
        status: "completed",
      };
      send({
        type: "response.completed",
        sequence_number: 0,
        response: {
          id: responseId,
          object: "response",
          status: "completed",
          output: [call],
          model: body.model,
        },
      });
    } else {
      const employee = JSON.parse(outputs.at(-1).output).employee;
      assert.equal(employee.licenseNumber, "fixture-4704");
      const chunks = [
        "Kathryn Cell’s ",
        "Registered Nurse license ",
        "expires on **March 4, 2028**.",
      ];
      for (let i = 0; i < chunks.length; i++) {
        send({
          type: "response.output_text.delta",
          delta: chunks[i],
          item_id: "msg",
          output_index: 0,
          content_index: 0,
          sequence_number: i,
          logprobs: [],
        });
        await new Promise((r) => setTimeout(r, 75));
      }
      send({
        type: "response.completed",
        sequence_number: 4,
        response: {
          id: responseId,
          object: "response",
          status: "completed",
          output: [],
          model: body.model,
        },
      });
    }
    res.end();
  } catch (error) {
    console.error("[Fixture]", error);
    res.writeHead(500);
    res.end();
  }
});
fixture.listen(0, "127.0.0.1");
await once(fixture, "listening");
const fixturePort = fixture.address().port;
const port = 3107;
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    env: {
      ...process.env,
      OPENAI_API_KEY: "local-test-fixture-key",
      OPENAI_BASE_URL: `http://127.0.0.1:${fixturePort}/v1`,
      DATABASE_URL: `file:${dbPath}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
child.stdout.on("data", (data) => (logs += data));
child.stderr.on("data", (data) => (logs += data));
let browser;
try {
  const base = `http://127.0.0.1:${port}`;
  for (let tries = 0; tries < 80; tries++) {
    try {
      if ((await fetch(`${base}/api/dashboard`)).ok) break;
    } catch {}
    if (tries === 79) throw new Error(`Test server did not start: ${logs}`);
    await new Promise((r) => setTimeout(r, 100));
  }
  const session = await fetch(`${base}/api/chat/session`);
  const cookie = session.headers.get("set-cookie").split(";")[0];
  assert.equal((await session.json()).configured, true);
  const ask = async (message) => {
    const r = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    assert.equal(r.status, 200);
    assert.ok(r.headers.get("content-type").includes("text/event-stream"));
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "",
      text = "",
      chunks = 0,
      tools = 0,
      completed = false;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      buffer += decoder.decode(part.value, { stream: true });
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (!frame.startsWith("data: ")) continue;
        const e = JSON.parse(frame.slice(6));
        if (e.type === "text_delta") {
          text += e.text;
          chunks++;
        }
        if (e.type === "tool_call_complete") tools++;
        if (e.type === "error") throw new Error(e.message);
        if (e.type === "assistant_complete") completed = true;
      }
    }
    assert.equal(chunks, 3);
    assert.equal(tools, 1);
    assert.equal(completed, true);
    assert.ok(text.includes("March 4, 2028"));
    return text;
  };
  await ask("Tell me about Kathryn Cell.");
  await ask("When does she expire?");
  assert.equal(sawFollowup, true);
  const saved = await fetch(`${base}/api/chat/session`, {
    headers: { cookie },
  });
  assert.equal((await saved.json()).messages.length, 4);
  const reset = await fetch(`${base}/api/chat/session`, {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(reset.status, 200);
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 980 },
  });
  await page.goto(`${base}/assistant`, { waitUntil: "networkidle" });
  assert.equal(
    await page.getByText("Your assistant is one key away.").count(),
    0,
  );
  await page
    .getByRole("textbox", { name: "Message credential assistant" })
    .fill("Tell me about Kathryn Cell.");
  await page.getByRole("button", { name: "Send message" }).click();
  await page
    .locator(".message-assistant strong")
    .filter({ hasText: "March 4, 2028" })
    .waitFor();
  await page.getByRole("button", { name: "Send message" }).waitFor();
  assert.equal(await page.locator(".tool-activities summary").count(), 1);
  await page.screenshot({
    path: "debug/chat-fixture-stream.png",
    animations: "disabled",
  });
  await page
    .getByRole("textbox", { name: "Message credential assistant" })
    .fill("When does she expire?");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".message-assistant strong").length >= 2,
  );
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator(".message-user").count(), 2);
  console.log(
    "PASS: installed SDK → real Next chat route → approved DB tool → streamed SSE → browser Markdown.",
  );
  console.log(
    "PASS: follow-up context, persisted conversation, new chat, and browser streaming UI.",
  );
  console.log(
    `Local fixture requests: ${requests}. No real OpenAI key or live model used.`,
  );
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  await browser?.close();
  child.kill("SIGTERM");
  await once(child, "exit");
  await new Promise((r) => fixture.close(r));
  await rm(temp, { recursive: true, force: true });
}
