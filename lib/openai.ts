import "./env";
import OpenAI from "openai";
export const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5.5";
export const aiConfigured = () => !!process.env.OPENAI_API_KEY?.trim();
export function safeAIErrorMessage(error: unknown) {
  let message = error instanceof Error ? error.message : "Unknown AI error";
  const key = process.env.OPENAI_API_KEY?.trim();
  if (key) message = message.replaceAll(key, "[redacted]");
  return message.replace(/sk-[^\s"']+/g, "[redacted]");
}
export function getOpenAI() {
  if (!aiConfigured())
    throw new Error(
      "Add OPENAI_API_KEY to .env.local and restart the development server.",
    );
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 120_000,
    maxRetries: 1,
  });
}
