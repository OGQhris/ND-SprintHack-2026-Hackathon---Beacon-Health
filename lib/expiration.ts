export type ExpirationCategory =
  | "UNKNOWN"
  | "EXPIRED"
  | "EXPIRING_WITHIN_7_DAYS"
  | "EXPIRING_WITHIN_14_DAYS"
  | "EXPIRING_WITHIN_30_DAYS"
  | "ACTIVE";
export function todayDate(now?: Date) {
  now ??= new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIMEZONE || "America/Indiana/Indianapolis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function dateOrdinal(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    return null;
  return Math.floor(time / 86400000);
}
export function daysUntilExpiration(
  expiration: string | null,
  today = todayDate(),
): number | null {
  const end = expiration ? dateOrdinal(expiration) : null;
  const start = dateOrdinal(today);
  return end === null || start === null ? null : end - start;
}
export function expirationCategory(
  expiration: string | null,
  today = todayDate(),
): ExpirationCategory {
  const days = daysUntilExpiration(expiration, today);
  if (days === null) return "UNKNOWN";
  if (days < 0) return "EXPIRED";
  if (days <= 7) return "EXPIRING_WITHIN_7_DAYS";
  if (days <= 14) return "EXPIRING_WITHIN_14_DAYS";
  if (days <= 30) return "EXPIRING_WITHIN_30_DAYS";
  return "ACTIVE";
}
