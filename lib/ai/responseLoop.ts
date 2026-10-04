import type OpenAI from "openai";
import type {
  Response,
  ResponseCreateParamsStreaming,
  ResponseInputItem,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";
import { executeTool, toolDefinitions, toolLabel } from "./tools";
import { OPENAI_MODEL } from "@/lib/openai";
import { systemPrompt } from "./systemPrompt";
import type { ChatRow } from "@/lib/assistant/types";
export type ChatEvent = {
  type:
    | "assistant_start"
    | "tool_call_start"
    | "tool_call_complete"
    | "text_delta"
    | "answer"
    | "assistant_complete"
    | "error"
    | "heartbeat";
  text?: string;
  name?: string;
  label?: string;
  callId?: string;
  ok?: boolean;
  message?: string;
  /** "answer" frames: employee chips and the deep link to show under the finished reply. */
  rows?: ChatRow[];
  href?: string;
  model?: string;
  mode?: "llm" | "rules";
};
/** Observes each tool result as it is produced (the /api/ask route collects employee chips from them). */
export type ToolResultListener = (call: {
  name: string;
  arguments: string;
  result: unknown;
}) => void;
// Injectable transport keeps orchestration testable without replacing actual SDK function calls.
export type ResponseTransport = (
  params: ResponseCreateParamsStreaming,
  signal?: AbortSignal,
) => Promise<AsyncIterable<ResponseStreamEvent>>;
export function sdkTransport(client: OpenAI): ResponseTransport {
  return (params, signal) => client.responses.create(params, { signal });
}
export async function runResponseLoop({
  transport,
  history,
  latestUserMessage,
  emit,
  signal,
  onToolResult,
}: {
  transport: ResponseTransport;
  history: ResponseInputItem[];
  latestUserMessage: string;
  emit: (event: ChatEvent) => void;
  signal?: AbortSignal;
  onToolResult?: ToolResultListener;
}) {
  const input = [...history];
  let text = "";
  emit({ type: "assistant_start" });
  for (let round = 0; round < 12; round++) {
    if (signal?.aborted) throw new Error("Chat request was interrupted.");
    console.log(
      "[AI]",
      round ? "Continuing response" : "User message received",
    );
    const stream = await transport(
      {
        model: OPENAI_MODEL,
        instructions: systemPrompt(),
        input,
        tools: toolDefinitions,
        tool_choice: "auto",
        parallel_tool_calls: false,
        store: false,
        stream: true,
        max_output_tokens: 3000,
      },
      signal,
    );
    let response: Response | undefined;
    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        text += event.delta;
        emit({ type: "text_delta", text: event.delta });
      }
      if (event.type === "response.refusal.delta") {
        text += event.delta;
        emit({ type: "text_delta", text: event.delta });
      }
      if (event.type === "response.completed") response = event.response;
      if (event.type === "response.failed")
        throw new Error(
          event.response.error?.message ||
            "OpenAI could not complete the response.",
        );
      if (event.type === "response.incomplete")
        throw new Error(
          "The response was interrupted before completion. Please try a shorter question.",
        );
      if (event.type === "error") throw new Error(event.message);
    }
    if (!response)
      throw new Error(
        "The assistant stream ended unexpectedly. Please try again.",
      );
    const calls = response.output.filter(
      (item) => item.type === "function_call",
    );
    if (!calls.length) {
      if (!text.trim())
        throw new Error("The assistant returned no answer. Please try again.");
      console.log("[AI] Streaming response complete");
      return text;
    }
    // Preserve every output item, including reasoning items, before providing corresponding outputs.
    input.push(...(response.output as ResponseInputItem[]));
    for (const call of calls) {
      emit({
        type: "tool_call_start",
        name: call.name,
        label: toolLabel(call.name),
        callId: call.call_id,
      });
      const result = await executeTool(call.name, call.arguments, {
        latestUserMessage,
      });
      try {
        onToolResult?.({ name: call.name, arguments: call.arguments, result });
      } catch (error) {
        console.error("[AI] Tool result listener failed", error);
      }
      const failed =
        typeof result === "object" &&
        result !== null &&
        "ok" in result &&
        result.ok === false;
      emit({
        type: "tool_call_complete",
        name: call.name,
        label: toolLabel(call.name),
        callId: call.call_id,
        ok: !failed,
      });
      input.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }
  }
  throw new Error(
    "This request needed too many steps. Please split it into smaller questions.",
  );
}
