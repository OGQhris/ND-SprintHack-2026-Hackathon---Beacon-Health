import {
  addDays,
  differenceInCalendarDays,
  format,
  formatISO,
  parseISO,
} from "date-fns";

const DATE_FORMAT = "yyyy-MM-dd";

export function addDaysISO(dateISO: string, days: number): string {
  return format(addDays(parseISO(dateISO), days), DATE_FORMAT);
}

/** Whole calendar days from `fromISO` to `toISO` (positive when `toISO` is later). */
export function daysBetween(fromISO: string, toISO: string): number {
  return differenceInCalendarDays(parseISO(toISO), parseISO(fromISO));
}

export function nowISO(): string {
  return formatISO(new Date());
}

export function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}
