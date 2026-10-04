"use client";

import { Maximize2Icon, ScanLineIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { usePlayback } from "@/components/verification/use-playback";
import { ViewerStage } from "@/components/verification/viewer-stage";
import { openVerificationReplay } from "@/components/verification/viewer-events";
import { Button } from "@/components/ui/button";
import type { ChatActivity } from "@/lib/assistant/types";
import type { VerificationRun } from "@/lib/verification-view";

function PreviewPlayback({ run, ready, activityId, onComplete }: { run: VerificationRun; ready: boolean; activityId: string; onComplete: (id: string) => void }) {
  const playback = usePlayback(run.steps.length, ready);
  const atEnd = !!run.finishedAt && playback.index >= playback.count - 1;
  useEffect(() => {
    if (!ready || !atEnd) return;
    // Hold the final frame long enough for the cursor movement and result caption.
    const timer = setTimeout(() => onComplete(activityId), 750);
    return () => clearTimeout(timer);
  }, [ready, atEnd, activityId, onComplete]);
  return (
    <ViewerStage
      compact
      hideControls
      run={run}
      step={run.steps[playback.index]}
      waiting={false}
      index={playback.index}
      count={playback.count}
      playing={playback.playing}
      atEnd={atEnd}
      onToggle={() => playback.toggle(atEnd)}
      onReplay={playback.restart}
      onScrub={playback.seek}
      onExpand={() => openVerificationReplay(run.id)}
    />
  );
}

/** Follow this tool call's recording and retain its preview in chat history. */
export function VerificationPreview({
  activity,
  employeeName,
  onComplete,
}: {
  activity: ChatActivity;
  employeeName: string;
  onComplete: (id: string) => void;
}) {
  const [run, setRun] = useState<VerificationRun | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1000;
    const timer = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (unavailable && ready) onComplete(activity.id);
  }, [unavailable, ready, activity.id, onComplete]);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let runId = activity.recordingId;
    const deadline = Date.now() + 120_000;
    const controller = new AbortController();
    async function poll() {
      try {
        if (!runId) {
          const response = await fetch("/api/verification-runs", {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("Unavailable");
          const { runs } = (await response.json()) as {
            runs: VerificationRun[];
          };
          runId = runs
            .filter(
              (r) =>
                r.employeeId === activity.employeeId &&
                (!activity.startedAt || r.startedAt >= activity.startedAt),
            )
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]?.id;
        }
        if (runId) {
          const response = await fetch(
            `/api/verification-runs/${encodeURIComponent(runId)}`,
            { cache: "no-store", signal: controller.signal },
          );
          if (response.status === 404 && activity.done) {
            if (!cancelled) setUnavailable(true);
            return;
          }
          if (!response.ok) throw new Error("Unavailable");
          const next = (await response.json()) as VerificationRun;
          if (cancelled) return;
          setRun(next);
          if (next.finishedAt) return;
        } else if (activity.done) {
          if (!cancelled) setUnavailable(true);
          return;
        }
      } catch {
        /* Keep the last frame on transient polling failures. */
      }
      if (cancelled) return;
      if (Date.now() >= deadline) {
        setUnavailable(true);
        return;
      }
      timer = setTimeout(() => void poll(), 900);
    }
    void poll();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    activity.employeeId,
    activity.startedAt,
    activity.recordingId,
    activity.done,
  ]);

  return (
    <section
      aria-label={`Verification preview for ${employeeName}`}
      className="agent-preview relative w-full max-w-lg overflow-hidden rounded-xl border border-seal/25 bg-paper"
    >
      <svg
        aria-hidden
        className="agent-preview-outline pointer-events-none absolute inset-0 z-[60] size-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <rect
          x="0.5"
          y="0.5"
          width="99"
          height="99"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          pathLength="1"
        />
      </svg>
      <header className="flex min-w-0 items-center gap-2 border-b border-rule px-3 py-2">
        <ScanLineIcon className="size-4 shrink-0 text-seal" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="agent-preview-typing text-[10px] font-semibold text-seal">
            {run ? (run.finishedAt ? "Recorded verification" : "Live browser verification") : "Opening browser preview…"}
          </p>
          <p className="truncate text-xs font-medium text-ink">
            {employeeName}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!run}
          aria-label="Enlarge browser verification"
          onClick={() => run && openVerificationReplay(run.id)}
        >
          <Maximize2Icon />
        </Button>
      </header>
      <div className="agent-preview-reveal">
        {run ? (
          <PreviewPlayback key={run.id} run={run} ready={ready} activityId={activity.id} onComplete={onComplete} />
        ) : (
          <div
            className="flex aspect-[1.44] items-center justify-center bg-folder-inset px-5 text-center text-xs text-ink-faint"
            role="status"
          >
            {unavailable
              ? "No browser recording is available for this tool call."
              : "Waiting for the licensing browser to connect…"}
          </div>
        )}
      </div>
    </section>
  );
}
