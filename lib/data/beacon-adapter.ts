import type {
  AlertActions,
  Credential,
  CredentialSeed,
  Employee,
  EmployeeRecord,
  EmployeeGroup,
  FailureReason,
  ReviewReason,
  VerificationOutcome,
  VerificationOutcomeKind,
  VerificationRecord,
  VerificationState,
} from "@/lib/types";
import { MICHIGAN_URL } from "@/services/credentialProviders/types";
import { GROUP_META } from "@/lib/data/sources";

/**
 * The one translation between the Prisma-backed backend (EmployeeRecord, VerificationAudit)
 * and the front end's view model (Employee, Credential, VerificationRecord, VerificationOutcome).
 * Pure functions, safe to import from server and client code alike.
 *
 * Backend verificationState  -> view model
 *   VERIFIED (status Active)  -> verified (status then follows the expiration date)
 *   VERIFIED (other status)   -> needs_review / credential_mismatch (source says Suspended, Lapsed, ...)
 *   NEEDS_REVIEW              -> needs_review, reason read from the audit message
 *   NOT_FOUND                 -> needs_review / no_record_found
 *   ERROR                     -> verification_failed, reason read from the audit message
 *   VERIFYING                 -> the previous state, flagged inFlight
 *   UNVERIFIED                -> unverified / not_yet_verified
 */

export const RN_SOURCE = "RNS" as const;
export const RN_CREDENTIAL_TYPE = "Registered Nurse";
export const RN_STATE = "MI";

/** The front end keys credentials separately from employees; the backend has exactly one credential per employee. */
export function credentialIdFor(employeeId: string): string {
  return `cred-${employeeId}`;
}

/** Slim audit row: what the repository serializes from VerificationAudit (never the raw scraped HTML). */
export type AuditDto = {
  id: string;
  employeeId: string;
  source: string;
  sourceUrl: string;
  /** ISO timestamp */
  checkedAt: string;
  state: string;
  licenseNumber: string | null;
  status: string | null;
  expirationDate: string | null;
  error: string | null;
  normalized: {
    recordingId?: string;
    candidateCount?: number;
    credentialType?: string;
    issueDate?: string | null;
    county?: string | null;
  } | null;
};

/** Source statuses that still count as a verified record; the expiration date decides the rest. */
const ACCEPTABLE_STATUS =
  /^(active|current|valid|renewed|expired|clear|good standing)$/i;

export function isAcceptableSourceStatus(
  status: string | null | undefined,
): boolean {
  if (!status) return true;
  return ACCEPTABLE_STATUS.test(status.trim());
}

const REVIEW_REASONS: [RegExp, ReviewReason][] = [
  [/multiple|more than one|several|ambiguous/i, "multiple_matches"],
  [/additional pages|human review|captcha|challenge/i, "human_action_required"],
  [
    /no license results|no records|no results|not found|no matching/i,
    "no_record_found",
  ],
];

const FAILURE_REASONS: [RegExp, FailureReason][] = [
  [/timed? ?out|timeout|deadline/i, "timeout"],
  [
    /server stopped|could not be saved|already being verified|already in progress/i,
    "unknown",
  ],
  [
    /http 5\d\d|temporary server error|unavailable|could not be checked|unreachable|network|bad gateway/i,
    "source_unavailable",
  ],
];

export function reviewReasonFromMessage(
  message: string | null | undefined,
): ReviewReason {
  if (!message) return "credential_mismatch";
  return (
    REVIEW_REASONS.find(([re]) => re.test(message))?.[1] ??
    "credential_mismatch"
  );
}

export function failureReasonFromMessage(
  message: string | null | undefined,
): FailureReason {
  if (!message) return "unknown";
  return (
    FAILURE_REASONS.find(([re]) => re.test(message))?.[1] ??
    "source_unavailable"
  );
}

export type MappedState = {
  verificationState: VerificationState;
  lastReason?: ReviewReason | FailureReason;
  inFlight?: boolean;
};

type StateInput = {
  verificationState: string;
  verificationError?: string | null;
  credentialStatus?: string | null;
  lastVerifiedAt?: string | null;
  lastAttemptAt?: string | null;
};

/** Maps a backend verification state (plus its message and source status) onto the view model's state and reason. */
export function mapVerificationState(input: StateInput): MappedState {
  const { verificationState, verificationError, credentialStatus } = input;
  switch (verificationState) {
    case "VERIFIED":
      return isAcceptableSourceStatus(credentialStatus)
        ? { verificationState: "verified" }
        : {
            verificationState: "needs_review",
            lastReason: "credential_mismatch",
          };
    case "NEEDS_REVIEW":
      return {
        verificationState: "needs_review",
        lastReason: reviewReasonFromMessage(verificationError),
      };
    case "NOT_FOUND":
      return {
        verificationState: "needs_review",
        lastReason: "no_record_found",
      };
    case "ERROR":
      return {
        verificationState: "verification_failed",
        lastReason: failureReasonFromMessage(verificationError),
      };
    case "VERIFYING": {
      // The server is mid-check. Show the previous state rather than flickering to "needs review".
      const lastSuccessIsLatest =
        !!input.lastVerifiedAt &&
        (!input.lastAttemptAt || input.lastVerifiedAt >= input.lastAttemptAt);
      return lastSuccessIsLatest
        ? { verificationState: "verified", inFlight: true }
        : {
            verificationState: "unverified",
            lastReason: "in_progress",
            inFlight: true,
          };
    }
    default:
      return {
        verificationState: "unverified",
        lastReason: "not_yet_verified",
      };
  }
}

export function outcomeKindFor(
  state: VerificationState,
): VerificationOutcomeKind {
  if (state === "verified") return "verified";
  if (state === "needs_review") return "needs_review";
  return "verification_failed";
}

