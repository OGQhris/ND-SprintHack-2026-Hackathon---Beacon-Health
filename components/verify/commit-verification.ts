"use client";

import { toast } from "sonner";
import { formatDate, fullName } from "@/lib/data/format";
import { REASON_LABEL } from "@/lib/data/status";
import type { StoreAction } from "@/lib/store/credential-store";
import { requestWorkspaceRefresh } from "@/lib/store/workspace-events";
import type { Credential, Employee, VerificationOutcome, VerificationRecord } from "@/lib/types";

const NOTE_LIMIT = 240;
export const ISSUES_HREF = "/alerts?tab=issues";

export function outcomeTitle(outcome: VerificationOutcome): string {
  if (outcome.kind === "verified") return "Credential verified";
  return REASON_LABEL[outcome.reason];
}

/**
 * The history row for a finished attempt. Its id is the server's audit id whenever the route returned one,
 * so the next workspace poll replaces this optimistic row (adding the browser recording) instead of duplicating it.
 */
export function buildRecord(outcome: VerificationOutcome, employeeId: string, credential: Credential): VerificationRecord {
  const verified = outcome.kind === "verified";
  const sourceStatus = verified ? outcome.credential.sourceStatus : undefined;
  return {
    id: outcome.recordId ?? `rec-${employeeId}-${Date.now()}`,
    credentialId: credential.id,
    employeeId,
    checkedAt: verified ? outcome.credential.lastChecked : outcome.lastChecked,
    source: verified ? outcome.credential.source : credential.source,
    mode: outcome.mode,
    outcome: outcome.kind,
    reason: verified ? undefined : outcome.reason,
    credentialType: verified ? outcome.credential.credentialType : credential.credentialType,
    credentialNumber: verified ? outcome.credential.credentialNumber : undefined,
    expirationDate: verified ? outcome.credential.expirationDate : undefined,
    note: verified
      ? sourceStatus
        ? `Source status: ${sourceStatus}`
        : "Manager re-verification"
      : outcome.detail?.slice(0, NOTE_LIMIT),
    sourceStatus,
  };
}

type Navigate = (href: string) => void;

/**
 * Tells the manager what happened to a person, even when the card they clicked has already left the screen
 * (an alert that clears itself after a successful re-verification, for example). Bottom-right, with a next step.
 */
export function announceOutcome(outcome: VerificationOutcome, employee: Employee, navigate: Navigate): void {
  const name = fullName(employee);
  const viewEmployee = { label: "View employee", onClick: () => navigate(`/employees/${employee.id}`) };
  const openIssues = { label: "Open verification issues", onClick: () => navigate(ISSUES_HREF) };

  if (outcome.kind === "verified") {
    const c = outcome.credential;
    toast.success(`${name} verified`, {
      description: `${c.credentialType} license is on file through ${formatDate(c.expirationDate)}. Alerts for this license are cleared.`,
      action: viewEmployee,
      duration: 8000,
    });
    return;
  }

  const title =
    outcome.reason === "no_record_found"
      ? `Record not found for ${name}`
      : outcome.reason === "source_unavailable" || outcome.reason === "timeout"
        ? `Record unavailable for ${name}`
        : outcome.reason === "multiple_matches"
          ? `Multiple records for ${name}`
          : `${REASON_LABEL[outcome.reason]}: ${name}`;
  const description = `${outcome.detail ?? "The stored credential was left unchanged."} Resolve it under Credential Alerts, Verification issues.`;

  if (outcome.kind === "needs_review") {
    toast.warning(title, { description, action: openIssues, duration: 10000 });
  } else {
    toast.error(title, { description, action: openIssues, duration: 10000 });
  }
}

/**
 * Applies a finished verification to the screen. The API route already persisted it, so the only
 * follow-up is asking the store to poll now, which swaps in the server's audit row and recording id.
 */
export function commitVerification(params: {
  employee: Employee;
  credential: Credential;
  outcome: VerificationOutcome;
  dispatch: (action: StoreAction) => void;
  navigate: Navigate;
  announce?: boolean;
}): VerificationRecord {
  const { employee, credential, outcome, dispatch, navigate, announce = true } = params;
  const record = buildRecord(outcome, employee.id, credential);
  dispatch({ type: "VERIFICATION_COMPLETED", credentialId: credential.id, outcome, record });
  requestWorkspaceRefresh();
  if (announce) announceOutcome(outcome, employee, navigate);
  return record;
}
