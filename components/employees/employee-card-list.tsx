"use client";

import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { LastChecked } from "@/components/shared/last-checked";
import { DemoTag, SampleTag, SourceLabel } from "@/components/shared/source-label";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { formatDate, fullName, initials } from "@/lib/data/format";
import { GROUP_META } from "@/lib/data/sources";
import { statusDetail } from "@/lib/data/status";
import type { EmployeeRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  rows: EmployeeRow[];
  today: string;
  sampleCount?: number;
  className?: string;
};

/** Phone-width presentation of the same rows the table shows on desktop. */
export function EmployeeCardList({ rows, today, sampleCount = 0, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {rows.map(({ employee, credential, derived }) => {
        const detail = statusDetail(derived, credential);
        return (
          <Link
            key={employee.id}
            href={`/employees/${employee.id}`}
            className="flex gap-3 rounded-lg border border-rule bg-paper p-3 outline-none active:bg-folder-hover focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar size="default">
              <AvatarFallback className="bg-seal-tint text-xs font-semibold text-seal-strong">
                {initials(employee)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <span className="truncate">{fullName(employee)}</span>
                    {employee.isSample ? <SampleTag /> : null}
                  </p>
                  <p className="truncate text-xs text-ink-faint">
                    {employee.role}, {GROUP_META[employee.group].shortLabel}
                  </p>
                </div>
                <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-ink-ghost" aria-hidden />
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <StatusBadge derived={derived} />
                {detail && derived.status !== "active" ? <span className="text-xs text-ink-faint">{detail}</span> : null}
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-ink-faint">Expires</dt>
                  <dd className="numeric flex items-center gap-2 text-ink">
                    <span className="inline-flex items-center gap-1.5">
                      {formatDate(credential.expirationDate)}
                      {credential.demoExpiration ? <DemoTag /> : null}
                    </span>
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-ink-faint">Last checked</dt>
                  <dd className="text-ink">
                    {credential.inFlight ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-seal-strong">
                        <Spinner className="size-3 text-seal" />
                        Checking now
                      </span>
                    ) : (
                      <LastChecked iso={credential.lastChecked} today={today} />
                    )}
                  </dd>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-ink-faint">Credential</dt>
                  <dd className="numeric truncate text-ink" title={credential.credentialType}>
                    {credential.credentialType}
                    {credential.credentialNumber ? ` ${credential.credentialNumber}` : ""}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-ink-faint">Source</dt>
                  <dd className="text-ink">
                    <SourceLabel source={credential.source} />
                  </dd>
                </div>
              </dl>
            </div>
          </Link>
        );
      })}
      {sampleCount > 0 ? (
        <p className="px-1 text-xs text-ink-faint">
          Includes {sampleCount} sample {sampleCount === 1 ? "record" : "records"} for non-RN groups.
        </p>
      ) : null}
    </div>
  );
}
