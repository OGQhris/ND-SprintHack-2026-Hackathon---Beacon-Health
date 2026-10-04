import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch();
const page = await browser.newPage({
  baseURL,
  viewport: { width: 1512, height: 1100 },
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let original;
try {
  const before = await (await page.request.get("/api/dashboard")).json();
  original = before.demo;
  assert.ok(before.employees.length);
  const setDemo = (settings) =>
    page.request.post("/api/demo", {
      data: settings,
      headers: { Origin: baseURL },
    });
  assert.equal(
    (
      await setDemo({
        enabled: true,
        today: "2026-10-03",
        seedDate: "2026-10-03",
      })
    ).status(),
    200,
  );
  await page.goto("/alerts");
  await page.getByText("Demo data enabled", { exact: true }).waitFor();
  const seeded = await (await page.request.get("/api/dashboard")).json();
  for (const employee of seeded.employees) {
    const prior = before.employees.find((e) => e.id === employee.id);
    assert.equal(employee.sourceExpirationDate, prior.sourceExpirationDate);
    assert.equal(employee.demoExpiration, true);
  }
  const cards = page.locator(".alert-category");
  assert.equal(await cards.count(), 5);
  for (let i = 0; i < 4; i++)
    assert.ok(Number(await cards.nth(i).locator("strong").innerText()) > 0);
  await cards.nth(1).click();
  assert.ok((await page.locator(".alert-item").count()) > 0);
  await page.getByRole("button", { name: "+7 days", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('input[aria-label="Demo date"]')?.value ===
      "2026-10-10",
  );
  const advanced = await (await page.request.get("/api/dashboard")).json();
  assert.ok(
    advanced.employees.filter((e) => e.daysUntilExpiration < 0).length >
      seeded.employees.filter((e) => e.daysUntilExpiration < 0).length,
  );
  await page.getByRole("button", { name: "Reset clock", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('input[aria-label="Demo date"]')?.value ===
      "2026-10-03",
  );
  await mkdir("debug", { recursive: true });
  await page.screenshot({ path: "debug/workspace-alerts.png", fullPage: true });
  await page.getByRole("link", { name: "Employee credentials", exact: true }).click();
  await page.getByLabel("Search employees", { exact: true }).waitFor();
  const employee = seeded.employees[0];
  const name = `${employee.firstName} ${employee.lastName}`;
  await page.getByLabel("Search employees", { exact: true }).fill(name);
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByLabel("Filter by manager", { exact: true })
    .selectOption(employee.manager);
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByLabel("Filter by status", { exact: true })
    .selectOption(`verification:${employee.verificationState}`);
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByLabel(`Select ${name}`, { exact: true }).check();
  let requested;
  let simulatedBatch = null;
  await page.route("**/api/dashboard", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    if (simulatedBatch) data.batch = simulatedBatch;
    await route.fulfill({ response, json: data });
  });
  await page.route("**/api/verify-all", async (route) => {
    requested = route.request().postDataJSON();
    simulatedBatch = {
      ...seeded.batch,
      running: true,
      total: 1,
      completed: 0,
      verified: 0,
      failed: 0,
      currentEmployee: name,
    };
    await route.fulfill({ json: simulatedBatch });
  });
  await page
    .getByRole("button", { name: "Verify selected", exact: true })
    .click();
  await page.getByRole("progressbar").waitFor();
  assert.deepEqual(requested.employeeIds, [employee.id]);
  await page
    .getByText("Started 1 credential checks.", { exact: true })
    .waitFor();
  assert.equal(await page.locator(".verification-viewer").count(), 0);
  simulatedBatch = {
    ...simulatedBatch,
    running: false,
    completed: 1,
    verified: 1,
  };
  await page
    .getByText("Verification finished: 1 verified, 0 need attention.", {
      exact: true,
    })
    .waitFor({ timeout: 12000 });
  await page.screenshot({
    path: "debug/workspace-employees.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/alerts");
  await page.locator(".alert-category").first().waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "mobile page must fit viewport",
  );
  await page.screenshot({ path: "debug/workspace-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: alert windows, demo clock/reset, preserved source dates, employee filters, selected batch payload, start/completion toasts, no bulk viewer, mobile layout. Batch verification uses a local fixture.",
  );
} finally {
  if (original)
    await page.request.post("/api/demo", {
      data: original,
      headers: { Origin: baseURL },
    });
  await browser.close();
}
