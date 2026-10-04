import assert from "node:assert/strict";
import {
  DESKTOP,
  PHONE,
  createHarness,
  createRunner,
  getJson,
  printSummary,
  shot,
  waitForCount,
  warmUp,
} from "./checkUiSupport.mjs";

/**
 * Browser smoke test for the credential monitor (npm run test:ui).
 * Needs a running server: TEST_BASE_URL (default http://127.0.0.1:3000).
 * Never starts a verification: Verify now, Verify selected, Verify all and Replay contact the real Michigan site.
 * SKIP_AI=1 skips the one assistant question that uses the configured OpenAI key.
 */

const KPI_LABELS = ["Total employees", "Expiring within 30 days", "Expired", "Needs attention"];
const ALERT_TABS = ["All", "Expired", "7 days", "14 days", "30 days", "Verification issues"];
const PAGES = ["/dashboard", "/employees", "/alerts", "/ask", "/assistant", "/reports"];
const QUESTION = "Who needs attention?";
const ROSTER = 17;

const harness = await createHarness();
const { browser, page } = harness;
const { step, failures } = createRunner();
let workspace;

const open = (path) => page.goto(path, { waitUntil: "networkidle" });
// Page titles are the h1; the top nav repeats the page name in an h2, so the level matters.
const heading = (name, level = 1) => page.getByRole("heading", { name, exact: true, level });
const rows = () => page.locator("tbody tr");
const kpi = (label) => page.locator(`section[aria-label="${label}"]`);

