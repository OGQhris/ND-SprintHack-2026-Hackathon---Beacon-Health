import { format, parseISO } from "date-fns";
import type { Employee } from "@/lib/types";
import { dateOnly, daysBetween } from "@/lib/data/clock";

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  return format(parseISO(iso), "MMM d, yyyy");
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  return format(parseISO(iso), "MMM d, yyyy, h:mm a");
}

/** Deterministic "n days ago" relative to the app clock (safe for server rendering). */
export function formatDaysAgo(iso: string | undefined, today: string): string {
  if (!iso) return "Never";
  const days = daysBetween(dateOnly(iso), today);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function fullName(e: Pick<Employee, "firstName" | "lastName">): string {
  return `${e.firstName} ${e.lastName}`.trim();
}

export function initials(e: Pick<Employee, "firstName" | "lastName">): string {
  return `${e.firstName.charAt(0)}${e.lastName.charAt(0)}`.toUpperCase();
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
