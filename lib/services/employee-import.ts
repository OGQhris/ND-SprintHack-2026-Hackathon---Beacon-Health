import type { EmployeeImportResult } from "@/lib/types";

export type ImportCall = { ok: true; data: EmployeeImportResult } | { ok: false; error: string; status?: number };

function errorText(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const { error } = json as { error?: unknown };
  return typeof error === "string" && error.trim() ? error.trim() : undefined;
}

function fallbackText(status: number): string {
  if (status === 413) return "That file is larger than 1 MB.";
  if (status === 403) return "The import was refused. Reload the page and try again.";
  return `The import failed (${status}).`;
}

/**
 * Uploads a CSV to POST /api/employees/import. Never throws: every answer, including a network failure,
 * comes back as a normalized result so the dialog can show it inline.
 */
export async function importEmployeesCsv(
  file: File,
  options: { verify: boolean; signal?: AbortSignal },
): Promise<ImportCall> {
  const body = new FormData();
  body.append("file", file, file.name);
  body.append("verify", options.verify ? "true" : "false");
  try {
    const response = await fetch("/api/employees/import", {
      method: "POST",
      body,
      headers: { accept: "application/json" },
      signal: options.signal,
    });
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, status: response.status, error: errorText(json) ?? fallbackText(response.status) };
    }
    const result = (json as { result?: EmployeeImportResult } | null)?.result;
    if (!result || !Array.isArray(result.imported) || !result.verification) {
      return { ok: false, error: "The server returned an unexpected answer." };
    }
    return { ok: true, data: result };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, error: "The import was cancelled." };
    }
    return { ok: false, error: "The import service could not be reached." };
  }
}
