import type { ChatRow } from "@/lib/assistant/types";
import { toSeedCredential, toSeedEmployee } from "@/lib/data/beacon-adapter";
import { fullName } from "@/lib/data/format";
import { GROUP_META } from "@/lib/data/sources";
import { deriveStatus } from "@/lib/data/status";
import type { EmployeeRecord, EmployeeRow } from "@/lib/types";

/**
 * Turns tool results and selector rows into the chips the chat shows under a reply.
 * Pure and server-safe: the route uses it while streaming, the rules fallback uses it directly.
 */

export const CHAT_ROW_LIMIT = 25;

/** Soonest expiration first; missing dates last, with names breaking ties. */
export function sortChatRows(rows: ChatRow[]): ChatRow[] {
  return [...rows].sort(
    (a, b) =>
      (a.daysUntil ?? Infinity) - (b.daysUntil ?? Infinity) ||
      a.name.localeCompare(b.name),
  );
}

export function toChatRows(rows: EmployeeRow[]): ChatRow[] {
  return sortChatRows(
    rows.map(({ employee, credential, derived }) => ({
      employeeId: employee.id,
      name: fullName(employee),
      group: GROUP_META[employee.group].label,
      status: derived.status,
      tier: derived.tier,
      daysUntil: derived.daysUntil,
      expirationDate: credential.expirationDate,
    })),
  );
}

/** One backend employee record, judged as of `today`, as a chat chip. */
export function recordToChatRow(
  record: EmployeeRecord,
  today: string,
): ChatRow {
  const employee = toSeedEmployee(record);
  const credential = toSeedCredential(record);
  return toChatRows([
    { employee, credential, derived: deriveStatus(credential, today) },
  ])[0];
}

/** Uses the latest row per employee, sorts by expiration, then applies the overall cap. */
export function mergeChatRows(
  existing: ChatRow[],
  incoming: ChatRow[],
): ChatRow[] {
  const merged = new Map(
    [...existing, ...incoming].map((row) => [row.employeeId, row]),
  );
  return sortChatRows([...merged.values()]).slice(0, CHAT_ROW_LIMIT);
}

function isEmployeeLike(value: unknown): value is EmployeeRecord {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.firstName === "string" &&
    typeof v.lastName === "string" &&
    typeof v.verificationState === "string"
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

/** Employee records found in a tool result: `employee`, then `employees`, then `candidates` (strings there are skipped). */
function employeesIn(result: unknown): EmployeeRecord[] {
  const r = asRecord(result);
  const found: EmployeeRecord[] = [];
  if (isEmployeeLike(r.employee)) found.push(r.employee);
  for (const key of ["employees", "candidates"] as const) {
    const list = r[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) if (isEmployeeLike(item)) found.push(item);
  }
  return found;
}

/** Where "Show in the app" should go for a given tool, when there is a natural place. */
function hrefFor(
  name: string,
  result: unknown,
  rowCount: number,
): string | undefined {
  const r = asRecord(result);
  switch (name) {
    case "get_attention_needed":
      return "/alerts";
    case "get_credentials_expiring_within_days":
      return "/dashboard?status=expiring";
    case "get_expired_credentials":
      return "/dashboard?status=expired";
    case "get_unverified_employees":
      return "/dashboard?status=needs_review";
    case "get_employee_by_name":
      return isEmployeeLike(r.employee) && rowCount === 1
        ? `/employees/${r.employee.id}`
        : undefined;
    case "get_employees_by_manager":
      return typeof r.manager === "string" && r.manager
        ? `/employees?q=${encodeURIComponent(r.manager)}`
        : undefined;
    case "verify_employee_credential":
      return isEmployeeLike(r.employee)
        ? `/employees/${r.employee.id}`
        : undefined;
    case "verify_all_credentials":
      return "/employees";
    default:
      return undefined;
  }
}

/**
 * Chips and deep link for one tool call's result. Dedupes by employee id and caps at CHAT_ROW_LIMIT.
 * `today` is the app clock (workspace.seed.today) so demo expirations are judged like the dashboard does.
 */
export function collectToolRows(
  name: string,
  result: unknown,
  today: string,
): { rows: ChatRow[]; href?: string } {
  const seen = new Set<string>();
  const rows: ChatRow[] = [];
  for (const record of employeesIn(result)) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    rows.push(recordToChatRow(record, today));
  }
  const sorted = sortChatRows(rows).slice(0, CHAT_ROW_LIMIT);
  return { rows: sorted, href: hrefFor(name, result, sorted.length) };
}
