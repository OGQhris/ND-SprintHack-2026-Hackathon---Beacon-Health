"use client";

import { ScanLineIcon } from "lucide-react";
import { usePlayback } from "@/components/verification/use-playback";
import { useVerificationRun } from "@/components/verification/use-verification-run";
import { ViewerStage } from "@/components/verification/viewer-stage";
import { ViewerTimeline, type ViewerMode } from "@/components/verification/viewer-timeline";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { VerificationRun } from "@/lib/verification-view";

type BodyProps = {
  run: VerificationRun | null;
  open: boolean;
  mode: ViewerMode;
  waiting: boolean;
  onReplay: () => void;
};

/** Keyed by run id in the parent, so playback restarts from the first step whenever a different run opens. */
function ViewerBody({ run, open, mode, waiting, onReplay }: BodyProps) {
  const playback = usePlayback(run?.steps.length ?? 0, open);
  const step = run?.steps[playback.index];
  const atEnd = !!run?.finishedAt && playback.index >= playback.count - 1;

  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_17rem]">
      <ViewerStage
        run={run}
        step={step}
        waiting={waiting}
        index={playback.index}
        count={playback.count}
        playing={playback.playing}
        atEnd={atEnd}
        onToggle={() => playback.toggle(atEnd)}
        onReplay={() => {
          playback.restart();
          onReplay();
        }}
        onScrub={playback.seek}
      />
      <ViewerTimeline run={run} index={playback.index} mode={mode} onSelect={playback.seek} />
    </div>
  );
}

/**
 * The browser-recording viewer, mounted once in the shell. Opens on the window events in
 * viewer-events.ts: a replay of a saved recording, or a live watch of a running verification.
 */
export function VerificationViewer() {
  const { open, run, replay, waiting, close, markReplay } = useVerificationRun();
  const mode: ViewerMode = replay ? "replay" : run?.finishedAt ? "recorded" : "live";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-full gap-0 overflow-y-auto bg-paper p-0 sm:max-w-[min(64rem,calc(100%-3rem))]">
        <header className="flex items-center gap-3 border-b border-rule px-4 py-4 pr-12 md:px-5">
          <span className="hidden size-10 shrink-0 items-center justify-center rounded-lg bg-seal-tint text-seal-strong sm:flex">
            <ScanLineIcon className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[10px] font-semibold tracking-wide text-ink-faint uppercase">Browser verification</span>
            <DialogTitle className="truncate text-lg font-semibold text-ink">{run?.employeeName ?? "Credential check"}</DialogTitle>
            <DialogDescription className="text-xs text-ink-faint">Watch the Michigan licensing lookup, step by step.</DialogDescription>
          </div>
        </header>

        <ViewerBody key={run?.id ?? "pending"} run={run} open={open} mode={mode} waiting={waiting} onReplay={markReplay} />

        <footer className="flex items-center justify-between gap-3 border-t border-rule px-4 py-2.5 text-[11px] text-ink-faint md:px-5">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-seal" />
            Actual browser screenshots. The cursor marks recorded targets.
          </span>
          <span className="hidden sm:inline">Checks continue when you close this window.</span>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
