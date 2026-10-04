import type { Employee as PrismaEmployee } from "@prisma/client";
import type { ExpirationCategory } from "./expiration";

/* -------------------------------------------------------------------------- */
/* Backend records: what the Prisma-backed API routes return.                  */
/* -------------------------------------------------------------------------- */

export type EmployeeRecord = Omit<
  PrismaEmployee,
  "createdAt" | "updatedAt" | "lastVerifiedAt" | "lastAttemptAt"
> & {
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
  lastAttemptAt: string | null;
  sourceExpirationDate: string | null;
  demoExpiration: boolean;
  isSample?: boolean;
  expirationCategory: ExpirationCategory;
  daysUntilExpiration: number | null;
};

export type Summary = {
  total: number;
  verified: number;
  unverified: number;
  active: number;
  expired: number;
  expiringWithin7Days: number;
  expiringWithin14Days: number;
  expiringWithin30Days: number;
  needsReview: number;
  notFound: number;
  errors: number;
  attention: number;
};

export type BatchProgress = {
  running: boolean;
  completed: number;
  total: number;
  verified: number;
  failed: number;
  currentEmployee: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** True once a stop was requested; the check in flight still finishes. */
  stopRequested?: boolean;
};

export type DashboardData = {
  employees: EmployeeRecord[];
  summary: Summary;
  batch: BatchProgress;
  today: string;
  aiConfigured: boolean;
  managers: string[];
};

/* -------------------------------------------------------------------------- */
/* CSV employee import (POST /api/employees/import).                           */
/* -------------------------------------------------------------------------- */

/** One person the import created; `row` is the 1-based record number in the file (the header is row 1). */
export type ImportedEmployee = { id: string; row: number; firstName: string; lastName: string; manager: string };

export type EmployeeImportSkipped = { row: number; reason: string; name?: string };

export type EmployeeImportVerification = {
  requested: boolean;
  started: boolean;
  count: number;
  /** What started, or why nothing did (a roster check already running, nothing new to verify). */
  message: string;
};

export type EmployeeImportResult = {
  fileName: string;
  /** Non-empty data rows found in the file (header excluded). */
  total: number;
  imported: ImportedEmployee[];
  /** Rows whose first and last name already match someone on the roster; left untouched. */
  alreadyOnRoster: { row: number; firstName: string; lastName: string; employeeId: string }[];
  skipped: EmployeeImportSkipped[];
  importedAt: string;
  verification: EmployeeImportVerification;
};

/* -------------------------------------------------------------------------- */
/* Front-end view model (ported from the hackathon app).                       */
/* lib/data/beacon-adapter.ts is the only place that maps backend records      */
/* onto these types.                                                           */
/* -------------------------------------------------------------------------- */

export type EmployeeGroup = "RNS" | "RAD_TECHS" | "US_TECHS" | "NUC_MED_TECHS";

export type CredentialSource = "RNS" | "ARRT" | "ARDMS" | "NMTCB";

export type CredentialStatus =
  | "active"
  | "expiring"
  | "expired"
  | "needs_review"
  | "verification_failed";

export type VerificationState =
  | "verified"
  | "needs_review"
  | "verification_failed"
  | "unverified";

export type ExpiryTier = 7 | 14 | 30 | null;

export type ReviewReason =
  | "multiple_matches"
  | "no_record_found"
  | "credential_mismatch"
  | "human_action_required"
  /** Never checked against the source yet (a fresh import). */
  | "not_yet_verified";

export type FailureReason =
  | "source_unavailable"
  | "timeout"
  | "unsupported_provider"
  | "in_progress"
  | "unknown";

export type VerificationScenario =
  | "verified_renewed"
  | "verified_unchanged"
  | "multiple_matches"
  | "no_record_found"
  | "source_unavailable"
  | "timeout";

export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  group: EmployeeGroup;
  department?: string;
  managerName?: string;
  state?: string;
  isSample?: boolean;
  scenario?: VerificationScenario;
  /** Workbook provenance (worksheet name and row), preserved from the import. */
  sourceSheet?: string;
  sourceRow?: number;
};

