"use client";

import { FlaskConicalIcon, Loader2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { requestWorkspaceRefresh } from "@/lib/store/workspace-events";

export function ProfileMenu() {
  const [starting, setStarting] = useState(false);
  const inFlight = useRef(false);

  async function startDemo() {
    if (inFlight.current) return;
    inFlight.current = true;
    setStarting(true);
    try {
      const response = await fetch("/api/demo/start", { method: "POST" });
      const result = await response.json();
      if (result.samplesAdded) requestWorkspaceRefresh();
      if (!response.ok)
        throw new Error(result.error || "Could not start the demo.");
    } catch (error) {
      toast.error("Demo notification failed", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setStarting(false);
      inFlight.current = false;
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="BM account menu"
          aria-busy={starting}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-seal-strong focus-visible:ring-offset-2"
        >
          <Avatar size="default">
            <AvatarFallback className="bg-seal-tint text-xs font-semibold text-seal-strong">
              BM
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem disabled={starting} onSelect={() => void startDemo()}>
          {starting ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <FlaskConicalIcon />
          )}
          {starting ? "Starting demo…" : "Start demo"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
