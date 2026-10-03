// UI fixtures only: no roster checks or external AI requests are sent.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch();
const page = await browser.newPage({
  baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:3000",
  viewport: { width: 1512, height: 1100 },
});
let batch = false,
  runNumber = 1,
  origin = "batch",
  secondFrame = false;
let releaseFrame;
const delayedFrame = new Promise((resolve) => {
  releaseFrame = resolve;
});
const fixture = () => ({
  id: `fixture-${runNumber}`,
  origin,
  employeeId: "fixture",
  employeeName: `Test employee ${runNumber}`,
  startedAt: new Date().toISOString(),
  state: "VERIFYING",
  steps: [
    {
      index: 0,
      kind: "click",
      label: "Searching licensing source",
      timestamp: new Date().toISOString(),
      frameUrl: "/api/fixture-frame-1",
      target: { x: 0.5, y: 0.5, width: 0.15, height: 0.05 },
    },
    ...(secondFrame
      ? [
          {
            index: 1,
            kind: "read",
            label: "Reading license details",
            timestamp: new Date().toISOString(),
            frameUrl: "/api/fixture-frame-2",
          },
        ]
      : []),
  ],
});
const svg = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000"><rect width="1440" height="1000" fill="${color}"/><text x="250" y="350" fill="white" font-size="45">Browser screenshot fixture</text></svg>`;
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.route("**/api/dashboard", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.batch = {
      ...data.batch,
      running: batch,
      total: 17,
      completed: runNumber - 1,
      currentEmployee: fixture().employeeName,
    };
    await route.fulfill({ json: data });
  });
  await page.route("**/api/verify-all", async (route) => {
    batch = true;
    await route.fulfill({ json: { running: true } });
  });
  await page.route("**/api/verification-runs", (route) =>
    route.fulfill({ json: { runs: batch ? [fixture()] : [] } }),
  );
  await page.route("**/api/verification-runs/fixture-*", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.route("**/api/fixture-frame-1", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg("#244b3d") }),
  );
  await page.route("**/api/fixture-frame-2", async (route) => {
    await delayedFrame;
    await route.fulfill({ contentType: "image/svg+xml", body: svg("#16394f") });
  });
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: "Verify all credentials", exact: true })
    .click();
  await page.locator(".batch-banner").waitFor();
  assert.equal(await page.locator(".batch-preview").count(), 0);
  assert.equal(await page.locator(".verification-viewer").count(), 0);
  assert.equal(await page.locator(".verification-launcher").count(), 0);
  runNumber = 2;
  await page
    .locator(".batch-banner")
    .getByText(/Test employee 2/)
    .waitFor();
  assert.equal(await page.locator(".verification-viewer").count(), 0);
  await mkdir("debug", { recursive: true });
  await page.screenshot({ path: "debug/batch-progress-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () => document.querySelector(".sidebar").getBoundingClientRect().right <= 0,
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: "debug/batch-progress-mobile.png" });
  await page.setViewportSize({ width: 1512, height: 1100 });
  runNumber = 3;
  origin = "single";
  await page.locator(".verification-viewer").waitFor();
  await page.locator(".viewer-frame").waitFor();
  assert.equal(
    await page.locator(".viewer-heading h2").innerText(),
    "Test employee 3",
  );
  await page
    .getByRole("button", { name: "Pause playback", exact: true })
    .click();
  secondFrame = true;
  await page.getByRole("button", { name: /Reading license details/ }).waitFor();
  const requested = page.waitForRequest("**/api/fixture-frame-2");
  await page.getByRole("button", { name: /Reading license details/ }).click();
  await requested;
  assert.equal(
    await page.locator(".viewer-frame").getAttribute("src"),
    "/api/fixture-frame-1",
  );
  const style = await page
    .locator(".viewer-frame")
    .evaluate((el) => ({
      opacity: getComputedStyle(el).opacity,
      transition: getComputedStyle(el).transitionDuration,
    }));
  assert.equal(style.opacity, "1");
  assert.equal(style.transition, "0s");
  releaseFrame();
  await page.waitForFunction(
    () =>
      document.querySelector(".viewer-frame")?.getAttribute("src") ===
      "/api/fixture-frame-2",
  );
  assert.equal(await page.locator(".viewer-frame").count(), 1);
  await page.screenshot({ path: "debug/verification-no-fade.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: compact bulk progress without preview/popups; mobile fits; individual viewer opens; previous opaque screenshot stays visible until delayed replacement decodes. UI fixtures only.",
  );
} finally {
  releaseFrame();
  await browser.close();
}
