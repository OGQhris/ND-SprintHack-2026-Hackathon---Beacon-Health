import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1512, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await mkdir("debug", { recursive: true });
  await page.goto("http://127.0.0.1:3000/dashboard", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("heading", { name: "Your team, in good view." })
    .waitFor();
  console.log("ROSTER_ROWS", await page.locator("tbody tr").count());
  await page.screenshot({
    animations: "disabled",
    path: "debug/dashboard-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "View details for Kathryn Cell" })
    .click();
  await page.getByRole("heading", { name: "Kathryn Cell" }).waitFor();
  await page.getByText("4704214941", { exact: true }).waitFor();
  await page.locator(".audit-row").first().waitFor();
  await page.screenshot({
    animations: "disabled",
    path: "debug/employee-detail.png",
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("textbox", { name: "Search employees" }).fill("Kathryn");
  console.log("FILTERED_ROWS", await page.locator("tbody tr").count());
  await page.getByRole("textbox", { name: "Search employees" }).fill("");
  await page.getByRole("button", { name: "Ask Beacon" }).click();
  await page.locator(".chat-welcome").waitFor();
  await page.screenshot({
    animations: "disabled",
    path: "debug/compact-assistant.png",
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto("http://127.0.0.1:3000/assistant", {
    waitUntil: "networkidle",
  });
  await page.locator(".chat-welcome").waitFor();
  await page.screenshot({
    animations: "disabled",
    path: "debug/assistant-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () => document.querySelector(".sidebar").getBoundingClientRect().right <= 0,
  );
  await page.screenshot({
    animations: "disabled",
    path: "debug/assistant-mobile.png",
    fullPage: true,
  });
  console.log(
    "ASSISTANT_WIDTH",
    await page.evaluate(() => ({
      viewport: innerWidth,
      body: document.body.scrollWidth,
      html: document.documentElement.scrollWidth,
    })),
  );
  await page.goto("http://127.0.0.1:3000/dashboard", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("heading", { name: "Your team, in good view." })
    .waitFor();
  await page.screenshot({
    animations: "disabled",
    path: "debug/dashboard-mobile.png",
    fullPage: true,
  });
  console.log(
    "DASHBOARD_WIDTH",
    await page.evaluate(() => ({
      viewport: innerWidth,
      body: document.body.scrollWidth,
      html: document.documentElement.scrollWidth,
    })),
  );
  console.log("ERRORS", errors);
} finally {
  await browser.close();
}
