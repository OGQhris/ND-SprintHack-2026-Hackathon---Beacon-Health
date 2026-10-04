import type { EmployeeRecord } from "./types";
export const needsAttention = (e: EmployeeRecord) =>
  ["NEEDS_REVIEW", "NOT_FOUND", "ERROR"].includes(e.verificationState) ||
  (e.daysUntilExpiration !== null && e.daysUntilExpiration <= 30) ||
  (!!e.credentialStatus && e.credentialStatus.toLowerCase() !== "active");
