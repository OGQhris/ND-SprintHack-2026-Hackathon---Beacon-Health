"use client";

import { GlobeIcon, MousePointer2Icon, PauseIcon, PlayIcon, RotateCcwIcon, ScanLineIcon, ShieldCheckIcon } from "lucide-react";
import { ViewerFrame } from "@/components/verification/viewer-frame";
import { Button } from "@/components/ui/button";
import type { VerificationRun, VerificationStep } from "@/lib/verification-view";
import { cn } from "@/lib/utils";

type Props = {
  run: VerificationRun | null;
  step: VerificationStep | undefined;
  waiting: boolean;
  index: number;
  count: number;
  playing: boolean;
  atEnd: boolean;
  onToggle: () => void;
  onReplay: () => void;
  onScrub: (index: number) => void;
};

const MOVE = "motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out";

function pct(fraction: number): string {
  return `${fraction * 100}%`;
}

function Placeholder({ run, waiting }: { run: VerificationRun | null; waiting: boolean }) {
  const empty = !!run?.finishedAt && run.steps.length === 0;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <span
        className={cn(
          "flex size-16 items-center justify-center rounded-full border border-rule bg-folder-inset text-seal",
          !empty && "motion-safe:animate-pulse",
        )}
      >
        <GlobeIcon className="size-7" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-ink">
        {empty ? "No browser frames were captured" : "Connecting to Michigan MILARA"}
      </p>
      <p className="text-xs text-ink-faint">
        {empty
          ? "The check ended before the browser could take a screenshot. The result is in the timeline."
          : waiting
            ? "Waiting for the browser session to start."
            : "Preparing the secure browser session."}
      </p>
    </div>
  );
}

export function ViewerStage({ run, step, waiting, index, count, playing, atEnd, onToggle, onReplay, onScrub }: Props) {
  const target = step?.target;
  const cursorX = target?.x ?? 0.5;
  const cursorY = target?.y ?? 0.5;

  return (
    <div className="flex min-w-0 flex-col gap-3 bg-folder-inset p-4 md:p-5">
      <div className="float-shadow overflow-hidden rounded-lg border border-rule bg-paper">
        <div className="flex items-center gap-3 border-b border-rule px-3 py-2 text-[11px] text-ink-soft">
          <span aria-hidden className="flex gap-1">
            <i className="size-1.5 rounded-full bg-rule" />
            <i className="size-1.5 rounded-full bg-rule" />
            <i className="size-1.5 rounded-full bg-rule" />
          </span>
          <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 truncate rounded-md bg-folder-inset px-2 py-1 font-medium">
            <GlobeIcon className="size-3 shrink-0" aria-hidden />
            aca-prod.accela.com / MILARA
          </span>
          <ShieldCheckIcon className="size-3.5 shrink-0 text-seal" aria-hidden />
        </div>

        <div className="relative isolate aspect-[1.44] w-full overflow-hidden bg-paper">
          {!step ? <Placeholder run={run} waiting={waiting} /> : null}
          {step?.frameUrl ? <ViewerFrame src={step.frameUrl} label={step.label} /> : null}

          {target ? (
            <div
              aria-hidden
              className={cn("pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-seal/70 bg-seal/10", MOVE)}
              style={{
                left: pct(target.x),
                top: pct(target.y),
                width: pct(Math.max(target.width, 0.02)),
                height: pct(Math.max(target.height, 0.02)),
              }}
            />
          ) : null}

          <div
            aria-hidden
            className={cn("pointer-events-none absolute z-30", MOVE, target ? "opacity-100" : "opacity-0")}
            style={{ left: pct(cursorX), top: pct(cursorY) }}
          >
            <MousePointer2Icon className="size-6 fill-seal stroke-white drop-shadow-sm md:size-7" strokeWidth={1.5} />
            {step?.kind === "click" ? (
              <span
                key={step.index}
                className="absolute top-0 left-0 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-seal motion-safe:animate-out motion-safe:fade-out motion-safe:zoom-out-150 motion-safe:duration-1000 motion-safe:fill-mode-forwards motion-reduce:hidden"
              />
            ) : null}
          </div>

          {step ? (
            <div
              key={step.index}
              className="absolute bottom-3 left-1/2 z-40 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-lg bg-ink/90 px-3 py-2 text-[11px] text-white shadow-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
            >
              {step.kind === "click" ? <MousePointer2Icon className="size-3.5 shrink-0" aria-hidden /> : <ScanLineIcon className="size-3.5 shrink-0" aria-hidden />}
              <span className="truncate">{step.label}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-ink-soft"
          aria-label={playing && !atEnd ? "Pause playback" : "Play playback"}
          disabled={count === 0}
          onClick={onToggle}
        >
          {playing && !atEnd ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button variant="ghost" size="icon-sm" className="text-ink-soft" aria-label="Replay from beginning" disabled={count === 0} onClick={onReplay}>
          <RotateCcwIcon />
        </Button>
        <input
          type="range"
          aria-label="Verification timeline"
          min={0}
          max={Math.max(count - 1, 0)}
          value={index}
          disabled={count === 0}
          onChange={(event) => onScrub(Number(event.target.value))}
          className="h-1 min-w-0 flex-1 cursor-pointer accent-seal disabled:cursor-default"
        />
        <span className="numeric w-12 text-right text-[11px] text-ink-faint">
          {count ? index + 1 : 0} / {count}
        </span>
      </div>
    </div>
  );
}