try {
  await step("workspace payload", async () => {
    workspace = await getJson(page, "/api/workspace");
    const { seed, batch, aiConfigured, generatedAt } = workspace;
    assert.equal(seed.employees.length, ROSTER + 4);
    assert.equal(seed.credentials.length, ROSTER + 4);
    for (const credential of seed.credentials) assert.equal(credential.id, `cred-${credential.employeeId}`);
    assert.equal(typeof batch?.running, "boolean", "batch present");
    assert.equal(typeof aiConfigured, "boolean", "aiConfigured present");
    assert.match(generatedAt, /^\d{4}-\d{2}-\d{2}T/, "generatedAt is an ISO timestamp");
    assert.match(seed.today, /^\d{4}-\d{2}-\d{2}$/, "today is YYYY-MM-DD");
    await warmUp(page, PAGES);
    return `today ${seed.today}, aiConfigured ${aiConfigured}`;
  });

  await step("dashboard", async () => {
    await open("/dashboard");
    await heading("Credential Monitoring").waitFor();
    for (const label of KPI_LABELS) await kpi(label).waitFor();
    assert.equal(await page.locator(KPI_LABELS.map((l) => `section[aria-label="${l}"]`).join(", ")).count(), 4);
    await waitForCount(rows(), ROSTER);
    assert.equal(await page.locator("tbody [data-status]").count(), ROSTER, "one status badge per row");
    await shot(page, "dashboard-desktop.png", true);
  });

  await step("search employees", async () => {
    const search = page.getByRole("textbox", { name: "Search employees" });
    await search.fill("Kathryn");
    await waitForCount(rows(), 1);
    assert.match(await rows().first().innerText(), /Kathryn/);
    await search.fill("");
    await waitForCount(rows(), ROSTER);
  });

  await step("employee detail", async () => {
    const link = rows().first().locator('a[href^="/employees/"]').first();
    const href = await link.getAttribute("href");
    await link.click();
    await page.waitForURL((url) => url.pathname === href);
    await heading("Current credential", 2).waitFor();
    await heading("Verification history", 2).waitFor();
    await page.getByRole("button", { name: "Verify now", exact: true }).waitFor();
    await page.waitForLoadState("networkidle");
    await shot(page, "employee-detail.png", true);
    return href;
  });

  await step("employees page", async () => {
    await open("/employees");
    await heading("Employees").waitFor();
    await waitForCount(rows(), ROSTER);
    await page.getByRole("button", { name: /^Verify all on this page/ }).waitFor();
  });

  await step("alerts", async () => {
    await open("/alerts");
    await heading("Credential Alerts").waitFor();
    const tabs = page.locator('[role="tab"]');
    await waitForCount(tabs, ALERT_TABS.length);
    const counts = [];
    for (let i = 0; i < ALERT_TABS.length; i++) {
      const text = (await tabs.nth(i).innerText()).trim();
      assert.ok(text.startsWith(ALERT_TABS[i]), `tab ${i} reads "${text}", expected "${ALERT_TABS[i]}"`);
      counts.push(Number(await tabs.nth(i).locator("span").last().innerText()));
    }
    const all = counts[0];
    assert.ok(Number.isInteger(all), `All tab count is ${all}`);
    assert.equal(counts.slice(1).reduce((sum, n) => sum + n, 0), all, "the other tabs add up to All");
    const badge = page.locator('[data-slot="sidebar-menu-badge"]');
    if (all > 0) assert.equal(Number(await badge.first().innerText()), all, "sidebar badge equals All");
    else assert.equal(await badge.count(), 0, "no sidebar badge without open alerts");
    await shot(page, "alerts.png", true);
    return `${all} open alerts`;
  });

  await step("ask page", async () => {
    await open("/ask");
    await heading("Ask Beacon").waitFor();
    const prompt = page.getByRole("button", { name: QUESTION, exact: true });
    await prompt.waitFor();
    const prompts = await prompt.locator("xpath=..").locator("button").count();
    assert.ok(prompts >= 4, `${prompts} suggested prompts`);
    await shot(page, "ask.png", true);
    return `${prompts} suggested prompts`;
  });

  await step("legacy redirects", async () => {
    await page.goto("/assistant", { waitUntil: "load" });
    assert.equal(new URL(page.url()).pathname, "/ask");
    await page.goto("/reports", { waitUntil: "load" });
    assert.equal(new URL(page.url()).pathname, "/dashboard");
  });

  await step("sample employee records", async () => {
    const workspace = await getJson(page, "/api/workspace");
    assert.equal(workspace.seed.sampleCount, 4);
    assert.equal(workspace.seed.employees.filter((e) => e.isSample).length, 4);
    await open("/dashboard");
    assert.equal(await page.getByRole("button", { name: "Demo clock", exact: true }).count(), 0);
  });

  await step("phone layout", async () => {
    await page.setViewportSize(PHONE);
    await open("/dashboard");
    await heading("Credential Monitoring").waitFor();
    assert.equal(await page.locator('[data-slot="sidebar"]:visible').count(), 0, "sidebar is off-canvas");
    await page.locator('[data-slot="sidebar-trigger"]:visible').first().waitFor();
    assert.equal(await page.locator("table:visible").count(), 0, "the table is hidden on phones");
    const cards = await page.locator('main a[href^="/employees/"]:visible').count();
    assert.ok(cards >= ROSTER, `card list shows ${cards} employees`);
    await page.locator('a[aria-label="Ask Beacon"]:visible').waitFor();
    const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(widths.document <= widths.viewport, `horizontal overflow ${JSON.stringify(widths)}`);
    await shot(page, "dashboard-phone.png", true);
    await page.setViewportSize(DESKTOP);
  });

  const skipAi = process.env.SKIP_AI === "1" && workspace?.aiConfigured;
  await step(skipAi ? "assistant question (skipped, SKIP_AI=1)" : "assistant question", async () => {
    if (skipAi) return;
    await open("/ask");
    await page.getByRole("textbox", { name: "Message Ask Beacon" }).fill(QUESTION);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.waitForURL(/\/ask\?t=/);
    // The composer swaps Send for Stop while a reply is pending and the pending message shows a spinner.
    await page.getByRole("button", { name: "Send", exact: true }).waitFor({ timeout: 90_000 });
    await page.waitForFunction(() => !document.querySelector('[data-slot="spinner"]'), null, { timeout: 90_000 });
    assert.equal(await page.locator(".text-status-failed-fg").count(), 0, "the reply is in an error state");

    if (!workspace.aiConfigured) {
      await page.getByText("Rule-based answer from your credential data", { exact: true }).waitFor();
      await page.getByText(/Answers come from built-in rules/).waitFor();
      await shot(page, "ask-answer.png", true);
      return "rules mode";
    }
    const footer = page.getByText(/ on your credential data$/).first();
    await footer.waitFor();
    const match = (await footer.innerText()).match(/^(.+) on your credential data$/);
    assert.ok(match && match[1] && match[1] !== "Model", `footer names the model: "${match?.[0]}"`);
    const message = footer.locator("xpath=ancestor::div[contains(@class,'flex-col')][1]");
    const text = (await message.innerText()).replace(match[0], "").trim();
    assert.ok(text.length > 0, "the reply has text");
    await shot(page, "ask-answer.png", true);
    return `model ${match[1]}, ${text.length} chars`;
  });
} finally {
  await browser.close();
}

process.exitCode = printSummary({ failures, ...harness });
