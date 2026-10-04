import type {
  Credential,
  CredentialStatus,
  DerivedStatus,
  ExpiryTier,
  FailureReason,
  ReviewReason,
} from "@/lib/types";
import { daysBetween } from "@/lib/data/clock";

export const STATUS_LABEL: Record<CredentialStatus, string> = {
  active: "Active",
  expiring: "Expiring soon",
  expired: "Expired",
  needs_review: "Needs review",
  verification_failed: "Verification failed",
};

export const REASON_LABEL: Record<ReviewReason | FailureReason, string> = {
  multiple_matches: "Multiple matches",
  no_record_found: "No record found",
  credential_mismatch: "Credential mismatch",
  human_action_required: "Source requires human verification",
  not_yet_verified: "Not yet verified",
  source_unavailable: "Source temporarily unavailable",
  timeout: "Source did not respond",
  unsupported_provider: "No live connector for this source yet",
  in_progress: "Verification in progress",
  unknown: "Verification failed",
};

/**
 * The single status rule. Everything that shows a status calls this.
 * An unverified credential with no expiration date needs review; one that carries a date
 * (including a fictional sample employee) is judged by that date,
 * exactly like the previous dashboard did. The verification state itself stays visible elsewhere.
 */
export function deriveStatus(credential: Credential, today: string): DerivedStatus {
  const daysUntil = credential.expirationDate
    ? daysBetween(today, credential.expirationDate)
    : null;

  if (credential.verificationState === "verification_failed") {
    return { status: "verification_failed", tier: null, daysUntil };
  }
  if (credential.verificationState === "needs_review") {
    return { status: "needs_review", tier: null, daysUntil };
  }
  if (daysUntil === null) {
    return { status: "needs_review", tier: null, daysUntil };
  }
  if (daysUntil < 0) return { status: "expired", tier: null, daysUntil };
  if (daysUntil <= 7) return { status: "expiring", tier: 7, daysUntil };
  if (daysUntil <= 14) return { status: "expiring", tier: 14, daysUntil };
  if (daysUntil <= 30) return { status: "expiring", tier: 30, daysUntil };
  return { status: "active", tier: null, daysUntil };
}

/** Badge text: the status, with the countdown folded in when it is the point. */
export function statusLabel(derived: DerivedStatus): string {
  if (derived.status === "expiring" && derived.daysUntil !== null) {
    if (derived.daysUntil === 0) return "Expires today";
    return `Expires in ${derived.daysUntil} ${derived.daysUntil === 1 ? "day" : "days"}`;
  }
  return STATUS_LABEL[derived.status];
}

/** Secondary text shown next to the badge or under a date. */
export function statusDetail(derived: DerivedStatus, credential?: Credential): string | undefined {
  const d = derived.daysUntil;
  switch (derived.status) {
    case "expired":
      return d === null ? undefined : d === -1 ? "Yesterday" : `${Math.abs(d)} days ago`;
    case "active":
      return d === null ? undefined : `${d} days left`;
    case "needs_review":
    case "verification_failed":
      return credential?.lastReason ? REASON_LABEL[credential.lastReason] : undefined;
    default:
      return undefined;
  }
}

export function tierLabel(tier: ExpiryTier): string {
  return tier ? `${tier}-day window` : "";
}
