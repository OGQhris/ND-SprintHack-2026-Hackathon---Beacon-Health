import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

/** Shared pieces of the browser smoke test in checkUi.mjs: browser setup, error capture, API helpers. */

export const baseURL = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
export const DEBUG_DIR = "debug";
export const DESKTOP = { width: 1440, height: 1000 };
export const PHONE = { width: 390, height: 844 };

/** Browser console output that the dev server produces and that is not an application error. */
const IGNORED_CONSOLE = [
  /favicon/i,
  /\[HMR\]/,
  /\[Fast Refresh\]/,
  /Fast Refresh had to perform a full reload/,
  /Download the React DevTools/,
];

export async function createHarness() {
  await mkdir(DEBUG_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL, viewport: DESKTOP });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(90_000);

  const pageErrors = [];
  const consoleErrors = [];
  const ignored = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    (IGNORED_CONSOLE.some((pattern) => pattern.test(text)) ? ignored : consoleErrors).push(text);
  });

  return { browser, page, pageErrors, consoleErrors, ignored };
}

/** Runs named steps in order, records failures instead of aborting, and prints one line per step. */
export function createRunner() {
  const failures = [];
  async function step(name, fn) {
    const started = Date.now();
    try {
      const detail = await fn();
      console.log(`PASS ${name}${detail ? ` (${detail})` : ""} ${Date.now() - started}ms`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ name, message });
      console.log(`FAIL ${name}: ${message}`);
      return false;
    }
  }
  return { step, failures };
}

/** The dev server compiles a route on its first request; ask for each page once so the browser steps do not time out. */
export async function warmUp(page, paths) {
  for (const path of paths) {
    await page.request.get(path, { timeout: 180_000, maxRedirects: 5 });
  }
}

export async function getJson(page, path) {
  const response = await page.request.get(path, { headers: { accept: "application/json" } });
  assert.equal(response.status(), 200, `GET ${path} answered ${response.status()}`);
  return response.json();
}

/** Same-origin POST: the mutation routes refuse requests whose Origin does not match the server. */
export async function postJson(page, path, data) {
  const response = await page.request.post(path, {
    data,
    headers: { Origin: baseURL, "content-type": "application/json" },
  });
  return { status: response.status(), json: await response.json().catch(() => null) };
}

export async function shot(page, name, fullPage = false) {
  const path = `${DEBUG_DIR}/${name}`;
  await page.screenshot({ path, fullPage, animations: "disabled" });
  return path;
}

/** Polls a locator until it matches exactly `expected` elements. */
export async function waitForCount(locator, expected, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  let count = await locator.count();
  while (count !== expected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    count = await locator.count();
  }
  assert.equal(count, expected, `expected ${expected} matches for ${locator}, saw ${count}`);
}

export function printSummary({ failures, pageErrors, consoleErrors, ignored }) {
  if (ignored.length) console.log(`IGNORED_CONSOLE ${ignored.length}:`, ignored.map((t) => t.split("\n")[0]));
  console.log("PAGE_ERRORS", pageErrors);
  console.log("CONSOLE_ERRORS", consoleErrors);
  if (pageErrors.length) failures.push({ name: "page errors", message: `${pageErrors.length} uncaught` });
  if (consoleErrors.length) failures.push({ name: "console errors", message: `${consoleErrors.length} logged` });
  if (failures.length) {
    console.log(`\n${failures.length} FAILED`);
    for (const f of failures) console.log(`- ${f.name}: ${f.message}`);
    return 1;
  }
  console.log("\nALL CHECKS PASSED");
  return 0;
}
