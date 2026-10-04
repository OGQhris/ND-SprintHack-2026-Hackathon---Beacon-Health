import type { EmployeeRow } from "@/lib/types";
import { formatDate, formatDaysAgo, fullName } from "@/lib/data/format";
import { GROUP_META, SOURCE_META } from "@/lib/data/sources";
import { STATUS_LABEL, statusLabel } from "@/lib/data/status";
import { toCsv } from "@/lib/export/csv";

/** The dashboard's current rows as a compliance CSV: one line per employee, the same status rule as the screen. */
export function reportToCsv(rows: EmployeeRow[], today: string): string {
  const headers = [
    "Employee",
    "Role",
    "Group",
    "Manager",
    "Credential type",
    "Credential number",
    "Source",
    "Status",
    "Status detail",
    "Expiration date",
    "Source status",
    "Demo expiration",
    "Days until expiration",
    "Last checked",
    "Verification state",
    "Sample record",
  ];
  const records = rows.map(({ employee, credential, derived }) => [
    fullName(employee),
    employee.role,
    GROUP_META[employee.group].label,
    employee.managerName ?? "",
    credential.credentialType,
    credential.credentialNumber ?? "",
    SOURCE_META[credential.source].label,
    STATUS_LABEL[derived.status],
    statusLabel(derived),
    credential.expirationDate ? formatDate(credential.expirationDate) : "",
    credential.sourceStatus ?? "",
    credential.demoExpiration ? "yes" : "no",
    derived.daysUntil ?? "",
    credential.lastChecked ? formatDaysAgo(credential.lastChecked, today) : "Never",
    credential.verificationState,
    employee.isSample ? "yes" : "no",
  ]);
  return toCsv(headers, records);
}
