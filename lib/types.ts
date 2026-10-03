import type { Employee } from "@prisma/client";
import type { ExpirationCategory } from "./expiration";
export type EmployeeRecord = Omit<
  Employee,
  "createdAt" | "updatedAt" | "lastVerifiedAt" | "lastAttemptAt"
> & {
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
  lastAttemptAt: string | null;
  expirationCategory: ExpirationCategory;
  daysUntilExpiration: number | null;
};
export type Summary = {
  total: number;
  verified: number;
  unverified: number;
  active: number;
  expired: number;
  expiringWithin7Days: number;
  expiringWithin14Days: number;
  expiringWithin30Days: number;
  needsReview: number;
  notFound: number;
  errors: number;
  attention: number;
};
export type BatchProgress = {
  running: boolean;
  completed: number;
  total: number;
  verified: number;
  failed: number;
  currentEmployee: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};
export type DashboardData = {
  employees: EmployeeRecord[];
  summary: Summary;
  batch: BatchProgress;
  today: string;
  aiConfigured: boolean;
  managers: string[];
};
