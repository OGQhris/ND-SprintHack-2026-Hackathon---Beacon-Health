"use client";

import Link from "next/link";
import { ArrowRightIcon, SendHorizontalIcon, SquareIcon } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ActivityList } from "@/components/ask-beacon/message-activities";
import { AssistantMarkdown } from "@/components/ask-beacon/message-markdown";
import { SUGGESTED_PROMPTS } from "@/components/ask-beacon/use-ask-beacon";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import type { ChatMessage, ChatThread } from "@/lib/assistant/types";
import { formatDate } from "@/lib/data/format";
import { useStoreState } from "@/lib/store/credential-store";
import { cn } from "@/lib/utils";

type Props = {
  thread: ChatThread | null;
  onSend: (question: string) => void;
  /** Aborts the pending reply in this thread; the Stop button shows only when provided. */
  onStop?: (threadId: string) => void;
  compact?: boolean;
  onRowClick?: () => void;
  className?: string;
};

const NO_KEY_NOTE = "Answers come from built-in rules until OPENAI_API_KEY is set in .env.local and the server is restarted.";
const LIVE_NOTE = "Answers come from your credential data. Asking Beacon to verify someone runs a live check against the Michigan license lookup.";

function Message({ message, compact, onRowClick }: { message: ChatMessage; compact?: boolean; onRowClick?: () => void }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className={cn("max-w-[85%] rounded-lg bg-seal-tint px-3 py-2 whitespace-pre-wrap text-ink", compact ? "text-sm" : "text-[15px]")}>
          {message.text}
        </p>
      </div>
    );
  }
  const maxRows = compact ? 5 : 10;
  const hasText = message.text.trim().length > 0;
  return (
    <div className="flex flex-col gap-2">
      {message.pending ? (
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <Spinner className="text-seal" />
          {message.activity ?? "Checking credential data"}
        </p>
      ) : message.activities?.length ? (
        <ActivityList activities={message.activities} />
      ) : null}
      {hasText ? (
        message.error ? (
          <p className={cn("whitespace-pre-wrap text-status-failed-fg", compact ? "text-sm" : "text-[15px] leading-relaxed")}>{message.text}</p>
        ) : (
          <AssistantMarkdown text={message.text} compact={compact} />
        )
      ) : null}
      {message.rows && message.rows.length > 0 ? (
        <ul className="flex flex-col divide-y divide-rule rounded-lg border border-rule bg-paper">
          {message.rows.slice(0, maxRows).map((r) => (
            <li key={r.employeeId} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
              <Link href={`/employees/${r.employeeId}`} onClick={onRowClick} className="truncate font-medium text-ink underline-offset-4 hover:underline">
                {r.name}
              </Link>
              <span className="flex shrink-0 items-center gap-2">
                <span className="numeric text-xs text-ink-faint">{formatDate(r.expirationDate)}</span>
                <StatusBadge derived={{ status: r.status, tier: r.tier, daysUntil: r.daysUntil }} size="sm" />
              </span>
            </li>
          ))}
          {message.rows.length > maxRows ? <li className="px-3 py-1.5 text-xs text-ink-faint">and {message.rows.length - maxRows} more</li> : null}
        </ul>
      ) : null}
      <div className="flex items-center gap-3">
        {message.href && message.rows && message.rows.length > 1 ? (
          <Button asChild variant="link" size="sm" className="h-auto px-0">
            <Link href={message.href} onClick={onRowClick}>
              Show in the app
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        ) : null}
        {!message.pending && !message.error && message.mode ? (
          <span className="text-[11px] text-ink-faint">
            {message.mode === "llm" ? `${message.model ?? "Model"} on your credential data` : "Rule-based answer from your credential data"}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** One conversation: message list plus composer. Used at two sizes by the dock and the full page. */
export function ChatThreadView({ thread, onSend, onStop, compact, onRowClick, className }: Props) {
  const { aiConfigured } = useStoreState();
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const count = thread?.messages.length ?? 0;
  const lastLength = thread?.messages.at(-1)?.text.length ?? 0;
  const busy = thread?.messages.some((m) => m.pending) ?? false;

  // Follow the conversation as messages arrive and as a reply streams in.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, lastLength]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !draft.trim()) return;
    onSend(draft);
    setDraft("");
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div ref={scroller} className={cn("min-h-0 flex-1 overflow-y-auto", compact ? "px-4 py-3" : "px-1 py-4")}>
        <div className={cn("flex flex-col", compact ? "gap-3" : "gap-5")}>
          {!thread || thread.messages.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-ink-faint">Try asking</p>
              {SUGGESTED_PROMPTS.map((p) => (
                <Button key={p} variant="outline" size="sm" className="h-auto justify-start whitespace-normal bg-paper py-2 text-left" onClick={() => onSend(p)}>
                  {p}
                </Button>
              ))}
            </div>
          ) : (
            thread.messages.map((m) => <Message key={m.id} message={m} compact={compact} onRowClick={onRowClick} />)
          )}
        </div>
      </div>
      <form onSubmit={submit} className={cn("border-t border-rule", compact ? "px-3 py-2" : "px-1 py-3")}>
        <InputGroup className={cn("bg-paper", compact ? "h-10" : "h-12")}>
          <InputGroupInput
            placeholder={compact ? "Ask Beacon" : "Ask about expirations, a person, or who needs attention"}
            aria-label="Message Ask Beacon"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          {busy && onStop && thread ? (
            <InputGroupButton type="button" aria-label="Stop response" onClick={() => onStop(thread.id)}>
              <SquareIcon />
            </InputGroupButton>
          ) : (
            <InputGroupButton type="submit" aria-label="Send" disabled={!draft.trim() || busy}>
              <SendHorizontalIcon />
            </InputGroupButton>
          )}
        </InputGroup>
        {!aiConfigured ? (
          <p className="mt-2 text-[11px] text-ink-faint">{NO_KEY_NOTE}</p>
        ) : !compact ? (
          <p className="mt-2 text-[11px] text-ink-faint">{LIVE_NOTE}</p>
        ) : null}
      </form>
    </div>
  );
}