export function toSeedEmployee(e: EmployeeRecord): Employee {
  const group = groupFor(e);
  return {
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    role: GROUP_META[group].role,
    group,
    managerName: e.manager || undefined,
    state: RN_STATE,
    sourceSheet: e.sourceSheet,
    sourceRow: e.sourceRow,
    isSample: e.isSample,
  };
}

function groupFor(e: EmployeeRecord): EmployeeGroup {
  if (e.credentialType === GROUP_META.US_TECHS.credentialType)
    return "US_TECHS";
  if (e.credentialType === GROUP_META.RAD_TECHS.credentialType)
    return "RAD_TECHS";
  return "RNS";
}

export function toSeedCredential(e: EmployeeRecord): Credential {
  const mapped = mapVerificationState(e);
  return {
    id: credentialIdFor(e.id),
    employeeId: e.id,
    credentialType: e.credentialType || RN_CREDENTIAL_TYPE,
    credentialNumber: e.licenseNumber ?? undefined,
    source: GROUP_META[groupFor(e)].defaultSource,
    verificationState: mapped.verificationState,
    lastReason: mapped.lastReason,
    inFlight: mapped.inFlight,
    expirationDate: e.expirationDate ?? undefined,
    lastChecked: e.lastAttemptAt ?? e.lastVerifiedAt ?? undefined,
    lastVerifiedAt: e.lastVerifiedAt ?? undefined,
    sourceStatus: e.credentialStatus ?? undefined,
    issueDate: e.issueDate ?? undefined,
    county: e.county ?? undefined,
    lastError: e.verificationError ?? undefined,
    sourceUrl: e.sourceUrl ?? undefined,
    demoExpiration: e.demoExpiration || undefined,
    sourceExpirationDate: e.demoExpiration
      ? (e.sourceExpirationDate ?? undefined)
      : undefined,
  };
}

const NOTE_LIMIT = 240;

export function auditToRecord(a: AuditDto): VerificationRecord {
  const mapped = mapVerificationState({
    verificationState: a.state,
    verificationError: a.error,
    credentialStatus: a.status,
  });
  const outcome = outcomeKindFor(mapped.verificationState);
  const note =
    outcome === "verified"
      ? a.status
        ? `Source status: ${a.status}`
        : undefined
      : (a.error ?? undefined)?.slice(0, NOTE_LIMIT);
  return {
    id: a.id,
    credentialId: credentialIdFor(a.employeeId),
    employeeId: a.employeeId,
    checkedAt: a.checkedAt,
    source: RN_SOURCE,
    mode: "live",
    outcome,
    reason: outcome === "verified" ? undefined : mapped.lastReason,
    credentialType: a.normalized?.credentialType || RN_CREDENTIAL_TYPE,
    credentialNumber: a.licenseNumber ?? undefined,
    expirationDate: a.expirationDate ?? undefined,
    note,
    sourceStatus: a.status ?? undefined,
    recordingId: a.normalized?.recordingId,
  };
}

/**
 * Turns the employee the verify route returns into the outcome the verify panel, toasts and store expect.
 * `recordId` is the audit row the server wrote, so the history highlight and the next poll agree.
 */
export function employeeToOutcome(
  e: EmployeeRecord,
  options: { auditId?: string } = {},
): VerificationOutcome {
  const mapped = mapVerificationState(e);
  const lastChecked =
    e.lastAttemptAt ?? e.lastVerifiedAt ?? new Date().toISOString();
  const meta = { mode: "live" as const, recordId: options.auditId };
  const detail = e.verificationError ?? undefined;

  if (mapped.verificationState === "verified") {
    return {
      kind: "verified",
      ...meta,
      detail: e.credentialStatus
        ? `Source status: ${e.credentialStatus}.`
        : undefined,
      credential: {
        source: RN_SOURCE,
        credentialType: e.credentialType || RN_CREDENTIAL_TYPE,
        credentialNumber: e.licenseNumber ?? undefined,
        expirationDate: e.expirationDate ?? undefined,
        lastChecked,
        sourceStatus: e.credentialStatus ?? undefined,
        issueDate: e.issueDate ?? undefined,
        county: e.county ?? undefined,
        sourceUrl: e.sourceUrl ?? undefined,
      },
    };
  }
  if (mapped.verificationState === "needs_review") {
    const reason =
      (mapped.lastReason as ReviewReason | undefined) ?? "credential_mismatch";
    const mismatch =
      e.verificationState === "VERIFIED" && e.credentialStatus
        ? `The source lists this license as "${e.credentialStatus}".`
        : undefined;
    return {
      kind: "needs_review",
      ...meta,
      reason,
      lastChecked,
      detail: mismatch ?? detail,
    };
  }
  const reason: FailureReason =
    mapped.verificationState === "verification_failed"
      ? ((mapped.lastReason as FailureReason | undefined) ?? "unknown")
      : mapped.inFlight
        ? "in_progress"
        : "unknown";
  return { kind: "verification_failed", ...meta, reason, lastChecked, detail };
}

/** Assembles the front end's seed from backend records. `employees` should already be sorted by name. */
export function buildSeed(input: {
  employees: EmployeeRecord[];
  audits: AuditDto[];
  today: string;
  alertActions: AlertActions;
}): CredentialSeed {
  return {
    source: "sqlite",
    employees: input.employees.map(toSeedEmployee),
    credentials: input.employees.map(toSeedCredential),
    records: input.audits.map(auditToRecord),
    sourceLinks: { RNS: MICHIGAN_URL },
    alertActions: input.alertActions,
    today: input.today,
    sampleCount: input.employees.filter((e) => e.isSample).length,
  };
}