export type Credential = {
  id: string;
  employeeId: string;
  credentialType: string;
  credentialNumber?: string;
  source: CredentialSource;
  verificationState: VerificationState;
  lastReason?: ReviewReason | FailureReason;
  /** YYYY-MM-DD. In demo mode this is the simulated date; see demoExpiration. */
  expirationDate?: string;
  /** ISO timestamp of the last verification attempt, successful or not. */
  lastChecked?: string;
  /** ISO timestamp of the last successful verification; differs from lastChecked after a failed recheck. */
  lastVerifiedAt?: string;
  /** Raw license status text exactly as the source displayed it (e.g. "Active"). */
  sourceStatus?: string;
  /** YYYY-MM-DD */
  issueDate?: string;
  county?: string;
  /** Last error text from the verification service, for detail views. */
  lastError?: string;
  /** Link to the record on the credential source. */
  sourceUrl?: string;
  /** expirationDate is a demo-seeded value; sourceExpirationDate is what the source actually said. */
  demoExpiration?: boolean;
  sourceExpirationDate?: string;
  /** A verification is running on the server for this credential right now. */
  inFlight?: boolean;
};

export type VerificationMode = "seed" | "simulated" | "live";

export type VerificationOutcomeKind =
  | "verified"
  | "needs_review"
  | "verification_failed";

export type VerificationRecord = {
  id: string;
  credentialId: string;
  employeeId: string;
  checkedAt: string;
  source: CredentialSource;
  mode: VerificationMode;
  outcome: VerificationOutcomeKind;
  reason?: ReviewReason | FailureReason;
  credentialType?: string;
  credentialNumber?: string;
  expirationDate?: string;
  note?: string;
  /** Raw license status text from the source at the time of the check. */
  sourceStatus?: string;
  /** Browser recording id (screenshots of the lookup), replayable in the verification viewer. */
  recordingId?: string;
};

export type VerifiedCredentialPatch = {
  source: CredentialSource;
  credentialType: string;
  credentialNumber?: string;
  expirationDate?: string;
  lastChecked: string;
  sourceStatus?: string;
  issueDate?: string;
  county?: string;
  sourceUrl?: string;
};

type OutcomeMeta = {
  mode: VerificationMode;
  /** Manager-facing sentence from the source or server, e.g. "29 licenses match this name exactly." */
  detail?: string;
  /** History row id when the server already persisted this attempt. */
  recordId?: string;
};

export type VerificationOutcome =
  | ({ kind: "verified"; credential: VerifiedCredentialPatch } & OutcomeMeta)
  | ({ kind: "needs_review"; reason: ReviewReason; lastChecked: string } & OutcomeMeta)
  | ({ kind: "verification_failed"; reason: FailureReason; lastChecked: string } & OutcomeMeta);

export type DerivedStatus = {
  status: CredentialStatus;
  tier: ExpiryTier;
  daysUntil: number | null;
};

export type EmployeeRow = {
  employee: Employee;
  credential: Credential;
  derived: DerivedStatus;
};

export type AlertKind =
  | "expired"
  | "expiring_7"
  | "expiring_14"
  | "expiring_30"
  | "needs_review"
  | "verification_failed";

export type AlertSeverity = "critical" | "warning" | "review";

export type Alert = {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  employeeId: string;
  credentialId: string;
  title: string;
  detail: string;
  daysUntil: number | null;
  resolved: boolean;
  reminderSentAt?: string;
};

export type DashboardMetrics = {
  totalEmployees: number;
  groupCounts: Record<EmployeeGroup, number>;
  expiringWithin30: number;
  expiringTiers: { d30: number; d14: number; d7: number };
  expired: number;
  expiredNames: { id: string; name: string }[];
  /** unverified: never checked against the source yet (a fresh import); needsReview: the source answered but a person must decide. */
  needsAttention: { total: number; needsReview: number; failed: number; unverified: number };
};

export type AlertActions = {
  resolvedAlertIds: string[];
  reminders: Record<string, string>;
};

export type CredentialSeed = {
  /** Where this dataset was loaded from; shown in the UI so a demo never misrepresents its data. */
  source: "sqlite" | "csv";
  employees: Employee[];
  credentials: Credential[];
  records: VerificationRecord[];
  sourceLinks: Partial<Record<CredentialSource, string>>;
  alertActions: AlertActions;
  today: string;
  sampleCount: number;
};

/**
 * One server snapshot of everything the front end needs. Served by GET /api/workspace,
 * loaded directly by the (app) layout for the first paint, and polled by the store afterwards.
 */
export type WorkspacePayload = {
  seed: CredentialSeed;
  batch: BatchProgress;
  aiConfigured: boolean;
  /** ISO timestamp the server produced this snapshot. */
  generatedAt: string;
};

export type StoreState = CredentialSeed & {
  resolvedAlertIds: string[];
  reminders: Record<string, string>;
  /** Server-side roster verification progress (Verify selected / Verify all / assistant-triggered). */
  batch: BatchProgress;
  aiConfigured: boolean;
  /** When the store last applied a server snapshot (ISO), or null before the first poll. */
  lastSyncedAt: string | null;
};
