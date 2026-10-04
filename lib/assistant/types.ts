import type { CredentialStatus, ExpiryTier } from "@/lib/types";

/** A compact, serializable employee reference the assistant can show as a chip. */
export type ChatRow = {
  employeeId: string;
  name: string;
  group: string;
  status: CredentialStatus;
  tier: ExpiryTier;
  daysUntil: number | null;
  expirationDate?: string;
};

export type ChatRole = "user" | "assistant";

/** One tool step the assistant took while answering, shown as a small checklist under the reply. */
export type ChatActivity = {
  id: string;
  label: string;
  done: boolean;
  ok: boolean;
  name?: string;
  employeeId?: string;
  startedAt?: string;
  recordingId?: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  at: string;
  rows?: ChatRow[];
  href?: string;
  /** How the answer was produced: a language model or the built-in rules. */
  mode?: "llm" | "rules";
  model?: string;
  pending?: boolean;
  error?: boolean;
  /** What the assistant is doing right now (the running tool, or "Writing your answer"); only while pending. */
  activity?: string;
  /** Every tool step taken for this reply, in order. */
  activities?: ChatActivity[];
};

export type ChatThread = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export type AskRequest = {
  question: string;
  history?: { role: ChatRole; text: string }[];
  /** Client thread id; the server allows one in-flight question per thread. */
  threadId?: string;
};

export type AskResponse = {
  reply: string;
  mode: "llm" | "rules";
  model?: string;
  rows: ChatRow[];
  href?: string;
};
