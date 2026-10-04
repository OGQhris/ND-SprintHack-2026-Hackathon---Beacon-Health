"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, MessageSquareTextIcon, SendHorizontalIcon, Trash2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ChatThreadView } from "@/components/ask-beacon/chat-thread";
import { SUGGESTED_PROMPTS, useAskBeacon } from "@/components/ask-beacon/use-ask-beacon";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { formatDateTime } from "@/lib/data/format";

/** Full-screen Ask Beacon: a big composer in the middle with previous chats underneath, or one open thread. */
export function AskPageView({ threadId }: { threadId?: string }) {
  const router = useRouter();
  const { threads, send, stop, startThread, deleteThread, setActive } = useAskBeacon();
  const [draft, setDraft] = useState("");
  const open = threadId ? threads.find((t) => t.id === threadId) ?? null : null;

  function startChat(question: string) {
    const id = startThread(question);
    if (!id) return;
    setDraft("");
    router.push(`/ask?t=${id}`);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    startChat(draft);
  }

  if (open) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-ink-soft">
            <Link href="/ask">
              <ArrowLeftIcon data-icon="inline-start" />
              All chats
            </Link>
          </Button>
          <h1 className="truncate text-sm font-medium text-ink">{open.title}</h1>
          <Button
            variant="ghost"
            size="sm"
            className="text-ink-soft"
            onClick={() => {
              deleteThread(open.id);
              router.push("/ask");
            }}
          >
            <Trash2Icon data-icon="inline-start" />
            Delete
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-rule bg-paper px-4">
          <ChatThreadView thread={open} onSend={(q) => void send(q, open.id)} onStop={stop} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-10 overflow-y-auto overscroll-contain pt-6 md:pt-14">
      <div className="flex flex-col items-center gap-6 text-center">
        <span aria-hidden className="flex size-12 items-center justify-center rounded-xl bg-seal text-lg font-semibold text-white">
          B
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] leading-8 font-semibold tracking-[-0.02em] text-ink">Ask Beacon</h1>
          <p className="text-sm text-ink-soft">Ask about expirations, who needs attention, or anyone by name. Beacon can also run a license check for you.</p>
        </div>
        <form onSubmit={submit} className="w-full">
          <InputGroup className="h-12 bg-paper">
            <InputGroupInput
              autoFocus
              placeholder="Who has a license expiring in the next 30 days?"
              aria-label="Message Ask Beacon"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <InputGroupButton type="submit" aria-label="Send" disabled={!draft.trim()}>
              <SendHorizontalIcon />
            </InputGroupButton>
          </InputGroup>
        </form>
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTED_PROMPTS.map((p) => (
            <Button key={p} variant="outline" size="sm" className="bg-paper" onClick={() => startChat(p)}>
              {p}
            </Button>
          ))}
        </div>
      </div>

      <section className="flex flex-col gap-3" aria-label="Previous chats">
        <h2 className="text-sm font-semibold text-ink">Previous chats</h2>
        {threads.length === 0 ? (
          <EmptyState icon={MessageSquareTextIcon} title="No chats yet" description="Your conversations will appear here so you can pick them back up." />
        ) : (
          <ul className="flex flex-col gap-2">
            {threads.map((t) => {
              const last = t.messages.filter((m) => m.role === "assistant" && !m.pending).at(-1);
              return (
                <li key={t.id}>
                  <Link
                    href={`/ask?t=${t.id}`}
                    onClick={() => setActive(t.id)}
                    className="flex flex-col gap-1 rounded-lg border border-rule bg-paper px-4 py-3 outline-none hover:bg-folder-hover focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-ink">{t.title}</p>
                      <time className="numeric shrink-0 text-xs text-ink-faint" dateTime={t.updatedAt}>
                        {formatDateTime(t.updatedAt)}
                      </time>
                    </div>
                    {last ? <p className="line-clamp-2 text-sm text-ink-soft">{last.text}</p> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
