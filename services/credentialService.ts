import { db } from "@/lib/db";
import { serializeEmployee } from "@/lib/employees";
import type { BatchProgress } from "@/lib/types";
import { MichiganRNPlaywrightProvider } from "./credentialProviders/michiganRnPlaywrightProvider";
import {
  MICHIGAN_URL,
  type CredentialProvider,
  type CredentialVerificationResult,
} from "./credentialProviders/types";
const shared = globalThis as unknown as {
  beaconVerification?: {
    queue: Promise<unknown>;
    pending: Set<string>;
    batch: BatchProgress;
    recovered: boolean;
  };
};
const state = (shared.beaconVerification ??= {
  queue: Promise.resolve(),
  pending: new Set(),
  recovered: false,
  batch: {
    running: false,
    completed: 0,
    total: 0,
    verified: 0,
    failed: 0,
    currentEmployee: null,
    startedAt: null,
    finishedAt: null,
  },
});
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const task = state.queue.then(work);
  state.queue = task.catch(() => {});
  return task;
}
export function getBatchProgress() {
  return { ...state.batch };
}
export async function recoverInterruptedChecks() {
  if (state.recovered) return;
  state.recovered = true;
  await db.employee.updateMany({
    where: { verificationState: "VERIFYING" },
    data: {
      verificationState: "ERROR",
      verificationError:
        "The server stopped during the previous check. Please verify again.",
    },
  });
}
export async function persistVerification(
  employeeId: string,
  result: CredentialVerificationResult,
) {
  const credential = result.state === "VERIFIED" ? result.credential : null;
  return db.$transaction(async (tx) => {
    await tx.verificationAudit.create({
      data: {
        employeeId,
        source: result.source,
        sourceUrl: result.sourceUrl,
        checkedAt: new Date(result.checkedAt),
        state: result.state,
        licenseNumber: credential?.licenseNumber,
        status: credential?.status,
        expirationDate: credential?.expirationDate,
        normalizedJson: JSON.stringify(result),
        error: result.error,
        screenshotPath: result.screenshotPath,
      },
    });
    const employee = await tx.employee.update({
      where: { id: employeeId },
      data: {
        verificationState: result.state,
        verificationError: result.error,
        lastAttemptAt: new Date(result.checkedAt),
        ...(credential
          ? {
              licenseNumber: credential.licenseNumber,
              credentialType: credential.credentialType,
              credentialStatus: credential.status,
              issueDate: credential.issueDate,
              expirationDate: credential.expirationDate,
              county: credential.county,
              sourceUrl: credential.sourceUrl,
              lastVerifiedAt: new Date(result.checkedAt),
            }
          : {}),
      },
    });
    return serializeEmployee(employee);
  });
}
async function performVerification(
  employeeId: string,
  provider: CredentialProvider,
) {
  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found.");
  console.log(
    "[Credential Verification] Starting",
    employee.firstName,
    employee.lastName,
  );
  await db.employee.update({
    where: { id: employeeId },
    data: { verificationState: "VERIFYING", verificationError: null },
  });
  let result: CredentialVerificationResult;
  try {
    result = await provider.verify(employee);
  } catch (error) {
    console.error("[Credential Verification] Provider failed", error);
    result = {
      state: "ERROR",
      source: "Michigan MILARA",
      sourceUrl: MICHIGAN_URL,
      checkedAt: new Date().toISOString(),
      credential: null,
      candidates: [],
      rawFields: null,
      error:
        "The verification provider could not complete the check. Please retry.",
    };
  }
  const updated = await persistVerification(employeeId, result);
  console.log(
    "[Credential Verification]",
    employee.firstName,
    employee.lastName,
    "->",
    updated.verificationState,
    "->",
    updated.credentialStatus,
    "->",
    updated.expirationDate,
  );
  return updated;
}
export async function verifyEmployee(
  employeeId: string,
  provider: CredentialProvider = new MichiganRNPlaywrightProvider(),
) {
  await recoverInterruptedChecks();
  if (state.batch.running)
    throw new Error("Roster verification is already in progress.");
  if (state.pending.has(employeeId))
    throw new Error("This employee is already being verified.");
  state.pending.add(employeeId);
  try {
    return await enqueue(() => performVerification(employeeId, provider));
  } finally {
    state.pending.delete(employeeId);
  }
}
export async function startVerifyAll(
  provider: CredentialProvider = new MichiganRNPlaywrightProvider(),
) {
  await recoverInterruptedChecks();
  if (state.batch.running) return getBatchProgress();
  const employees = await db.employee.findMany({
    orderBy: { sourceRow: "asc" },
  });
  if (!employees.length)
    throw new Error("Import worksheet four before verifying the roster.");
  state.batch = {
    running: true,
    completed: 0,
    total: employees.length,
    verified: 0,
    failed: 0,
    currentEmployee: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  void enqueue(async () => {
    try {
      for (const employee of employees) {
        state.batch.currentEmployee = `${employee.firstName} ${employee.lastName}`;
        try {
          const result = await performVerification(employee.id, provider);
          if (result.verificationState === "VERIFIED") state.batch.verified++;
          else state.batch.failed++;
        } catch (error) {
          console.error(
            "[Credential Verification] Batch employee failed",
            error,
          );
          state.batch.failed++;
          await db.employee
            .update({
              where: { id: employee.id },
              data: {
                verificationState: "ERROR",
                verificationError:
                  "The verification could not be saved. Please retry.",
              },
            })
            .catch(() => {});
        }
        state.batch.completed++;
      }
    } finally {
      state.batch.running = false;
      state.batch.currentEmployee = null;
      state.batch.finishedAt = new Date().toISOString();
    }
  });
  return getBatchProgress();
}
