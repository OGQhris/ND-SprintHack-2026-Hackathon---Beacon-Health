import { aiConfigured, getOpenAI, safeAIErrorMessage } from "../lib/openai";
import { runResponseLoop, sdkTransport } from "../lib/ai/responseLoop";
import { db } from "../lib/db";
import type { ResponseInputItem } from "openai/resources/responses/responses";
if (!aiConfigured()) {
  console.error("Add OPENAI_API_KEY to .env.local to run live OpenAI tests.");
  process.exit(1);
}
const messages = process.argv.includes("--only-verify")
  ? ["Verify Kathryn Cell."]
  : [
      "Tell me about Kathryn Cell.",
      "When does she expire?",
      "Who expires in the next 30 days?",
      "Who reports to Christianna Davison?",
      "Do any of them expire soon?",
      "Who needs attention?",
    ];
if (
  process.argv.includes("--verify") &&
  !process.argv.includes("--only-verify")
)
  messages.push("Verify Kathryn Cell.");
const history: ResponseInputItem[] = [];
try {
  for (const message of messages) {
    console.log("\nUSER:", message);
    history.push({ role: "user", content: message });
    let deltas = 0;
    const tools: string[] = [];
    const content = await runResponseLoop({
      transport: sdkTransport(getOpenAI()),
      history,
      latestUserMessage: message,
      emit: (event) => {
        if (event.type === "text_delta") {
          deltas++;
          process.stdout.write(event.text || "");
        }
        if (event.type === "tool_call_start") tools.push(event.name || "");
      },
    });
    if (!tools.length)
      throw new Error(
        `Current-credential question did not use a database tool: ${message}`,
      );
    if (!deltas) throw new Error("No streamed text was received.");
    history.push({ role: "assistant", content });
    if (message === "Verify Kathryn Cell.") {
      const employee = await db.employee.findFirst({
        where: { firstName: "Kathryn", lastName: "Cell" },
      });
      if (employee?.verificationState !== "VERIFIED")
        throw new Error(
          "AI-triggered lookup ran but the source verification did not succeed.",
        );
    }
    console.log(
      `\n[Live test] ${deltas} streamed chunks; tools: ${tools.join(", ")}`,
    );
  }
  console.log("\nLive Responses API smoke test passed.");
} catch (error) {
  console.error(
    "\n[Live test] Failed:",
    safeAIErrorMessage(error),
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
