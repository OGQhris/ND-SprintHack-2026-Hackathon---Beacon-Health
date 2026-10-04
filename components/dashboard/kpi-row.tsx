import Link from "next/link";
import { ExpiryBands } from "@/components/shared/expiry-runway";
import { StatCard } from "@/components/shared/stat-card";
import { GROUP_ORDER } from "@/lib/data/sources";
import type { DashboardMetrics, EmployeeGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

const GROUP_SHORT: Record<EmployeeGroup, string> = {
  RNS: "RN",
  RAD_TECHS: "Rad tech",
  US_TECHS: "US tech",
  NUC_MED_TECHS: "Nuc med",
};

const GROUP_TONE: Record<EmployeeGroup, string> = {
  RNS: "bg-seal",
  RAD_TECHS: "bg-ink-soft",
  US_TECHS: "bg-ink-faint",
  NUC_MED_TECHS: "bg-ink-ghost",
};

export function KpiRow({ metrics }: { metrics: DashboardMetrics }) {
  const { totalEmployees, groupCounts, expiringWithin30, expiringTiers, expired, expiredNames, needsAttention } = metrics;
  const groups = GROUP_ORDER.filter((g) => groupCounts[g] > 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
      <StatCard label="Total employees" value={totalEmployees} caption="Monitored across all groups" className="xl:col-span-3">
        <div className="flex flex-col gap-2">
          <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-rule" aria-hidden>
            {groups.map((g) => (
              <div key={g} className={cn("h-full", GROUP_TONE[g])} style={{ flexGrow: groupCounts[g], minWidth: 6 }} />
            ))}
          </div>
          <dl className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
            {groups.map((g) => (
              <div key={g} className="flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", GROUP_TONE[g])} aria-hidden />
                <dt>{GROUP_SHORT[g]}</dt>
                <dd className="numeric font-medium text-ink">{groupCounts[g]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </StatCard>

      <StatCard
        label="Expiring within 30 days"
        value={expiringWithin30}
        tone={expiringWithin30 > 0 ? "warning" : "default"}
        caption="Beacon's reminder windows: 30, 14 and 7 days"
        className="xl:col-span-4"
      >
        <ExpiryBands tiers={expiringTiers} />
      </StatCard>

      <StatCard
        label="Expired"
        value={expired}
        tone={expired > 0 ? "danger" : "default"}
        caption={expired === 0 ? "No lapsed licenses" : "Access lapses on the expiration date"}
        className="xl:col-span-2"
      >
        {expiredNames.length > 0 ? (
          <ul className="flex flex-col gap-0.5 text-sm">
            {expiredNames.slice(0, 2).map((p) => (
              <li key={p.id}>
                <Link href={`/employees/${p.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                  {p.name}
                </Link>
              </li>
            ))}
            {expiredNames.length > 2 ? <li className="text-xs text-ink-faint">and {expiredNames.length - 2} more</li> : null}
          </ul>
        ) : null}
      </StatCard>

      <StatCard
        label="Needs attention"
        value={needsAttention.total}
        tone={needsAttention.total > 0 ? "review" : "default"}
        caption="Verifications a manager must look at"
        className="xl:col-span-3"
      >
        <dl className="flex flex-col gap-1 text-sm text-ink-soft">
          <div className="flex items-center justify-between">
            <dt>Not yet verified</dt>
            <dd className="numeric font-medium text-ink">{needsAttention.unverified}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt>Awaiting manual review</dt>
            <dd className="numeric font-medium text-ink">{needsAttention.needsReview}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt>Failed verification</dt>
            <dd className="numeric font-medium text-ink">{needsAttention.failed}</dd>
          </div>
        </dl>
      </StatCard>
    </div>
  );
}
