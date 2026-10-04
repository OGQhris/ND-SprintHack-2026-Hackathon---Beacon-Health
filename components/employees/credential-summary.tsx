import type { ReactNode } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { CredentialFacts } from "@/components/employees/credential-facts";
import { ExpiryRunway } from "@/components/shared/expiry-runway";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDaysAgo } from "@/lib/data/format";
import { REASON_LABEL, statusDetail } from "@/lib/data/status";
import type { Credential, DerivedStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  credential: Credential;
  derived: DerivedStatus;
  today: string;
  /** Verify Now button, progress rail, or result callout. */
  verifySlot: ReactNode;
  className?: string;
};

const NOT_YET_VERIFIED =
  "This license has not been checked against the source yet. Run Verify now to pull the record from Michigan MILARA.";

function verifiedClause(credential: Credential, today: string): string {
  if (credential.lastVerifiedAt) {
    return `Last verified ${formatDaysAgo(credential.lastVerifiedAt, today).toLowerCase()}.`;
  }
  return "It has not been verified against the source yet.";
}

/** Appends the verification service's own message so the manager sees exactly what the server saw. */
function withServerMessage(sentence: string, credential: Credential): string {
  const message = credential.lastError?.trim();
  if (!message) return sentence;
  return `${sentence} The verification service said: ${/[.!?]$/.test(message) ? message : `${message}.`}`;
}

function guidance(credential: Credential, derived: DerivedStatus, today: string): string {
  if (credential.inFlight) {
    return "A verification is running against the source right now. This record updates as soon as it finishes.";
  }
  const verified = verifiedClause(credential, today);
  switch (derived.status) {
    case "expiring":
      return `License expires in ${derived.daysUntil} ${derived.daysUntil === 1 ? "day" : "days"}. ${verified} Re-verify to confirm a renewal before access lapses.`;
    case "expired":
      return `License shows as expired ${Math.abs(derived.daysUntil ?? 0)} days ago. ${verified} Re-verify now; a renewal may not have been recorded.`;
    case "needs_review":
      if (credential.verificationState === "unverified") return NOT_YET_VERIFIED;
      return withServerMessage(
        `${credential.lastReason ? REASON_LABEL[credential.lastReason] : "The last check could not confirm this record"}. A manager should review before relying on it.`,
        credential,
      );
    case "verification_failed":
      return withServerMessage(
        `${credential.lastReason ? REASON_LABEL[credential.lastReason] : "The last verification failed"}. Try again when the source is reachable.`,
        credential,
      );
    default:
      return `License is current. ${verified}`;
  }
}

const TONE: Record<DerivedStatus["status"], string> = {
  active: "border-status-active-dot/30 bg-status-active-bg text-status-active-fg",
  expiring: "border-status-expiring-dot/30 bg-status-expiring-bg text-status-expiring-fg",
  expired: "border-status-expired-dot/30 bg-status-expired-bg text-status-expired-fg",
  needs_review: "border-status-review-dot/30 bg-status-review-bg text-status-review-fg",
  verification_failed: "border-status-failed-dot/30 bg-status-failed-bg text-status-failed-fg",
};

export function CredentialSummary({ credential, derived, today, verifySlot, className }: Props) {
  const detail = statusDetail(derived, credential);

  return (
    <section className={cn("rounded-lg border border-rule bg-paper", className)} aria-label="Current credential">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rule px-5 py-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink">Current credential</h2>
          <div className="flex items-center gap-2">
            <StatusBadge derived={derived} />
            {detail ? <span className="text-xs text-ink-faint">{detail}</span> : null}
          </div>
        </div>
        <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:min-w-[320px] sm:items-end">
          {verifySlot}
          {credential.sourceUrl ? (
            <Button asChild variant="outline" size="xs" className="bg-paper text-ink-soft">
              <a href={credential.sourceUrl} target="_blank" rel="noreferrer">
                <ExternalLinkIcon data-icon="inline-start" />
                View on Michigan MILARA
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <p className={cn("mx-5 mt-4 rounded-md border px-3 py-2 text-sm", TONE[derived.status])}>
        {guidance(credential, derived, today)}
      </p>

      <div key={credential.lastChecked ?? "never"} className="flash-seal m-5 mt-4 rounded-md">
        <CredentialFacts credential={credential} today={today} />
        {derived.daysUntil !== null ? (
          <div className="mt-5">
            <ExpiryRunway daysUntil={derived.daysUntil} status={derived.status} variant="full" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
