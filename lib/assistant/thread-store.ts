"use client";

import type { ChatMessage, ChatThread } from "@/lib/assistant/types";

/**
 * Chat threads shared by the mini dock and the full /ask page. Lives in memory for the session and in
 * localStorage as a per-browser convenience; the credential data itself always comes from the server.
 * Streaming replies patch a message many times a second, so writes to storage are debounced and flushed
 * on the final patch and when the page is hidden.
 */
export type ThreadSnapshot = {
  threads: ChatThread[];
  activeId: string | null;
  dockOpen: boolean;
};

const STORAGE_KEY = "beacon.askBeacon.v1";
const PERSIST_DELAY_MS = 300;
const EMPTY: ThreadSnapshot = { threads: [], activeId: null, dockOpen: false };

let snapshot: ThreadSnapshot = EMPTY;
let hydrated = false;
let dirty = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function writeStorage() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ threads: snapshot.threads, activeId: snapshot.activeId, dockOpen: snapshot.dockOpen }),
    );
  } catch {
    // Storage can be unavailable (private mode); the session still works in memory.
  }
}

function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!dirty) return;
  dirty = false;
  writeStorage();
}

function schedulePersist() {
  dirty = true;
  if (persistTimer) return;
  persistTimer = setTimeout(flushPersist, PERSIST_DELAY_MS);
}

function hydrate() {
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ThreadSnapshot>;
      const threads = Array.isArray(parsed.threads) ? parsed.threads : [];
      // A reply that never arrived (page closed mid-request) becomes an error bubble instead of a spinner forever.
      for (const t of threads)
        for (const m of t.messages)
          if (m.pending) Object.assign(m, { pending: false, error: true, activity: undefined, text: m.text || "No answer was received." });
      snapshot = { threads, activeId: typeof parsed.activeId === "string" ? parsed.activeId : null, dockOpen: Boolean(parsed.dockOpen) };
    }
  } catch {
    snapshot = EMPTY;
  }
  window.addEventListener("pagehide", flushPersist);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPersist();
  });
}

function emit() {
  for (const l of listeners) l();
}

/** Every change produces a new snapshot object (useSyncExternalStore compares by identity). */
function update(next: ThreadSnapshot, persist: "now" | "soon" = "now") {
  snapshot = next;
  if (persist === "now") {
    dirty = true;
    flushPersist();
  } else {
    schedulePersist();
  }
  emit();
}

export const threadStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    if (!hydrated && typeof window !== "undefined") {
      hydrate();
      queueMicrotask(emit);
    }
    return () => listeners.delete(listener);
  },
  getSnapshot: () => snapshot,
  getServerSnapshot: () => EMPTY,

  setDockOpen(open: boolean) {
    update({ ...snapshot, dockOpen: open });
  },
  setActive(id: string | null) {
    update({ ...snapshot, activeId: id });
  },
  createThread(title: string): ChatThread {
    const now = new Date().toISOString();
    const thread: ChatThread = { id: `t-${Date.now()}`, title: title.slice(0, 80), createdAt: now, updatedAt: now, messages: [] };
    update({ ...snapshot, threads: [thread, ...snapshot.threads], activeId: thread.id });
    return thread;
  },
  deleteThread(id: string) {
    const threads = snapshot.threads.filter((t) => t.id !== id);
    update({ ...snapshot, threads, activeId: snapshot.activeId === id ? null : snapshot.activeId });
  },
  appendMessage(threadId: string, message: ChatMessage) {
    update({
      ...snapshot,
      threads: snapshot.threads.map((t) =>
        t.id === threadId ? { ...t, updatedAt: message.at, messages: [...t.messages, message] } : t,
      ),
    });
  },
  /** Streaming patches are written to storage lazily; the patch that ends a pending reply is written at once. */
  updateMessage(threadId: string, messageId: string, patch: Partial<ChatMessage>) {
    update(
      {
        ...snapshot,
        threads: snapshot.threads.map((t) =>
          t.id === threadId ? { ...t, messages: t.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)) } : t,
        ),
      },
      patch.pending === false ? "now" : "soon",
    );
  },
};
