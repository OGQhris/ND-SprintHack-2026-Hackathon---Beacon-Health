import { seededExpiration } from "./demo";
import type { Employee } from "@prisma/client";
import { db } from "./db";
import {
  daysUntilExpiration,
  expirationCategory,
  todayDate,
} from "./expiration";
import type { EmployeeRecord, Summary } from "./types";
export function serializeEmployee(
  e: Employee,
  today = todayDate(),
): EmployeeRecord {
  const demoDate = seededExpiration(e.sourceRow);
  const expiration = demoDate || e.expirationDate;
  return {
    ...e,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    lastVerifiedAt: e.lastVerifiedAt?.toISOString() ?? null,
    lastAttemptAt: e.lastAttemptAt?.toISOString() ?? null,
    expirationDate: expiration,
    sourceExpirationDate: e.expirationDate,
    demoExpiration: !!demoDate,
    expirationCategory: expirationCategory(expiration, today),
    daysUntilExpiration: daysUntilExpiration(expiration, today),
  };
}
export async function listEmployees() {
  return (
    await db.employee.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    })
  ).map((e) => serializeEmployee(e));
}
export function needsAttention(e: EmployeeRecord) {
  return (
    ["NEEDS_REVIEW", "NOT_FOUND", "ERROR"].includes(e.verificationState) ||
    (e.daysUntilExpiration !== null && e.daysUntilExpiration <= 30) ||
    (!!e.credentialStatus && e.credentialStatus.toLowerCase() !== "active")
  );
}
export function summarize(employees: EmployeeRecord[]): Summary {
  const count = (predicate: (e: EmployeeRecord) => boolean) =>
    employees.filter(predicate).length;
  const window = (n: number) =>
    count(
      (e) =>
        e.daysUntilExpiration !== null &&
        e.daysUntilExpiration >= 0 &&
        e.daysUntilExpiration <= n,
    );
  return {
    total: employees.length,
    verified: count((e) => e.verificationState === "VERIFIED"),
    unverified: count((e) => e.verificationState === "UNVERIFIED"),
    active: count((e) => e.credentialStatus?.toLowerCase() === "active"),
    expired: count((e) => e.expirationCategory === "EXPIRED"),
    expiringWithin7Days: window(7),
    expiringWithin14Days: window(14),
    expiringWithin30Days: window(30),
    needsReview: count((e) => e.verificationState === "NEEDS_REVIEW"),
    notFound: count((e) => e.verificationState === "NOT_FOUND"),
    errors: count((e) => e.verificationState === "ERROR"),
    attention: count(needsAttention),
  };
}
export function searchEmployeesIn(records: EmployeeRecord[], query: string) {
  const q = query.trim().toLowerCase();
  return records.filter((e) =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(q),
  );
}
export function matchEmployeeName(
  records: EmployeeRecord[],
  firstName: string,
  lastName: string,
) {
  const first = firstName.trim().toLowerCase(),
    last = lastName.trim().toLowerCase();
  const exact = records.filter(
    (e) =>
      e.firstName.toLowerCase() === first && e.lastName.toLowerCase() === last,
  );
  const matches = exact.length
    ? exact
    : records.filter(
        (e) =>
          e.firstName.toLowerCase().startsWith(first) &&
          e.lastName.toLowerCase().startsWith(last),
      );
  return {
    found: matches.length === 1,
    clarificationRequired: matches.length > 1,
    employee: matches.length === 1 ? matches[0] : null,
    candidates: matches.length > 1 ? matches : [],
    message:
      matches.length === 0
        ? "Employee not found. Check the workbook spelling."
        : matches.length > 1
          ? "Multiple employees match; ask the manager to choose."
          : undefined,
  };
}
