"use client";

import { format, parseISO } from "date-fns";
import { CheckIcon, CircleIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/data/format";
import type { VerificationRun } from "@/lib/verification-view";
import { cn } from "@/lib/utils";

export type ViewerMode = "live" | "recorded" | "replay";

type Props = {
  run: VerificationRun | null;
  index: number;
  mode: ViewerMode;
  onSelect: (index: number) => void;
};

const STATE_LABEL: Record<string, string> = {
  VERIFIED: "Verified",
  NEEDS_REVIEW: "Needs review",
  NOT_FOUND: "No record found",
  ERROR: "Verification failed",
  VERIFYING: "Verifying",
};

const RESULT_TONE: Record<"verified" | "review" | "failed", string> = {
  verified: "border-status-active-dot/30 bg-status-active-bg text-status-active-fg",
  review: "border-status-review-dot/30 bg-status-review-bg text-status-review-fg",
  failed: "border-status-failed-dot/30 bg-status-failed-bg text-status-failed-fg",
};

function stateLabel(state: string): string {
  return STATE_LABEL[state] ?? state.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function ModeBadge({ mode }: { mode: ViewerMode }) {
  const live = mode === "live";
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[10px] font-semibold tracking-wide",
        live ? "border-seal/30 bg-seal-tint text-seal-strong" : "border-rule bg-paper text-ink-faint",
      )}
    >
      {live ? <span aria-hidden className="size-1.5 rounded-full bg-seal motion-safe:animate-pulse" /> : null}
      {mode.toUpperCase()}
    </span>
  );
}

function ResultPanel({ run }: { run: VerificationRun }) {
  const tone = run.state === "VERIFIED" ? "verified" : run.state === "ERROR" ? "failed" : "review";
  const Icon = tone === "verified" ? ShieldCheckIcon : TriangleAlertIcon;
  return (
    <div className={cn("mt-auto flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-xs", RESULT_TONE[tone])}>
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Icon className="size-4 shrink-0" aria-hidden />
        {stateLabel(run.state)}
      </p>
      {run.result ? (
        <dl className="numeric flex flex-col gap-1">
          <div className="flex justify-between gap-3">
            <dt className="opacity-80">License</dt>
            <dd className="font-medium">{run.result.licenseNumber ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="opacity-80">Status</dt>
            <dd className="font-medium">{run.result.status ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="opacity-80">Expires</dt>
            <dd className="font-medium">{formatDate(run.result.expirationDate ?? undefined)}</dd>
          </div>
        </dl>
      ) : (
        <p className="leading-relaxed opacity-90">
          {run.error || "No unique matching RN license was confirmed. Review the audit for details."}
        </p>
      )}
      <p className="text-[10px] opacity-70">Saved to verification history</p>
    </div>
  );
}

export function ViewerTimeline({ run, index, mode, onSelect }: Props) {
  const steps = run?.steps ?? [];
  const finished = !!run?.finishedAt;

  return (
    <aside className="flex min-h-0 flex-col gap-3 border-t border-rule bg-paper p-4 md:border-t-0 md:border-l" aria-label="Verification activity">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold tracking-wide text-ink-faint uppercase">Activity</span>
        <span className="numeric text-[11px] text-ink-ghost">
          {steps.length} {steps.length === 1 ? "step" : "steps"}
        </span>
        <span className="ml-auto">
          <ModeBadge mode={mode} />
        </span>
      </div>

      <ol className="flex max-h-44 flex-col gap-0.5 overflow-y-auto md:max-h-[22rem]">
        {steps.map((s, i) => {
          const current = i === index;
          const done = i < index;
          return (
            <li key={s.index}>
              <button
                type="button"
                aria-current={current ? "step" : undefined}
                onClick={() => onSelect(i)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs leading-snug transition-colors hover:bg-folder-hover",
                  current ? "border-rule bg-folder-inset text-ink" : done ? "text-ink-soft" : "text-ink-faint",
                )}
              >
                <span
                  className={cn(
                    "mt-px flex size-5 shrink-0 items-center justify-center rounded-full",
                    current || done ? "bg-seal-tint text-seal-strong" : "bg-folder-inset text-ink-ghost",
                  )}
                >
                  {done ? (
                    <CheckIcon className="size-3" aria-hidden />
                  ) : current && !finished ? (
                    <Spinner className="size-3" aria-hidden />
                  ) : (
                    <CircleIcon className="size-2.5" aria-hidden />
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span>{s.label}</span>
                  <time dateTime={s.timestamp} className="numeric text-[10px] text-ink-ghost">
                    {format(parseISO(s.timestamp), "h:mm:ss a")}
                  </time>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {run && finished ? (
        <ResultPanel run={run} />
      ) : (
        <p className="mt-auto flex items-center gap-1.5 text-[11px] text-ink-faint">
          <Spinner className="size-3" aria-hidden />
          {run ? "Browser is checking the state source" : "Waiting for the browser session to start"}
        </p>
      )}
    </aside>
  );
}
