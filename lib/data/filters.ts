import type { CredentialSource, CredentialStatus, EmployeeGroup, EmployeeRow } from "@/lib/types";
import { fullName } from "@/lib/data/format";
import { GROUP_ORDER, SOURCE_ORDER } from "@/lib/data/sources";

export type Filters = {
  q: string;
  group: EmployeeGroup | "all";
  role: string | "all";
  source: CredentialSource | "all";
  status: CredentialStatus | "all";
};

export const EMPTY_FILTERS: Filters = { q: "", group: "all", role: "all", source: "all", status: "all" };

const STATUSES: CredentialStatus[] = ["active", "expiring", "expired", "needs_review", "verification_failed"];

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Reads initial filters from a server page's searchParams so links like /dashboard?group=RNS work. */
export function parseFilters(sp: SearchParams | undefined): Filters {
  if (!sp) return EMPTY_FILTERS;
  const group = first(sp.group);
  const source = first(sp.source);
  const status = first(sp.status);
  return {
    q: first(sp.q) ?? "",
    group: GROUP_ORDER.includes(group as EmployeeGroup) ? (group as EmployeeGroup) : "all",
    role: first(sp.role) ?? "all",
    source: SOURCE_ORDER.includes(source as CredentialSource) ? (source as CredentialSource) : "all",
    status: STATUSES.includes(status as CredentialStatus) ? (status as CredentialStatus) : "all",
  };
}

export function applyFilters(rows: EmployeeRow[], f: Filters): EmployeeRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter(({ employee, credential, derived }) => {
    if (f.group !== "all" && employee.group !== f.group) return false;
    if (f.role !== "all" && employee.role !== f.role) return false;
    if (f.source !== "all" && credential.source !== f.source) return false;
    if (f.status !== "all" && derived.status !== f.status) return false;
    if (q) {
      const hay = `${fullName(employee)} ${employee.managerName ?? ""} ${credential.credentialNumber ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function isFiltered(f: Filters): boolean {
  return f.q.trim() !== "" || f.group !== "all" || f.role !== "all" || f.source !== "all" || f.status !== "all";
}
