import type { CredentialStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const HORIZON = 90;
const TICKS = [7, 14, 30];

const MARKER: Record<CredentialStatus, string> = {
  active: "bg-status-active-dot",
  expiring: "bg-status-expiring-dot",
  expired: "bg-status-expired-dot",
  needs_review: "bg-status-review-dot",
  verification_failed: "bg-status-failed-dot",
};

function position(days: number): number {
  return (Math.min(Math.max(days, 0), HORIZON) / HORIZON) * 100;
}

type TrackProps = {
  daysUntil: number | null;
  status: CredentialStatus;
  variant?: "inline" | "full";
  className?: string;
};

/**
 * The 30/14/7 runway: today on the left, 90 days on the right, ticks at Beacon's reminder points.
 * One glance tells a manager how much road is left before the license expires.
 */
export function ExpiryRunway({ daysUntil, status, variant = "inline", className }: TrackProps) {
  // No date, no runway: the date cell or fact next to it already reads "—" or "Not on file".
  if (daysUntil === null) return null;
  const full = variant === "full";
  const beyond = daysUntil > HORIZON;
  const left = `${position(daysUntil)}%`;
  const markerTone = beyond ? "bg-ink-ghost" : MARKER[status];

  return (
    <div className={cn(full ? "w-full" : "w-14", className)} aria-hidden>
      <div className={cn("relative", full ? "h-4" : "h-3")}>
        <div className={cn("absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full bg-rule", full ? "h-1" : "h-0.5")} />
        {TICKS.map((t) => (
          <span
            key={t}
            className={cn("absolute top-1/2 w-px -translate-y-1/2 bg-ink-ghost", full ? "h-2.5" : "h-1.5")}
            style={{ left: `${position(t)}%` }}
          />
        ))}
        <span
          className={cn(
            "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
            full ? "size-2.5 ring-2 ring-paper" : "size-1.5",
            markerTone,
          )}
          style={{ left }}
        />
      </div>
      {full && (
        <div className="relative mt-1 h-4 text-[11px] text-ink-faint">
          <span className="absolute left-0">Today</span>
          {TICKS.map((t) => (
            <span
              key={t}
              className={cn("absolute -translate-x-1/2", t === 7 && "max-sm:hidden")}
              style={{ left: `${position(t)}%` }}
            >
              {t}d
            </span>
          ))}
          <span className="absolute right-0">90d+</span>
        </div>
      )}
    </div>
  );
}

type StackedProps = {
  tiers: { d7: number; d14: number; d30: number };
  className?: string;
};

/** The same runway as a band: how many people sit in each reminder window. */
export function ExpiryBands({ tiers, className }: StackedProps) {
  const total = tiers.d7 + tiers.d14 + tiers.d30;
  const segments = [
    { key: "d7", label: "7 days", count: tiers.d7, tone: "bg-status-expiring-dot" },
    { key: "d14", label: "14 days", count: tiers.d14, tone: "bg-status-expiring-dot/70" },
    { key: "d30", label: "30 days", count: tiers.d30, tone: "bg-status-expiring-dot/40" },
  ];
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-rule" aria-hidden>
        {total === 0 ? (
          <div className="h-full w-full bg-rule" />
        ) : (
          segments.map((s) =>
            s.count > 0 ? (
              <div key={s.key} className={cn("h-full", s.tone)} style={{ flexGrow: s.count, minWidth: 8 }} />
            ) : null,
          )
        )}
      </div>
      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={cn("size-1.5 rounded-full", s.tone)} aria-hidden />
            <dt>{s.label}</dt>
            <dd className="numeric font-medium text-ink">{s.count}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
