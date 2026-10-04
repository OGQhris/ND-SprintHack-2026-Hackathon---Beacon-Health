import { CircleCheckIcon, ExternalLinkIcon, RotateCcwIcon, SearchCheckIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/data/format";
import { SOURCE_META } from "@/lib/data/sources";
import type { VerificationOutcome } from "@/lib/types";
import { cn } from "@/lib/utils";
import { outcomeTitle } from "@/components/verify/commit-verification";

type Props = {
  outcome: VerificationOutcome;
  sourceLink?: string;
  onRetry: () => void;
  onDismiss: () => void;
  className?: string;
};

function description(outcome: VerificationOutcome): string {
  switch (outcome.kind) {
    case "verified": {
      const c = outcome.credential;
      return `${c.credentialType}${c.credentialNumber ? ` ${c.credentialNumber}` : ""} is on file with ${SOURCE_META[c.source].label}${
        c.expirationDate ? ` and expires ${formatDate(c.expirationDate)}` : ""
      }. The record and history below are updated.`;
    }
    case "needs_review":
      switch (outcome.reason) {
        case "multiple_matches":
          return "More than one license matched this name. Open the credential source and confirm the right person before relying on this record.";
        case "no_record_found":
          return "No license matched this name. Check the spelling of the first and last name against the license, then try again or look the person up directly.";
        default:
          return "The source returned a credential that does not match what is on file. A manager should review it before relying on it.";
      }
    case "verification_failed":
      switch (outcome.reason) {
        case "source_unavailable":
          return "The credential source could not be reached. Nothing on this record changed. Try again in a moment.";
        case "timeout":
          return "The credential source did not respond in time. Nothing on this record changed. Try again in a moment.";
        default:
          return "The verification did not complete. Nothing on this record changed.";
      }
  }
}

const TONE: Record<VerificationOutcome["kind"], string> = {
  verified: "border-status-active-dot/30 bg-status-active-bg text-status-active-fg",
  needs_review: "border-status-review-dot/30 bg-status-review-bg text-status-review-fg",
  verification_failed: "border-status-failed-dot/30 bg-status-failed-bg text-status-failed-fg",
};

export function VerificationResult({ outcome, sourceLink, onRetry, onDismiss, className }: Props) {
  const Icon = outcome.kind === "verified" ? CircleCheckIcon : outcome.kind === "needs_review" ? SearchCheckIcon : TriangleAlertIcon;
  const showSource = outcome.kind !== "verified" && sourceLink;

  return (
    <div className={cn("flex flex-col gap-3 rounded-md border px-3 py-2.5", TONE[outcome.kind], className)} role="status">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-semibold">
            {outcomeTitle(outcome)}
            {outcome.mode === "simulated" ? <span className="ml-2 text-[10px] font-semibold tracking-wide opacity-70">Simulated</span> : null}
          </p>
          <p className="text-sm opacity-90">{description(outcome)}</p>
          {outcome.kind !== "verified" && outcome.detail ? (
            <p className="text-xs opacity-80">Source said: {outcome.detail}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {outcome.kind === "verified" ? (
          <Button variant="outline" size="sm" onClick={onDismiss} className="bg-paper">
            Done
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={onRetry} className="bg-paper">
              <RotateCcwIcon data-icon="inline-start" />
              Retry
            </Button>
            {showSource ? (
              <Button asChild variant="outline" size="sm" className="bg-paper">
                <a href={sourceLink} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon data-icon="inline-start" />
                  {outcome.kind === "needs_review" ? "Review manually" : "Open credential source"}
                </a>
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
