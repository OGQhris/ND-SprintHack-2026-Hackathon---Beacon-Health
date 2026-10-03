import { chromium } from "playwright";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch();
const page = await browser.newPage({
  baseURL,
  viewport: { width: 1512, height: 1100 },
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("/dashboard");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/rn_f1d1a788ae65805a/verify") &&
      r.request().method() === "POST",
    { timeout: 180000 },
  );
  await page
    .getByRole("button", { name: "Verify Kathryn Cell", exact: true })
    .click();
  await page.locator(".verification-viewer").waitFor({ timeout: 30000 });
  assert.equal(await page.locator(".viewer-mode").innerText(), "LIVE");
  const completed = await response;
  assert.equal(completed.status(), 200);
  const employee = (await completed.json()).employee;
  const history = await (
    await page.request.get("/api/employees/rn_f1d1a788ae65805a")
  ).json();
  const recordingId = history.audits[0].normalized.recordingId;
  assert.ok(recordingId);
  const run = await (
    await page.request.get(`/api/verification-runs/${recordingId}`)
  ).json();
  assert.equal(run.state, employee.verificationState);
  assert.ok(run.finishedAt);
  const diskRun = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "-e",
        'import {getRun} from "./services/verificationRecorder.ts"; console.log(JSON.stringify(await getRun(process.argv[1])));',
        recordingId,
      ],
      { encoding: "utf8" },
    ),
  );
  assert.equal(diskRun.id, recordingId);
  assert.equal(diskRun.state, run.state);
  assert.ok(run.steps.length > 0);
  if (run.state === "VERIFIED") {
    assert.ok(run.steps.some((s) => s.kind === "click"));
    assert.ok(run.steps.some((s) => s.kind === "type"));
    assert.equal(run.result.licenseNumber, "4704214941");
  }
  for (const step of run.steps) {
    const frame = await page.request.get(step.frameUrl);
    assert.equal(frame.status(), 200);
    assert.equal(frame.headers()["content-type"], "image/jpeg");
    if (step.target) {
      assert.ok(step.target.x >= 0 && step.target.x <= 1);
      assert.ok(step.target.y >= 0 && step.target.y <= 1);
    }
  }
  await page.locator(".viewer-result").waitFor();
  await page.getByRole("button", { name: "Replay from beginning" }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".viewer-controls>span")
        ?.textContent.startsWith("2 /"),
    null,
    { timeout: 10000 },
  );
  await page.getByRole("button", { name: "Pause playback" }).click();
  await page.waitForTimeout(850);
  await page.screenshot({ path: "debug/verification-viewer-desktop.png" });
  await page
    .locator(".verification-viewer")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View details for Kathryn Cell" })
    .click();
  await page.locator(".audit-row").first().locator("summary").click();
  await page
    .getByRole("button", { name: "Replay this verification" })
    .first()
    .click();
  await page.locator(".verification-viewer").waitFor();
  assert.equal(await page.locator(".viewer-mode").innerText(), "REPLAY");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({ path: "debug/verification-viewer-mobile.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.equal(
    await page
      .locator(".viewer-cursor")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
  assert.equal(
    (
      await page.request.get("/api/verification-runs/invalid/frames/0")
    ).status(),
    404,
  );
  assert.equal(
    (
      await page.request.get(
        `/api/verification-runs/${recordingId}/frames/invalid`,
      )
    ).status(),
    404,
  );
  assert.deepEqual(errors, []);
  if (process.env.TEST_LIVE_AI === "1") {
    await page.goto("/assistant");
    await page
      .getByRole("textbox", { name: "Message credential assistant" })
      .fill("Verify Kathryn Cell.");
    await page.getByRole("button", { name: "Send message" }).click();
    await page.locator(".verification-viewer").waitFor({ timeout: 120000 });
    await page.locator(".viewer-result").waitFor({ timeout: 180000 });
    assert.equal(
      await page.locator(".viewer-heading h2").innerText(),
      "Kathryn Cell",
    );
    await page
      .locator(".verification-viewer")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await page.waitForFunction(
      () => !document.querySelector('button[aria-label="Stop response"]'),
      null,
      { timeout: 180000 },
    );
    assert.equal(await page.locator(".chat-error").count(), 0);
    console.log(
      "PASS: live OpenAI tool-triggered verification opens the same browser viewer.",
    );
  }
  console.log(
    `PASS: ${run.state}; ${run.steps.length} real frames; target coordinates, live viewer, playback, history replay, mobile, reduced motion, and invalid paths.`,
  );
} finally {
  await browser.close();
}
