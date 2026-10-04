"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Maximize2Icon, MessageSquareTextIcon, MinusIcon, PlusIcon } from "lucide-react";
import { ChatThreadView } from "@/components/ask-beacon/chat-thread";
import { useAskBeacon } from "@/components/ask-beacon/use-ask-beacon";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The mini chat: bottom-right, stays open while the manager navigates, and never blocks the page.
 * Hidden on the full /ask view and on phones (the sidebar item opens the full page there).
 */
export function AskBeaconDock() {
  const pathname = usePathname();
  const { active, dockOpen, setDockOpen, newThread, send, stop } = useAskBeacon();

  if (pathname.startsWith("/ask")) return null;

  if (!dockOpen) {
    return (
      <Button
        onClick={() => setDockOpen(true)}
        className="float-shadow fixed right-5 bottom-5 z-40 hidden h-10 rounded-full px-4 sm:inline-flex"
        aria-label="Open Ask Beacon"
      >
        <MessageSquareTextIcon data-icon="inline-start" />
        Ask Beacon
      </Button>
    );
  }

  return (
    <aside
      className="float-shadow fixed right-5 bottom-5 z-40 hidden h-[min(560px,calc(100vh-6rem))] w-[380px] flex-col overflow-hidden rounded-xl border border-rule bg-paper sm:flex"
      aria-label="Ask Beacon"
    >
      <header className="flex h-11 items-center gap-2 border-b border-rule px-3">
        <span aria-hidden className="flex size-6 items-center justify-center rounded-md bg-seal text-xs font-semibold text-white">
          B
        </span>
        <p className="truncate text-sm font-semibold text-ink">{active ? active.title : "Ask Beacon"}</p>
        <div className="ml-auto flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={newThread} aria-label="New chat" className="text-ink-soft">
                <PlusIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="ghost" size="icon-sm" aria-label="Open full view" className="text-ink-soft">
                <Link href={active ? `/ask?t=${active.id}` : "/ask"}>
                  <Maximize2Icon />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Full view and previous chats</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => setDockOpen(false)} aria-label="Minimize Ask Beacon" className="text-ink-soft">
                <MinusIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Minimize</TooltipContent>
          </Tooltip>
        </div>
      </header>
      <ChatThreadView thread={active} onSend={(q) => void send(q, active?.id)} onStop={stop} compact />
    </aside>
  );
}
