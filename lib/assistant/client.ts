import type { ChatEvent } from "@/lib/ai/responseLoop";
import type { AskResponse, ChatActivity, ChatRole, ChatRow } from "@/lib/assistant/types";
import { finishAssistantVerification, trackAssistantVerification } from "@/lib/store/assistant-verifications";

/**
 * Browser side of POST /api/ask. The server answers with JSON (rules mode, no OPENAI_API_KEY)
 * or a text/event-stream of ChatEvent frames ("data: <json>\n\n"); this module hides the difference.
 */

export const STREAM_INTERRUPTED = "The response stream was interrupted. Please try again.";

export type AskBeaconInput = {
  question: string;
  history: { role: ChatRole; text: string }[];
  threadId: string;
  signal?: AbortSignal;
  /** The accumulated reply text so far, after every text_delta. */
  onDelta: (text: string) => void;
  /** A fresh copy of the tool steps after every tool_call_start / tool_call_complete. */
  onActivity: (activities: ChatActivity[]) => void;
  /** A tool finished; the hook refreshes the workspace after verify_* tools. */
  onToolComplete?: (call: { name: string; ok: boolean }) => void;
};

export type AskBeaconResult = {
  reply: string;
  rows: ChatRow[];
  href?: string;
  mode: "llm" | "rules";
  model?: string;
  activities: ChatActivity[];
};

function parseFrame(frame: string): ChatEvent | null {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""));
  if (!data.length) return null;
  try {
    const parsed: unknown = JSON.parse(data.join("\n"));
    if (typeof parsed !== "object" || parsed === null) return null;
    return typeof (parsed as { type?: unknown }).type === "string" ? (parsed as ChatEvent) : null;
  } catch {
    return null;
  }
}

/**
 * Pure SSE parser. Feed it the unparsed tail from the previous call plus the new chunk; it returns every
 * complete frame as an event and the incomplete tail to carry into the next call. Frames end with a blank line.
 */
export function parseEventStreamChunk(buffer: string, chunk: string): { events: ChatEvent[]; rest: string } {
  const frames = (buffer + chunk).replace(/\r\n/g, "\n").split("\n\n");
  const rest = frames.pop() ?? "";
  const events: ChatEvent[] = [];
  for (const frame of frames) {
    const event = parseFrame(frame);
    if (event) events.push(event);
  }
  return { events, rest };
}

type StreamState = {
  text: string;
  rows: ChatRow[];
  href?: string;
  mode: "llm" | "rules";
  model?: string;
  activities: ChatActivity[];
  complete: boolean;
};

function applyEvent(event: ChatEvent, state: StreamState, input: AskBeaconInput): void {
  switch (event.type) {
    case "text_delta":
      state.text += event.text ?? "";
      input.onDelta(state.text);
      return;
    case "tool_call_start":
      if (event.name === "verify_employee_credential" && event.employeeId && event.startedAt) {
        trackAssistantVerification(`${input.threadId}:${event.callId}`, event.employeeId, event.startedAt);
      }
      state.activities = [
        ...state.activities,
        {
          id: event.callId ?? `${event.name ?? "tool"}-${state.activities.length}`,
          label: event.label ?? event.name ?? "Checking credential data",
          done: false,
          ok: true,
          name: event.name,
          employeeId: event.employeeId,
          startedAt: event.startedAt,
        },
      ];
      input.onActivity(state.activities);
      return;
    case "tool_call_complete": {
      if (event.name === "verify_employee_credential") finishAssistantVerification(`${input.threadId}:${event.callId}`);
      const ok = event.ok !== false;
      const index = event.callId
        ? state.activities.findIndex((a) => a.id === event.callId)
        : state.activities.findIndex((a) => !a.done);
      state.activities = state.activities.map((a, i) => (i === index ? { ...a, done: true, ok, recordingId: event.recordingId } : a));
      input.onActivity(state.activities);
      input.onToolComplete?.({ name: event.name ?? "", ok });
      return;
    }
    case "answer":
      state.rows = event.rows ?? [];
      state.href = event.href;
      state.model = event.model;
      state.mode = event.mode ?? "llm";
      return;
    case "error":
      throw new Error(event.message || "The assistant could not complete this request. Please try again.");
    case "assistant_complete":
      state.complete = true;
      return;
    default:
      return;
  }
}

async function readAnswerStream(body: ReadableStream<Uint8Array>, input: AskBeaconInput): Promise<AskBeaconResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const state: StreamState = { text: "", rows: [], mode: "llm", activities: [], complete: false };
  let rest = "";
  try {
    while (!state.complete) {
      const { value, done } = await reader.read();
      if (done) break;
      const parsed = parseEventStreamChunk(rest, decoder.decode(value, { stream: true }));
      rest = parsed.rest;
      for (const event of parsed.events) applyEvent(event, state, input);
    }
    if (!state.complete) {
      // A final frame without its trailing blank line still counts.
      const tail = parseEventStreamChunk(rest, `${decoder.decode()}\n\n`);
      for (const event of tail.events) applyEvent(event, state, input);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  if (!state.complete) throw new Error(STREAM_INTERRUPTED);
  return {
    reply: state.text,
    rows: state.rows,
    href: state.href,
    mode: state.mode,
    model: state.model,
    activities: state.activities,
  };
}

/** Asks the server one question and resolves with the finished reply; progress arrives through the handlers. */
export async function askBeacon(input: AskBeaconInput): Promise<AskBeaconResult> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream, application/json" },
    body: JSON.stringify({ question: input.question, history: input.history, threadId: input.threadId }),
    signal: input.signal,
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: unknown } | null;
    const error = json && typeof json.error === "string" ? json.error : "";
    throw new Error(error || `Ask Beacon answered ${res.status}.`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await res.json()) as AskResponse;
    return { reply: json.reply, rows: json.rows ?? [], href: json.href, mode: json.mode, model: json.model, activities: [] };
  }
  if (!res.body) throw new Error(STREAM_INTERRUPTED);
  return readAnswerStream(res.body, input);
}
