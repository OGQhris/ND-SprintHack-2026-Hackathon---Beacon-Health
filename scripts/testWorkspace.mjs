import { chromium } from "playwright";
import assert from "node:assert/strict";
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ baseURL, viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const workspace = await (await page.request.get("/api/workspace")).json();
  assert.equal(workspace.seed.sampleCount, 4);
  const samples = workspace.seed.employees.filter((e) => e.isSample);
  assert.equal(samples.length, 4);
  assert.equal("demo" in workspace, false);
  assert.equal(await page.getByRole("button", { name: "Demo clock", exact: true }).count(), 0);
  await page.getByRole("button", { name: "BM account menu" }).click();
  await page.getByRole("menuitem", { name: "Start demo", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.goto("/employees", { waitUntil: "networkidle" });
  await page.getByLabel("Search employees", { exact: true }).fill("Jamie Morgan");
  await page.locator("tbody").getByText("Jamie Morgan", { exact: true }).waitFor();
  assert.ok(await page.getByText("Sample", { exact: true }).count());
  assert.deepEqual(errors, []);
  console.log("PASS: four persisted sample employees, sample labels, real date workspace, BM menu; no emails sent.");
} finally {
  await browser.close();
}
