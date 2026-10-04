import type {
  Alert,
  Credential,
  DashboardMetrics,
  Employee,
  EmployeeGroup,
  EmployeeRow,
  StoreState,
  VerificationRecord,
} from "@/lib/types";
import { deriveAlerts } from "@/lib/data/alerts";
import { fullName } from "@/lib/data/format";
import { GROUP_ORDER, STATUS_ORDER } from "@/lib/data/sources";
import { deriveStatus } from "@/lib/data/status";

/** One row per employee: the employee, their primary credential and its derived status. */
export function joinRows(state: StoreState): EmployeeRow[] {
  const byEmployee = new Map<string, Credential>();
  for (const c of state.credentials) {
    if (!byEmployee.has(c.employeeId)) byEmployee.set(c.employeeId, c);
  }
  const rows: EmployeeRow[] = [];
  for (const employee of state.employees) {
    const credential = byEmployee.get(employee.id);
    if (!credential) continue;
    rows.push({ employee, credential, derived: deriveStatus(credential, state.today) });
  }
  return rows;
}

/** Most urgent first, then soonest expiration, then name. */
export function sortRowsByUrgency(rows: EmployeeRow[]): EmployeeRow[] {
  return [...rows].sort((a, b) => {
    const s = STATUS_ORDER.indexOf(a.derived.status) - STATUS_ORDER.indexOf(b.derived.status);
    if (s !== 0) return s;
    const d = (a.derived.daysUntil ?? 99999) - (b.derived.daysUntil ?? 99999);
    if (d !== 0) return d;
    return fullName(a.employee).localeCompare(fullName(b.employee));
  });
}

export function getEmployees(state: StoreState): Employee[] {
  return state.employees;
}

export function getEmployeeById(state: StoreState, id: string): Employee | undefined {
  return state.employees.find((e) => e.id === id);
}

export function getCredentialsForEmployee(state: StoreState, id: string): Credential[] {
  return state.credentials.filter((c) => c.employeeId === id);
}

export function getRowForEmployee(state: StoreState, id: string): EmployeeRow | undefined {
  const employee = getEmployeeById(state, id);
  const credential = getCredentialsForEmployee(state, id)[0];
  if (!employee || !credential) return undefined;
  return { employee, credential, derived: deriveStatus(credential, state.today) };
}

export function getVerificationHistory(state: StoreState, employeeId: string): VerificationRecord[] {
  return state.records
    .filter((r) => r.employeeId === employeeId)
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
}

export function getAlerts(state: StoreState): Alert[] {
  return deriveAlerts(joinRows(state), state.today, state.resolvedAlertIds, state.reminders);
}

export function getOpenAlertCount(state: StoreState): number {
  return getAlerts(state).filter((a) => !a.resolved).length;
}

export function getRoles(state: StoreState): string[] {
  return Array.from(new Set(state.employees.map((e) => e.role))).sort();
}

export function getDashboardMetrics(state: StoreState): DashboardMetrics {
  const rows = joinRows(state);
  const groupCounts = Object.fromEntries(GROUP_ORDER.map((g) => [g, 0])) as Record<EmployeeGroup, number>;
  const tiers = { d30: 0, d14: 0, d7: 0 };
  let expired = 0;
  let needsReview = 0;
  let failed = 0;
  let unverified = 0;
  const expiredNames: { id: string; name: string }[] = [];

  for (const row of rows) {
    groupCounts[row.employee.group] += 1;
    const { status, tier } = row.derived;
    if (status === "expiring") {
      if (tier === 7) tiers.d7 += 1;
      else if (tier === 14) tiers.d14 += 1;
      else tiers.d30 += 1;
    } else if (status === "expired") {
      expired += 1;
      expiredNames.push({ id: row.employee.id, name: fullName(row.employee) });
    } else if (status === "needs_review") {
      // A never-checked credential is not a review the source asked for; keep the two apart.
      if (row.credential.verificationState === "unverified") unverified += 1;
      else needsReview += 1;
    } else if (status === "verification_failed") {
      failed += 1;
    }
  }

  return {
    totalEmployees: rows.length,
    groupCounts,
    expiringWithin30: tiers.d30 + tiers.d14 + tiers.d7,
    expiringTiers: tiers,
    expired,
    expiredNames,
    needsAttention: { total: needsReview + failed + unverified, needsReview, failed, unverified },
  };
}
