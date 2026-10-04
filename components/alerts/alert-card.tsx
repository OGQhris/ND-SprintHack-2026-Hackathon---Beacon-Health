"use client";

import Link from "next/link";
import { BellOffIcon, CheckIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VerifyPanel } from "@/components/verify/verify-panel";
import { recordAlertAction } from "@/lib/data/actions";
import { SEVERITY_LABEL } from "@/lib/data/alerts";
import { formatDaysAgo, fullName } from "@/lib/data/format";
import { GROUP_META } from "@/lib/data/sources";
import { useCredentialStore } from "@/lib/store/credential-store";
import type { Alert, AlertSeverity, Employee, EmployeeRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { nowISO } from "@/lib/data/clock";

const SEVERITY_TONE: Record<AlertSeverity, { chip: string; rail: string }> = {
  critical: { chip: "bg-status-expired-bg text-status-expired-fg", rail: "bg-status-expired-dot" },
  warning: { chip: "bg-status-expiring-bg text-status-expiring-fg", rail: "bg-status-expiring-dot" },
  review: { chip: "bg-status-review-bg text-status-review-fg", rail: "bg-status-review-dot" },
};

type Props = { alert: Alert; row: EmployeeRow; today: string };

export function AlertCard({ alert, row, today }: Props) {
  const { dispatch } = useCredentialStore();
  const { employee, credential } = row;
  const tone = SEVERITY_TONE[alert.severity];
  const kindLabel = alert.title.split(" · ")[1] ?? alert.title;

  const base = { alertId: alert.id, credentialId: alert.credentialId, employeeId: alert.employeeId, kind: alert.kind };

  function persist(input: Parameters<typeof recordAlertAction>[0]) {
    void recordAlertAction(input).then((saved) => {
      if (!saved.ok) toast.warning("Saved on this screen only", { description: `The database write failed: ${saved.error}` });
    });
  }

  function reopen() {
    dispatch({ type: "ALERT_REOPENED", alertId: alert.id });
    persist({ ...base, status: "open" });
  }

  function resolve() {
    dispatch({ type: "ALERT_RESOLVED", alertId: alert.id });
    persist({ ...base, status: "resolved" });
    toast("Alert resolved", {
      description: `${fullName(employee)} will not appear in open alerts.`,
      action: { label: "Undo", onClick: reopen },
    });
  }

  function remind() {
    const at = nowISO();
    dispatch({ type: "REMINDER_SENT", alertId: alert.id, at });
    persist({ ...base, reminderSentAt: at });
    toast.info(`Reminder noted for ${employee.managerName ?? "the manager"}`, {
      description: "Logged on this alert. Email delivery is not part of this demo.",
    });
  }

  return (
    <article
      className={cn("relative flex flex-col gap-3 rounded-lg border border-rule bg-paper py-4 pr-4 pl-5", alert.resolved && "opacity-60")}
      aria-label={alert.title}
    >
      <span aria-hidden className={cn("absolute inset-y-3 left-0 w-0.5 rounded-r", tone.rail)} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex h-[22px] items-center rounded-md px-2 text-xs font-semibold", tone.chip)}>
              {SEVERITY_LABEL[alert.severity]}
            </span>
            <h3 className="text-sm font-semibold text-ink">{kindLabel}</h3>
          </div>
          <p className="text-sm text-ink">
            <Link href={`/employees/${employee.id}`} className="font-medium underline-offset-4 hover:underline">
              {fullName(employee)}
            </Link>
            <span className="text-ink-soft">
              {" "}
              {employee.role}, {GROUP_META[employee.group].label}
            </span>
          </p>
          <p className="text-sm text-ink-soft">{alert.detail}</p>
          <Meta alert={alert} employee={employee} today={today} />
        </div>
        <div className="w-full max-w-full shrink-0 sm:w-[36rem]">
          <VerifyPanel
            employeeId={employee.id}
            source={credential.source}
            compact
            compactLabel={credential.verificationState === "unverified" ? "Verify now" : "Reverify"}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/employees/${employee.id}`}>
            <UserIcon data-icon="inline-start" />
            View employee
          </Link>
        </Button>
        {alert.resolved ? (
          <Button variant="ghost" size="sm" onClick={reopen}>
            Reopen
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={resolve}>
              <CheckIcon data-icon="inline-start" />
              Mark resolved
            </Button>
            {alert.severity === "warning" ? (
              <Button variant="ghost" size="sm" onClick={remind} disabled={Boolean(alert.reminderSentAt)}>
                <BellOffIcon data-icon="inline-start" />
                {alert.reminderSentAt ? "Reminder noted" : "Send reminder"}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

function Meta({ alert, employee, today }: { alert: Alert; employee: Employee; today: string }) {
  if (!alert.reminderSentAt && !alert.resolved) return null;
  return (
    <p className="text-xs text-ink-faint">
      {alert.resolved ? "Resolved by manager. " : ""}
      {alert.reminderSentAt
        ? `Reminder noted for ${employee.managerName ?? "manager"} ${formatDaysAgo(alert.reminderSentAt, today).toLowerCase()}.`
        : ""}
    </p>
  );
}
