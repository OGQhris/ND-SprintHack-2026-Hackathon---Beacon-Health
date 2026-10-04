import { z } from "zod";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { runResponseLoop, sdkTransport, type ChatEvent } from "@/lib/ai/responseLoop";
import { answerQuestion } from "@/lib/assistant/answer";
import { collectToolRows, mergeChatRows, toChatRows } from "@/lib/assistant/rows";
import type { AskResponse, ChatRow } from "@/lib/assistant/types";
import { loadWorkspace } from "@/lib/data/repository";
import { guardOrigin, safeError } from "@/lib/http";
import { aiConfigured, getOpenAI, OPENAI_MODEL, safeAIErrorMessage } from "@/lib/openai";
import type { StoreState, WorkspacePayload } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_IN_FLIGHT = 4;
const HEARTBEAT_MS = 15_000;
const BUSY_MESSAGE = "The assistant is still working on your previous message.";
const RULES_FAILURE = "Ask Beacon could not answer right now.";

const bodySchema = z.strictObject({
  question: z.string().trim().min(1).max(6000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(6000) }))
    .max(12)
    .optional(),
  threadId: z.string().max(80).optional(),
});

/** Threads with a question in flight. On globalThis so dev-server module reloads share one set. */
const shared = globalThis as unknown as { beaconAskLocks?: Set<string> };
const askLocks = (shared.beaconAskLocks ??= new Set<string>());

/** The rules engine reads the same shape the client store holds. */
function toStoreState(workspace: WorkspacePayload): StoreState {
  const { seed } = workspace;
  return {
    ...seed,
    resolvedAlertIds: [...seed.alertActions.resolvedAlertIds],
    reminders: { ...seed.alertActions.reminders },
    batch: workspace.batch,
    demo: workspace.demo,
    aiConfigured: workspace.aiConfigured,
    lastSyncedAt: workspace.generatedAt,
  };
}

function friendlyMessage(error: unknown, aborted: boolean): string {
  const status = typeof error === "object" && error !== null && "status" in error ? error.status : null;
  if (status === 429) return "The assistant is temporarily rate limited. Try again in a moment.";
  if (status === 401) return "The OpenAI key was rejected. Check .env.local and restart the server.";
  if (aborted) return "The response was interrupted. Please try again.";
  return "The assistant could not complete this request. Please try again; credential checks remain available on the dashboard.";
}

const STREAM_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

/**
 * POST /api/ask { question, history?, threadId? }
 * Without OPENAI_API_KEY: JSON AskResponse from the rule-based engine.
 * With a key: an SSE stream of ChatEvent frames ending in "answer" (rows, href, model, mode) then "assistant_complete".
 * Conversation history lives in the browser; nothing is written to ChatSession or ChatMessage here.
 */
export async function POST(request: Request) {
  const denied = guardOrigin(request);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Please enter a question of 1–6,000 characters." }, { status: 400 });
  const { question, history = [], threadId } = parsed.data;

  if (!aiConfigured()) {
    try {
      const answer = answerQuestion(question, toStoreState(await loadWorkspace()));
      const response: AskResponse = { reply: answer.summary, mode: "rules", rows: toChatRows(answer.rows), href: answer.href };
      return Response.json(response);
    } catch (e) {
      return safeError(e, RULES_FAILURE);
    }
  }

  const lockKey = threadId || "default";
  if (askLocks.has(lockKey)) return Response.json({ error: BUSY_MESSAGE }, { status: 409 });
  if (askLocks.size >= MAX_IN_FLIGHT)
    return Response.json({ error: "Ask Beacon is busy with other questions. Try again in a moment." }, { status: 429 });
  askLocks.add(lockKey);

  let today: string;
  try {
    today = (await loadWorkspace()).seed.today;
  } catch (e) {
    askLocks.delete(lockKey);
    return safeError(e, RULES_FAILURE);
  }

  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: ChatEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
          abort.abort();
        }
      };
      const heartbeat = setInterval(() => emit({ type: "heartbeat" }), HEARTBEAT_MS);
      let rows: ChatRow[] = [];
      let href: string | undefined;
      try {
        const input: ResponseInputItem[] = [
          ...history.map((m) => ({ role: m.role, content: m.text })),
          { role: "user", content: question },
        ];
        await runResponseLoop({
          transport: sdkTransport(getOpenAI()),
          history: input,
          latestUserMessage: question,
          emit,
          signal: abort.signal,
          onToolResult: ({ name, result }) => {
            const found = collectToolRows(name, result, today);
            rows = mergeChatRows(rows, found.rows);
            if (found.href) href = found.href;
          },
        });
        emit({ type: "answer", rows, href, model: OPENAI_MODEL, mode: "llm" });
        emit({ type: "assistant_complete" });
      } catch (error) {
        console.error(
          "[Ask] Request failed",
          error instanceof Error ? { name: error.name, message: safeAIErrorMessage(error) } : "Unknown error",
        );
        emit({ type: "error", message: friendlyMessage(error, abort.signal.aborted) });
      } finally {
        clearInterval(heartbeat);
        askLocks.delete(lockKey);
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, { headers: STREAM_HEADERS });
}
