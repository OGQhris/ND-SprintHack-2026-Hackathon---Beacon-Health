"use client";

import { FlaskConicalIcon, Loader2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_EMAIL_DELAY_SECONDS,
  MAX_EMAIL_DELAY_SECONDS,
} from "@/lib/demo-settings";
import { requestWorkspaceRefresh } from "@/lib/store/workspace-events";

export function ProfileMenu() {
  const [starting, setStarting] = useState(false);
  const [emailDelay, setEmailDelay] = useState(
    String(DEFAULT_EMAIL_DELAY_SECONDS),
  );
  const delaySeconds = Number(emailDelay);
  const validDelay =
    emailDelay.trim() !== "" &&
    Number.isInteger(delaySeconds) &&
    delaySeconds >= 0 &&
    delaySeconds <= MAX_EMAIL_DELAY_SECONDS;
  const inFlight = useRef(false);

  async function startDemo() {
    if (inFlight.current || !validDelay) return;
    inFlight.current = true;
    setStarting(true);
    try {
      const response = await fetch("/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delaySeconds }),
      });
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
      <DropdownMenuContent align="end" className="w-60">
        <div className="space-y-2 px-2 py-2">
          <label htmlFor="demo-email-delay" className="text-sm font-medium">
            Email delay (seconds)
          </label>
          <Input
            id="demo-email-delay"
            type="number"
            min={0}
            max={MAX_EMAIL_DELAY_SECONDS}
            step={1}
            value={emailDelay}
            disabled={starting}
            aria-invalid={!validDelay}
            aria-describedby="demo-email-delay-help"
            onChange={(event) => setEmailDelay(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Escape") event.stopPropagation();
            }}
          />
          <p id="demo-email-delay-help" className="text-xs text-ink-soft">
            0–{MAX_EMAIL_DELAY_SECONDS} seconds. Use 0 to send immediately.
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={starting || !validDelay}
          onSelect={() => void startDemo()}
        >
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
