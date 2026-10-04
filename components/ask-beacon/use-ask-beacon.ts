"use client";

import { useCallback, useSyncExternalStore } from "react";
import { askBeacon } from "@/lib/assistant/client";
import { threadStore } from "@/lib/assistant/thread-store";
import type { ChatActivity, ChatThread } from "@/lib/assistant/types";
import { requestWorkspaceRefresh } from "@/lib/store/workspace-events";

export const SUGGESTED_PROMPTS = [
  "Who needs attention?",
  "Who has licenses expiring in the next 30 days?",
  "Tell me about Kathryn Cell.",
  "Who reports to Christianna Davison?",
  "Verify Kathryn Cell.",
  "Which credentials were verified today?",
];

const HISTORY_LIMIT = 12;
const WRITING = "Writing your answer";
const FALLBACK_ERROR = "Ask Beacon could not answer right now.";

/** The in-flight reply per thread, so the thread view can offer Stop. */
const inFlight = new Map<string, AbortController>();

/** Aborts the pending reply in a thread, if any. The partial text stays in the bubble. */
export function stop(threadId: string) {
  inFlight.get(threadId)?.abort();
}

/** Earlier turns sent as context; the question itself is sent separately, so it is not repeated here. */
function historyOf(thread: ChatThread) {
  return thread.messages
    .filter((m) => !m.pending && !m.error && m.text.trim())
    .slice(-HISTORY_LIMIT)
    .map((m) => ({ role: m.role, text: m.text }));
}

function runningLabel(activities: ChatActivity[], streamed: string): string | undefined {
  const running = activities.find((a) => !a.done);
  if (running) return running.label;
  return streamed ? WRITING : undefined;
}

/** Threads, the active thread, the dock state, and `send` / `stop`, shared by the mini dock and the /ask page. */
export function useAskBeacon() {
  const snap = useSyncExternalStore(threadStore.subscribe, threadStore.getSnapshot, threadStore.getServerSnapshot);
  const active = snap.threads.find((t) => t.id === snap.activeId) ?? null;

  const send = useCallback(async (question: string, threadId?: string | null) => {
    const text = question.trim();
    if (!text) return;
    const current = threadStore.getSnapshot();
    const thread = (threadId && current.threads.find((t) => t.id === threadId)) || threadStore.createThread(text);
    if (inFlight.has(thread.id)) return;
    threadStore.setActive(thread.id);
    const history = historyOf(thread);
    const now = new Date().toISOString();
    threadStore.appendMessage(thread.id, { id: `u-${Date.now()}`, role: "user", text, at: now });
    const replyId = `a-${Date.now() + 1}`;
    threadStore.appendMessage(thread.id, { id: replyId, role: "assistant", text: "", at: now, pending: true });

    const controller = new AbortController();
    inFlight.set(thread.id, controller);
    let streamed = "";
    let activities: ChatActivity[] = [];
    const progress = () =>
      threadStore.updateMessage(thread.id, replyId, { text: streamed, activity: runningLabel(activities, streamed), activities });

    try {
      const answer = await askBeacon({
        question: text,
        history,
        threadId: thread.id,
        signal: controller.signal,
        onDelta: (t) => {
          streamed = t;
          progress();
        },
        onActivity: (a) => {
          activities = a;
          progress();
        },
        onToolComplete: ({ name }) => {
          if (name.startsWith("verify_")) requestWorkspaceRefresh();
        },
      });
      threadStore.updateMessage(thread.id, replyId, {
        text: answer.reply,
        rows: answer.rows,
        href: answer.href,
        mode: answer.mode,
        model: answer.model,
        activities: answer.activities,
        activity: undefined,
        pending: false,
      });
    } catch (error) {
      const stopped = controller.signal.aborted;
      threadStore.updateMessage(thread.id, replyId, {
        text: stopped ? streamed || "Response stopped." : error instanceof Error ? error.message : FALLBACK_ERROR,
        activities,
        activity: undefined,
        pending: false,
        error: !stopped,
      });
    } finally {
      if (inFlight.get(thread.id) === controller) inFlight.delete(thread.id);
    }
  }, []);

  /** Creates a thread for a first question and starts answering; returns the new thread id for routing. */
  const startThread = useCallback(
    (question: string): string | null => {
      const text = question.trim();
      if (!text) return null;
      const thread = threadStore.createThread(text);
      void send(text, thread.id);
      return thread.id;
    },
    [send],
  );

  return {
    threads: snap.threads,
    startThread,
    active,
    dockOpen: snap.dockOpen,
    setDockOpen: threadStore.setDockOpen,
    setActive: threadStore.setActive,
    deleteThread: threadStore.deleteThread,
    newThread: () => threadStore.setActive(null),
    send,
    stop,
  };
}
