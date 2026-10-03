import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1512, height: 1100 },
  baseURL: "http://127.0.0.1:3000",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:3000/dashboard", {
    waitUntil: "networkidle",
  });
  const before = await page.request.get("/api/employees/rn_f1d1a788ae65805a");
  const initial = (await before.json()).audits.length;
  const verificationResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/rn_f1d1a788ae65805a/verify") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Verify Kathryn Cell", exact: true })
    .click();
  const verified = await verificationResponse;
  assert.equal(verified.status(), 200);
  assert.equal((await verified.json()).employee.verificationState, "VERIFIED");
  await page.waitForFunction(
    () => {
      const row = Array.from(document.querySelectorAll("tbody tr")).find((r) =>
        r.textContent.includes("Kathryn Cell"),
      );
      return (
        row?.querySelector(".verification-verified") &&
        !row?.querySelector(".spin")
      );
    },
    {},
    { timeout: 120000 },
  );
  const after = await page.request.get("/api/employees/rn_f1d1a788ae65805a");
  const checked = await after.json();
  assert.equal(checked.employee.verificationState, "VERIFIED");
  assert.ok(checked.audits.length > initial);
  console.log(
    "PASS: dashboard Verify button → Michigan lookup → SQLite audit → refreshed row.",
  );
  await page.goto("http://127.0.0.1:3000/assistant", {
    waitUntil: "networkidle",
  });
  await page.locator(".chat-welcome").waitFor();
  assert.equal(
    await page.getByText("Your assistant is one key away.").count(),
    0,
  );
  let count = 0;
  const ask = async (message) => {
    count++;
    await page
      .getByRole("textbox", { name: "Message credential assistant" })
      .fill(message);
    await page.getByRole("button", { name: "Send message" }).click();
    await page.waitForFunction(
      (n) => {
        const messages = document.querySelectorAll(
          ".message-assistant .markdown",
        );
        return messages.length === n && messages[n - 1].textContent.length > 0;
      },
      count,
      { timeout: 180000 },
    );
    if (count === 1)
      await page.screenshot({
        path: "debug/chat-live-streaming.png",
        animations: "disabled",
      });
    await page.waitForFunction(
      () => !document.querySelector('button[aria-label="Stop response"]'),
      null,
      { timeout: 180000 },
    );
    const answer = await page.locator(".message-assistant").last().innerText();
    assert.equal(await page.locator(".chat-error").count(), 0, answer);
    assert.ok(answer.includes("Complete"), answer);
    console.log("LIVE CHAT", message, "→", answer.slice(-700));
    return answer;
  };
  assert.match(await ask("Tell me about Kathryn Cell."), /Kathryn/);
  assert.match(await ask("When does she expire?"), /2028/);
  await ask("Who expires in the next 30 days?");
  await ask("Verify Kathryn Cell.");
  const result = await page.request.get("/api/employees/rn_f1d1a788ae65805a");
  assert.equal((await result.json()).employee.verificationState, "VERIFIED");
  await page.screenshot({
    path: "debug/chat-live-conversation.png",
    animations: "disabled",
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(
    () => document.querySelectorAll(".message-user").length === 4,
  );
  console.log(
    "PASS: live OpenAI streaming, real tool rows, multi-turn pronoun, persisted messages, AI-triggered verification.",
  );
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "debug/chat-live-mobile.png",
    animations: "disabled",
  });
} finally {
  await browser.close();
}
