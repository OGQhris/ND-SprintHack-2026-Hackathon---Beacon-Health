"use client";

import { CircleStopIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useStoreState } from "@/lib/store/credential-store";
import { requestWorkspaceRefresh } from "@/lib/store/workspace-events";
import { cn } from "@/lib/utils";

async function requestStop(): Promise<void> {
  const res = await fetch("/api/verify-all", { method: "DELETE" });
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(json?.error ?? `The server answered ${res.status}.`);
}

/** Shown on every page while a server-side roster check (Verify all, Verify selected, or the assistant) is running. */
export function BatchBanner({ className }: { className?: string }) {
  const { batch } = useStoreState();
  const [stopping, setStopping] = useState(false);

  if (!batch?.running) return null;

  const percent = batch.total > 0 ? Math.min(100, Math.round((batch.completed / batch.total) * 100)) : 0;

  const stop = async () => {
    setStopping(true);
    try {
      await requestStop();
      requestWorkspaceRefresh();
    } catch (error) {
      toast.error("The roster check could not be stopped", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    } finally {
      setStopping(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("float-shadow flex flex-col gap-3 rounded-lg border border-rule bg-paper px-4 py-3", className)}
    >
      <div className="flex flex-wrap items-start gap-3">
        <Spinner className="mt-0.5 text-seal" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-sm font-semibold text-ink">Checking your team with Michigan MILARA</p>
          <p className="numeric text-xs text-ink-faint">
            {batch.completed} / {batch.total} checks complete · {batch.currentEmployee ?? "Preparing the next check"}
          </p>
        </div>
        {batch.stopRequested ? (
          <span className="flex h-7 items-center text-xs font-medium text-ink-faint">Stopping after the current check</span>
        ) : (
          <Button variant="ghost" size="sm" disabled={stopping} onClick={() => void stop()} className="text-ink-soft">
            <CircleStopIcon data-icon="inline-start" />
            Stop after this one
          </Button>
        )}
      </div>
      <Progress value={percent} aria-label="Credential verification progress" className="h-1 bg-rule" />
    </div>
  );
}
