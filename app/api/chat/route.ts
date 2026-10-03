import { z } from "zod";
import { db } from "@/lib/db";
import { getOpenAI, aiConfigured, safeAIErrorMessage } from "@/lib/openai";
import { currentSession, chatLocks } from "@/lib/ai/session";
import {
  runResponseLoop,
  sdkTransport,
  type ChatEvent,
} from "@/lib/ai/responseLoop";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { guardOrigin, safeError } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  const denied = guardOrigin(request);
  if (denied) return denied;
  if (!aiConfigured())
    return Response.json(
      {
        error:
          "Add OPENAI_API_KEY to .env.local and restart the development server to enable the assistant.",
        code: "KEY_MISSING",
      },
      { status: 503 },
    );
  try {
    const parsed = z
      .strictObject({ message: z.string().trim().min(1).max(6000) })
      .safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: "Please enter a message of 1–6,000 characters." },
        { status: 400 },
      );
    const session = await currentSession();
    if (!session)
      return Response.json(
        { error: "Start a new conversation and try again." },
        { status: 401 },
      );
    if (chatLocks.has(session.id))
      return Response.json(
        { error: "The assistant is still working on your previous message." },
        { status: 409 },
      );
    chatLocks.add(session.id);
    const abort = new AbortController();
    request.signal.addEventListener("abort", () => abort.abort(), {
      once: true,
    });
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        const emit = (event: ChatEvent) => {
          if (!closed)
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
              );
            } catch {
              closed = true;
              abort.abort();
            }
        };
        const heartbeat = setInterval(() => emit({ type: "heartbeat" }), 15000);
        try {
          await db.chatMessage.create({
            data: {
              sessionId: session.id,
              role: "user",
              content: parsed.data.message,
            },
          });
          const messages = await db.chatMessage.findMany({
            where: { sessionId: session.id },
            orderBy: { createdAt: "desc" },
            take: 40,
          });
          const history: ResponseInputItem[] = messages
            .reverse()
            .map((m) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
            }));
          const content = await runResponseLoop({
            transport: sdkTransport(getOpenAI()),
            history,
            latestUserMessage: parsed.data.message,
            emit,
            signal: abort.signal,
          });
          await db.chatMessage.create({
            data: { sessionId: session.id, role: "assistant", content },
          });
          emit({ type: "assistant_complete" });
        } catch (error) {
          console.error(
            "[AI] Request failed",
            error instanceof Error
              ? { name: error.name, message: safeAIErrorMessage(error) }
              : "Unknown error",
          );
          const status =
            typeof error === "object" && error !== null && "status" in error
              ? error.status
              : null;
          const message =
            status === 429
              ? "The assistant is temporarily rate limited. Try again in a moment."
              : status === 401
                ? "The OpenAI key was rejected. Check .env.local and restart the server."
                : abort.signal.aborted
                  ? "The response was interrupted. Please try again."
                  : "The assistant could not complete this request. Please try again; credential checks remain available on the dashboard.";
          emit({ type: "error", message });
          await db.chatMessage
            .create({
              data: {
                sessionId: session.id,
                role: "assistant",
                content: message,
              },
            })
            .catch(() => {});
        } finally {
          clearInterval(heartbeat);
          chatLocks.delete(session.id);
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
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return safeError(e, "Could not open the conversation. Please try again.");
  }
}
