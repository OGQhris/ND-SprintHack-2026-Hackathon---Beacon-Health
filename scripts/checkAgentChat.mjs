import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { chromium } from "playwright";

// Real browser + streamed SSE fixture. No model request or license lookup is sent.
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const runId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
let employee;
let startedAt;
const fixture = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, accept");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const request = JSON.parse(Buffer.concat(chunks).toString());
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });
  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  if (request.question === "Stream scroll fixture") {
    for (let index = 0; index < 60; index++) {
      send({ type: "text_delta", text: `Streaming line ${index}: ${"Words fill this reply. ".repeat(8)}\n\n` });
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    send({ type: "assistant_complete" });
    res.end();
    return;
  }
  for (let index = 0; index < 3; index++) {
    send({
      type: "tool_call_start",
      name: "get_employee_by_name",
      callId: `lookup-${index}`,
      label: "Finding employee",
    });
    send({
      type: "tool_call_complete",
      name: "get_employee_by_name",
      callId: `lookup-${index}`,
      ok: true,
    });
  }
  startedAt = new Date().toISOString();
  send({
    type: "tool_call_start",
    name: "verify_employee_credential",
    callId: "verify",
    label: "Verifying credential with Michigan MILARA",
    employeeId: employee.id,
    startedAt,
  });
  await new Promise((resolve) => setTimeout(resolve, 600));
  send({
    type: "tool_call_complete",
    name: "verify_employee_credential",
    callId: "verify",
    ok: true,
    recordingId: runId,
  });
  send({
    type: "text_delta",
    text: "The fixture credential check is complete.",
  });
  send({ type: "assistant_complete" });
  res.end();
});
fixture.listen(0, "127.0.0.1");
await once(fixture, "listening");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(`${base}/ask`, { waitUntil: "networkidle" });
  const workspace = await (
    await page.request.get(`${base}/api/workspace`)
  ).json();
  employee = workspace.seed.employees.find((e) => !e.isSample);
  const run = () => ({
    id: runId,
    employeeId: employee.id,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    startedAt,
    finishedAt: new Date().toISOString(),
    state: "VERIFIED",
    steps: [
      {
        index: 0,
        kind: "type",
        label: "Typing the employee name",
        timestamp: startedAt,
        frameUrl: "/fixture-browser.svg",
        target: { x: 0.25, y: 0.25, width: 0.3, height: 0.05 },
      },
      {
        index: 1,
        kind: "click",
        label: "Clicking Search",
        timestamp: startedAt,
        frameUrl: "/fixture-browser.svg",
        target: { x: 0.7, y: 0.6, width: 0.1, height: 0.05 },
      },
      { index: 2, kind: "read", label: "Reading source results", timestamp: startedAt, frameUrl: "/fixture-browser.svg" },
      { index: 3, kind: "click", label: "Opening credential details", timestamp: startedAt, frameUrl: "/fixture-browser.svg", target: { x: 0.3, y: 0.4, width: 0.2, height: 0.05 } },
      { index: 4, kind: "result", label: "Verification animation complete", timestamp: startedAt, frameUrl: "/fixture-browser.svg" },
    ],
  });
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 307,
      headers: { location: `http://127.0.0.1:${fixture.address().port}/ask` },
    }),
  );
  await page.route("**/api/verification-runs", (route) =>
    route.fulfill({ json: { runs: [run()] } }),
  );
  await page.route(`**/api/verification-runs/${runId}`, (route) =>
    route.fulfill({ json: run() }),
  );
  await page.route("**/fixture-browser.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="625"><rect width="900" height="625" fill="#f8fafc"/><text x="45" y="65" font-size="26">Licensing browser — test fixture</text><rect x="90" y="135" width="400" height="55" fill="white" stroke="#94a3b8"/><text x="100" y="170" font-size="20">Employee name</text><rect x="580" y="340" width="130" height="55" rx="5" fill="#0369a1"/><text x="610" y="375" font-size="20" fill="white">Search</text></svg>',
    }),
  );
  await page
    .getByRole("textbox", { name: "Message Ask Beacon" })
    .fill(`Can you verify ${employee.firstName} ${employee.lastName}?`);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const tools = page.getByRole("region", { name: "Agent tool calls" });
  await tools.locator('[data-tool-state="running"]').waitFor();
  assert.equal(
    await tools.locator("li").count(),
    4,
    "all calls remain expanded",
  );
  const preview = page.getByRole("region", {
    name: `Verification preview for ${employee.firstName} ${employee.lastName}`,
  });
  await preview
    .getByRole("button", { name: "Enlarge verification preview" })
    .waitFor();
  assert.equal(await preview.getByText("Recorded browser steps · Click the preview to enlarge", { exact: true }).count(), 0, "preview footer is removed");
  assert.equal(
    await page.getByRole("dialog").count(),
    0,
    "verification starts inline",
  );
  await preview.getByText("Clicking Search", { exact: true }).waitFor();
  assert.equal(await tools.locator('[data-tool-state="complete"]').count(), 4, "server has already finished responding");
  assert.equal(await page.getByText("The fixture credential check is complete.", { exact: true }).count(), 0, "reply stays hidden while playback is unfinished");
  await page.screenshot({
    path: "/private/tmp/beacon-agent-preview.png",
    fullPage: true,
  });
  await preview
    .getByRole("button", { name: "Enlarge verification preview" })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await preview.getByText("Verification animation complete", { exact: true }).waitFor();
  await page
    .getByText("The fixture credential check is complete.", { exact: true })
    .waitFor();
  assert.equal(await tools.locator('[data-tool-state="complete"]').count(), 4);

  // Simulate growing reply/preview content in the real chat scroll container.
  const scroll = page.locator("[data-chat-scroll]").first();
  await scroll.evaluate((el) => {
    const growth = document.createElement("div");
    growth.id = "scroll-growth-fixture";
    growth.style.height = "1500px";
    el.firstElementChild.append(growth);
    // Browsers can emit a scroll event as growing content changes the layout.
    el.dispatchEvent(new Event("scroll"));
  });
  const atBottom = () => scroll.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop < 2);
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-chat-scroll]");
    return el.scrollHeight - el.clientHeight - el.scrollTop < 2;
  });
  assert.ok(await atBottom(), "growing content follows when already at the bottom");
  for (let index = 0; index < 12; index++) {
    await scroll.evaluate((el) => {
      const growth = document.getElementById("scroll-growth-fixture");
      growth.style.height = `${parseInt(growth.style.height) + 70}px`;
      el.dispatchEvent(new Event("scroll"));
    });
    await page.waitForFunction(() => {
      const el = document.querySelector("[data-chat-scroll]");
      return el.scrollHeight - el.clientHeight - el.scrollTop < 2;
    });
  }
  await scroll.evaluate((el) => { el.scrollTop = 100; });
  await page.waitForTimeout(100);
  await scroll.evaluate(() => { document.getElementById("scroll-growth-fixture").style.height = "2600px"; });
  await page.waitForTimeout(150);
  assert.ok(await atBottom(), "chat always stays pinned even after an upward scroll");
  await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(100);
  await scroll.evaluate(() => { document.getElementById("scroll-growth-fixture").style.height = "2900px"; });
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-chat-scroll]");
    return el.scrollHeight - el.clientHeight - el.scrollTop < 2;
  });
  assert.ok(await atBottom(), "returning to the bottom resumes following");

  await scroll.evaluate(() => document.getElementById("scroll-growth-fixture").remove());
  await page.getByRole("textbox", { name: "Message Ask Beacon" }).fill("Stream scroll fixture");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(/^Streaming line 10:/).waitFor();
  for (let index = 0; index < 10; index++) {
    await page.waitForTimeout(30);
    assert.ok(await atBottom(), "actual SSE text keeps the view glued to the bottom");
  }
  await scroll.evaluate((el) => { el.scrollTop = 100; });
  await page.getByText(/^Streaming line 30:/).waitFor();
  assert.ok(await atBottom(), "streaming always keeps the newest text visible");
  await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.getByText(/^Streaming line 59:/).waitFor();
  await page.waitForTimeout(100);
  assert.ok(await atBottom(), "actual streaming resumes bottom pinning");

  await page.reload({ waitUntil: "networkidle" });
  await preview
    .getByRole("button", { name: "Enlarge verification preview" })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  console.log(
    "PASS: tool calls, inline playback, buffered reply, click-to-enlarge, unconditional bottom pinning, retained recording, phone layout and reduced motion. No live lookup/model calls.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => fixture.close(resolve));
}
