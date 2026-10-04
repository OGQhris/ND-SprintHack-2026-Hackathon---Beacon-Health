"use client";

import { BellRingIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { AlertCard } from "@/components/alerts/alert-card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAlerts, joinRows } from "@/lib/data/selectors";
import { useStoreState } from "@/lib/store/credential-store";
import type { Alert, AlertKind } from "@/lib/types";

export type AlertTab = "all" | "expired" | "7" | "14" | "30" | "issues";

const TABS: { id: AlertTab; label: string; kinds: AlertKind[] | null }[] = [
  { id: "all", label: "All", kinds: null },
  { id: "expired", label: "Expired", kinds: ["expired"] },
  { id: "7", label: "7 days", kinds: ["expiring_7"] },
  { id: "14", label: "14 days", kinds: ["expiring_14"] },
  { id: "30", label: "30 days", kinds: ["expiring_30"] },
  { id: "issues", label: "Verification issues", kinds: ["needs_review", "verification_failed"] },
];

const EMPTY_COPY: Record<AlertTab, string> = {
  all: "Everyone is current. Nothing needs your attention right now.",
  expired: "No expired licenses.",
  "7": "No licenses expire in the next 7 days.",
  "14": "No licenses expire in the 8 to 14 day window.",
  "30": "No licenses expire in the 15 to 30 day window.",
  issues: "No verifications are waiting on review.",
};

export function AlertsView({ initialTab = "all" }: { initialTab?: AlertTab }) {
  const state = useStoreState();
  const [tab, setTab] = useState<AlertTab>(initialTab);
  const [showResolved, setShowResolved] = useState(false);

  const alerts = useMemo(() => getAlerts(state), [state]);
  const rowsById = useMemo(() => new Map(joinRows(state).map((r) => [r.employee.id, r])), [state]);

  const open = alerts.filter((a) => !a.resolved);
  const resolvedCount = alerts.length - open.length;
  const countFor = (kinds: AlertKind[] | null) => (kinds ? open.filter((a) => kinds.includes(a.kind)).length : open.length);
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  const visible: Alert[] = alerts.filter(
    (a) => (showResolved || !a.resolved) && (current.kinds ? current.kinds.includes(a.kind) : true),
  );

  return (
    <>
      <PageHeader
        title="Credential Alerts"
        subtitle="Review credentials requiring manager attention."
        actions={
          resolvedCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setShowResolved((v) => !v)} className="text-ink-soft">
              {showResolved ? "Hide resolved" : `Show resolved (${resolvedCount})`}
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as AlertTab)}>
        <TabsList
          variant="line"
          className="w-full justify-start gap-1 overflow-x-auto border-b border-rule [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((t) => {
            const n = countFor(t.kinds);
            return (
              <TabsTrigger key={t.id} value={t.id} className="h-9 flex-none px-3 text-sm">
                {t.label}
                <span className="numeric rounded-sm bg-folder-inset px-1.5 text-[11px] font-medium text-ink-soft">{n}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <EmptyState icon={BellRingIcon} title="No alerts in this window" description={EMPTY_COPY[tab]} />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((alert) => {
            const row = rowsById.get(alert.employeeId);
            return row ? <AlertCard key={alert.id} alert={alert} row={row} today={state.today} /> : null;
          })}
        </div>
      )}
    </>
  );
}
