// Chat already presents these results inline. Match the check's time window so
// workspace polling can still announce subsequent manual checks of the same person.
type Check = { employeeId: string; startedAt: number; finishedAt?: number; expiresAt: number };
const checks = new Map<string, Check>();

export function trackAssistantVerification(id: string, employeeId: string, startedAt: string): void {
  const now = Date.now();
  for (const [key, check] of checks) if (check.expiresAt < now) checks.delete(key);
  checks.set(id, { employeeId, startedAt: Date.parse(startedAt), expiresAt: now + 15 * 60_000 });
}

export function finishAssistantVerification(id: string): void {
  const check = checks.get(id);
  if (check) check.finishedAt = Date.now();
}

export function isAssistantVerification(employeeId: string, lastChecked: string): boolean {
  const checkedAt = Date.parse(lastChecked);
  const now = Date.now();
  for (const [key, check] of checks) {
    if (check.expiresAt < now) {
      checks.delete(key);
      continue;
    }
    if (check.employeeId === employeeId && checkedAt >= check.startedAt && checkedAt <= (check.finishedAt ?? now)) return true;
  }
  return false;
}
