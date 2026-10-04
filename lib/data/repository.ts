import type { AlertAction, VerificationAudit } from "@prisma/client";
import { buildSeed, type AuditDto } from "@/lib/data/beacon-adapter";
import { db } from "@/lib/db";
import { listEmployees } from "@/lib/employees";
import { todayDate } from "@/lib/expiration";
import { aiConfigured } from "@/lib/openai";
import type { AlertActions, CredentialSeed, WorkspacePayload } from "@/lib/types";
import { getBatchProgress, recoverInterruptedChecks } from "@/services/credentialService";

/**
 * The one place the front end's snapshot is assembled from the Prisma-backed database.
 * Server-only: it imports lib/db, so it must never be imported by a client component
 * (the (app) layout and GET /api/workspace are its callers).
 */

type StoredResult = {
  recordingId?: unknown;
  candidates?: unknown;
  credential?: { credentialType?: unknown; issueDate?: unknown; county?: unknown } | null;
};

const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/** Keeps only the few fields the UI needs from the stored result; raw scraped fields never leave the server. */
function slimNormalized(normalizedJson: string): AuditDto["normalized"] {
  try {
    const parsed = JSON.parse(normalizedJson) as StoredResult | null;
    if (!parsed || typeof parsed !== "object") return null;
    const credential = parsed.credential && typeof parsed.credential === "object" ? parsed.credential : null;
    return {
      recordingId: text(parsed.recordingId),
      candidateCount: Array.isArray(parsed.candidates) ? parsed.candidates.length : undefined,
      credentialType: text(credential?.credentialType),
      issueDate: text(credential?.issueDate) ?? null,
      county: text(credential?.county) ?? null,
    };
  } catch {
    return null;
  }
}

function toAuditDto(audit: VerificationAudit): AuditDto {
  return {
    id: audit.id,
    employeeId: audit.employeeId,
    source: audit.source,
    sourceUrl: audit.sourceUrl,
    checkedAt: audit.checkedAt.toISOString(),
    state: audit.state,
    licenseNumber: audit.licenseNumber,
    status: audit.status,
    expirationDate: audit.expirationDate,
    error: audit.error,
    normalized: slimNormalized(audit.normalizedJson),
  };
}

function toAlertActions(rows: AlertAction[]): AlertActions {
  const resolvedAlertIds: string[] = [];
  const reminders: Record<string, string> = {};
  for (const row of rows) {
    if (row.status === "resolved") resolvedAlertIds.push(row.id);
    if (row.reminderSentAt) reminders[row.id] = row.reminderSentAt.toISOString();
  }
  return { resolvedAlertIds, reminders };
}

/** Everything the front end needs in one snapshot: the seed plus batch and AI availability. */
export async function loadWorkspace(): Promise<WorkspacePayload> {
  await recoverInterruptedChecks();
  const employees = await listEmployees();
  const audits = await db.verificationAudit.findMany({ orderBy: { checkedAt: "desc" } });
  const alertActions = await db.alertAction.findMany();
  const seed = buildSeed({
    employees,
    audits: audits.map(toAuditDto),
    today: todayDate(),
    alertActions: toAlertActions(alertActions),
  });
  return {
    seed,
    batch: getBatchProgress(),
    aiConfigured: aiConfigured(),
    generatedAt: new Date().toISOString(),
  };
}

export async function loadSeed(): Promise<CredentialSeed> {
  return (await loadWorkspace()).seed;
}
