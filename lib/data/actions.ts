"use server";

import { z } from "zod";
import { credentialIdFor } from "@/lib/data/beacon-adapter";
import { db } from "@/lib/db";
import type { AlertKind } from "@/lib/types";

export type PersistResult = { ok: true; persisted: boolean } | { ok: false; error: string };

// Record<AlertKind, true> fails to compile if the union gains a kind this list is missing.
const KINDS: Record<AlertKind, true> = {
  expired: true,
  expiring_7: true,
  expiring_14: true,
  expiring_30: true,
  needs_review: true,
  verification_failed: true,
};
const ALERT_KINDS = Object.keys(KINDS) as [AlertKind, ...AlertKind[]];

const alertActionInput = z
  .strictObject({
    alertId: z.string().min(1).max(200),
    credentialId: z.string().min(1).max(180),
    employeeId: z.string().min(1).max(160),
    kind: z.enum(ALERT_KINDS),
    status: z.enum(["open", "resolved"]).optional(),
    reminderSentAt: z.iso
      .datetime({ offset: true })
      .refine((value) => Number.isFinite(Date.parse(value)), "reminderSentAt must be a valid timestamp.")
      .optional(),
  })
  .refine((value) => value.alertId === `${value.credentialId}:${value.kind}`, {
    message: "alertId must be the credential id and the alert kind joined by a colon.",
    path: ["alertId"],
  })
  .refine((value) => value.credentialId === credentialIdFor(value.employeeId), {
    message: "credentialId does not belong to employeeId.",
    path: ["credentialId"],
  });

function failure(error: unknown): PersistResult {
  return { ok: false, error: error instanceof Error ? error.message : "Unknown database error" };
}

/**
 * Persists a manager's resolve / reopen / reminder action on a derived alert.
 * The alert itself is never stored: its id is "<credentialId>:<kind>" and it is re-derived on every load.
 * Never throws to the client; failures come back as { ok: false, error }.
 */
export async function recordAlertAction(input: {
  alertId: string;
  credentialId: string;
  employeeId: string;
  kind: AlertKind;
  status?: "open" | "resolved";
  reminderSentAt?: string;
}): Promise<PersistResult> {
  try {
    const parsed = alertActionInput.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid alert action." };
    }
    const action = parsed.data;
    const employee = await db.employee.findUnique({ where: { id: action.employeeId }, select: { id: true } });
    if (!employee) return { ok: false, error: "Employee not found." };

    const now = new Date();
    const reminderSentAt = action.reminderSentAt ? new Date(action.reminderSentAt) : undefined;
    await db.alertAction.upsert({
      where: { id: action.alertId },
      create: {
        id: action.alertId,
        credentialId: action.credentialId,
        employeeId: action.employeeId,
        kind: action.kind,
        status: action.status ?? "open",
        resolvedAt: action.status === "resolved" ? now : null,
        reminderSentAt: reminderSentAt ?? null,
      },
      update: {
        ...(action.status ? { status: action.status, resolvedAt: action.status === "resolved" ? now : null } : {}),
        ...(reminderSentAt ? { reminderSentAt } : {}),
      },
    });
    return { ok: true, persisted: true };
  } catch (error) {
    console.error("[Alert Actions]", error);
    return failure(error);
  }
}
