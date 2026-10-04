import type { Credential, CredentialSource, Employee, EmployeeRecord, FailureReason, VerificationOutcome } from "@/lib/types";
import { employeeToOutcome } from "@/lib/data/beacon-adapter";
import { nowISO } from "@/lib/data/clock";

export type VerifyMode = "live" | "simulated";

export type VerifyContext = {
  employee: Employee;
  credential: Credential;
  today: string;
};

/** A Michigan MILARA lookup drives a real browser; the route itself gives up well before this. */
const LIVE_TIMEOUT_MS = 180_000;

type VerifyResponse = { employee: EmployeeRecord; auditId?: string };
type ErrorResponse = { error?: unknown };

/**
 * Every check runs live through this backend (Playwright against Michigan MILARA), so no source is simulated.
 * The parameter is kept so call sites read naturally when a second connector arrives; today it does not matter.
 */
export function resolveVerifyMode(source: CredentialSource): VerifyMode {
  void source;
  return "live";
}

function failed(reason: FailureReason, detail?: string): VerificationOutcome {
  return { kind: "verification_failed", mode: "live", reason, lastChecked: nowISO(), detail };
}

function errorText(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const { error } = json as ErrorResponse;
  return typeof error === "string" && error.trim() ? error.trim() : undefined;
}

function isVerifyResponse(json: unknown): json is VerifyResponse {
  if (!json || typeof json !== "object") return false;
  const employee = (json as Partial<VerifyResponse>).employee;
  return !!employee && typeof employee === "object" && typeof employee.id === "string";
}

/**
 * The one function the UI calls. POSTs to the employee's verify route and maps every answer onto a
 * normalized outcome: it never throws and never reports a success the server did not.
 */
export async function verifyCredential(employeeId: string, ctx: VerifyContext): Promise<VerificationOutcome> {
  if (ctx.employee.id !== employeeId) {
    return failed("unknown", "The verification request did not match the employee on screen.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
  try {
    const response = await fetch(`/api/employees/${encodeURIComponent(employeeId)}/verify`, {
      method: "POST",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const json: unknown = await response.json().catch(() => null);
    const serverMessage = errorText(json);

    if (response.status === 200 && isVerifyResponse(json)) {
      return employeeToOutcome(json.employee, { auditId: json.auditId });
    }
    if (response.status === 409) {
      return failed("in_progress", serverMessage ?? "A check for this employee is already running.");
    }
    if (response.status === 404) {
      return failed("unknown", serverMessage ?? "This employee is no longer on the credentialing list.");
    }
    if (response.status === 200) {
      return failed("unknown", "The verification service returned an unexpected response.");
    }
    return failed(
      "source_unavailable",
      serverMessage
        ? `The verification service answered ${response.status}: ${serverMessage}`
        : `The verification service answered ${response.status}.`,
    );
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return aborted
      ? failed("timeout", "The verification service did not answer within three minutes.")
      : failed("source_unavailable", "The verification service could not be reached.");
  } finally {
    clearTimeout(timer);
  }
}
