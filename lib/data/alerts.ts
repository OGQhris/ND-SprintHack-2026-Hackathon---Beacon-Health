import type { Alert, AlertKind, AlertSeverity, EmployeeRow } from "@/lib/types";
import { formatDate, formatDaysAgo, fullName } from "@/lib/data/format";
import { REASON_LABEL } from "@/lib/data/status";

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  expired: "License expired",
  expiring_7: "Expires within 7 days",
  expiring_14: "Expires within 14 days",
  expiring_30: "Expires within 30 days",
  needs_review: "Needs manual review",
  verification_failed: "Verification failed",
};

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  review: "Needs review",
};

const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, review: 2 };

function kindFor(row: EmployeeRow): AlertKind | null {
  const { status, tier } = row.derived;
  if (status === "expired") return "expired";
  if (status === "expiring") return tier === 7 ? "expiring_7" : tier === 14 ? "expiring_14" : "expiring_30";
  if (status === "needs_review") return "needs_review";
  if (status === "verification_failed") return "verification_failed";
  return null;
}

function severityFor(kind: AlertKind): AlertSeverity {
  if (kind === "expired") return "critical";
  if (kind.startsWith("expiring")) return "warning";
  return "review";
}

/** A credential that has never been checked against the source (a fresh import), as opposed to one the source flagged. */
function neverChecked(row: EmployeeRow): boolean {
  return row.credential.verificationState === "unverified" && !row.credential.lastChecked;
}

function labelFor(row: EmployeeRow, kind: AlertKind): string {
  return kind === "needs_review" && neverChecked(row) ? "Not yet verified" : ALERT_KIND_LABEL[kind];
}

function detailFor(row: EmployeeRow, kind: AlertKind, today: string): string {
  const { credential, derived } = row;
  const checked = formatDaysAgo(credential.lastChecked, today).toLowerCase();
  const days = derived.daysUntil;
  switch (kind) {
    case "expired":
      return `${credential.credentialType} expired ${formatDate(credential.expirationDate)}. Last verified ${checked}.`;
    case "needs_review":
      if (neverChecked(row)) {
        return `${credential.credentialType} license has never been checked against the credential source. Run Verify now to pull the record.`;
      }
      return `${credential.lastReason ? REASON_LABEL[credential.lastReason] : "Verification could not be completed confidently"}. Last attempt ${checked}.`;
    case "verification_failed":
      return `${credential.lastReason ? REASON_LABEL[credential.lastReason] : "Verification could not be completed confidently"}. Last attempt ${checked}.`;
    default:
      return `${credential.credentialType} expires ${formatDate(credential.expirationDate)} (${days} ${days === 1 ? "day" : "days"}). Last verified ${checked}.`;
  }
}

/** Alerts are a view over credential rows, never stored. Only resolve / reminder actions persist. */
export function deriveAlerts(
  rows: EmployeeRow[],
  today: string,
  resolvedIds: string[],
  reminders: Record<string, string>,
): Alert[] {
  const resolved = new Set(resolvedIds);
  const alerts: Alert[] = [];
  for (const row of rows) {
    const kind = kindFor(row);
    if (!kind) continue;
    const id = `${row.credential.id}:${kind}`;
    alerts.push({
      id,
      kind,
      severity: severityFor(kind),
      employeeId: row.employee.id,
      credentialId: row.credential.id,
      title: `${fullName(row.employee)} · ${labelFor(row, kind)}`,
      detail: detailFor(row, kind, today),
      daysUntil: row.derived.daysUntil,
      resolved: resolved.has(id),
      reminderSentAt: reminders[id],
    });
  }
  return alerts.sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s !== 0) return s;
    return (a.daysUntil ?? 9999) - (b.daysUntil ?? 9999);
  });
}
