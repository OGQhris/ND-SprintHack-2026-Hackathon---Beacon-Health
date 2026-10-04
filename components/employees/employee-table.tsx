"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { HistoryIcon, MoreHorizontalIcon, ShieldCheckIcon, UserIcon, UsersIcon } from "lucide-react";
import { EmployeeCardList } from "@/components/employees/employee-card-list";
import { EmptyState } from "@/components/shared/empty-state";
import { ExpiryRunway } from "@/components/shared/expiry-runway";
import { LastChecked } from "@/components/shared/last-checked";
import { DemoTag, SampleTag, SourceLabel } from "@/components/shared/source-label";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, fullName, initials } from "@/lib/data/format";
import { GROUP_META } from "@/lib/data/sources";
import { statusDetail } from "@/lib/data/status";
import type { EmployeeRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export type TableSelection = {
  selected: Set<string>;
  onToggle: (employeeId: string, checked: boolean) => void;
  onToggleAll: (employeeIds: string[], checked: boolean) => void;
};

type Props = {
  rows: EmployeeRow[];
  today: string;
  sampleCount?: number;
  selection?: TableSelection;
  onClearFilters?: () => void;
  className?: string;
};

const HEAD = "h-9 bg-folder-inset/60 px-2.5 text-xs font-medium text-ink-faint";
const CELL = "px-2.5 py-2 text-sm";

export function EmployeeTable({ rows, today, sampleCount = 0, selection, onClearFilters, className }: Props) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="No employees match these filters"
        description="Try a different group, source, or status."
        action={
          onClearFilters ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
        className={className}
      />
    );
  }

  const ids = rows.map((r) => r.employee.id);
  const selectedOnPage = selection ? ids.filter((id) => selection.selected.has(id)).length : 0;
  const headerState = selectedOnPage === 0 ? false : selectedOnPage === ids.length ? true : "indeterminate";

  return (
    <>
      <EmployeeCardList rows={rows} today={today} sampleCount={sampleCount} className={cn("md:hidden", className)} />
      <div className={cn("hidden overflow-hidden rounded-lg border border-rule bg-paper md:block", className)}>
        <Table className="numeric">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selection ? (
                <TableHead className={cn(HEAD, "w-10")}>
                  <Checkbox
                    checked={headerState}
                    onCheckedChange={(checked) => selection.onToggleAll(ids, checked === true)}
                    aria-label="Select everyone on this page"
                  />
                </TableHead>
              ) : null}
              <TableHead className={cn(HEAD, "min-w-[200px]")}>Employee and role</TableHead>
              <TableHead className={HEAD}>Group</TableHead>
              <TableHead className={HEAD}>Credential</TableHead>
              <TableHead className={HEAD}>Source</TableHead>
              <TableHead className={HEAD}>Expiration</TableHead>
              <TableHead className={HEAD}>Status</TableHead>
              <TableHead className={HEAD}>Last checked</TableHead>
              <TableHead className={cn(HEAD, "w-12 text-right")}>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ employee, credential, derived }) => {
              const href = `/employees/${employee.id}`;
              const detail = statusDetail(derived, credential);
              return (
                <TableRow
                  key={employee.id}
                  tabIndex={0}
                  onClick={() => router.push(href)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(href);
                  }}
                  data-selected={selection?.selected.has(employee.id) || undefined}
                  className="h-11 cursor-pointer border-rule hover:bg-folder-hover focus-visible:bg-folder-hover focus-visible:outline-none data-selected:bg-seal-tint/40"
                >
                  {selection ? (
                    <TableCell className={cn(CELL, "w-10")} onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selection.selected.has(employee.id)}
                        onCheckedChange={(checked) => selection.onToggle(employee.id, checked === true)}
                        aria-label={`Select ${fullName(employee)}`}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className={CELL}>
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        <AvatarFallback className="bg-seal-tint text-[10px] font-semibold text-seal-strong">
                          {initials(employee)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col leading-tight">
                        <span className="flex items-center gap-1.5">
                          <Link
                            href={href}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-ink underline-offset-4 hover:underline"
                          >
                            {fullName(employee)}
                          </Link>
                          {employee.isSample ? <SampleTag /> : null}
                        </span>
                        <span className="text-xs text-ink-faint">{employee.role}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={cn(CELL, "text-ink-soft")} title={GROUP_META[employee.group].label}>
                    {GROUP_META[employee.group].shortLabel}
                  </TableCell>
                  <TableCell className={CELL}>
                    <div className="flex flex-col leading-tight">
                      <span className="max-w-[176px] truncate text-ink" title={credential.credentialType}>
                        {credential.credentialType}
                      </span>
                      {credential.credentialNumber ? (
                        <span className="text-xs text-ink-faint">{credential.credentialNumber}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className={cn(CELL, "text-ink-soft")}>
                    <SourceLabel source={credential.source} />
                  </TableCell>
                  <TableCell className={CELL}>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-ink">
                        {formatDate(credential.expirationDate)}
                        {credential.demoExpiration ? <DemoTag /> : null}
                      </span>
                      <ExpiryRunway daysUntil={derived.daysUntil} status={derived.status} />
                    </div>
                  </TableCell>
                  <TableCell className={CELL}>
                    <div className="flex flex-col items-start gap-0.5">
                      <StatusBadge derived={derived} />
                      {detail && derived.status !== "active" ? (
                        <span className="text-xs text-ink-faint">{detail}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className={cn(CELL, "text-ink-soft")}>
                    {credential.inFlight ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-seal-strong">
                        <Spinner className="size-3.5 text-seal" />
                        Checking now
                      </span>
                    ) : (
                      <LastChecked iso={credential.lastChecked} today={today} />
                    )}
                  </TableCell>
                  <TableCell className={cn(CELL, "text-right")} onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${fullName(employee)}`}>
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="float-shadow">
                        <DropdownMenuGroup>
                          <DropdownMenuItem asChild>
                            <Link href={href}>
                              <UserIcon />
                              View employee
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`${href}?verify=1`}>
                              <ShieldCheckIcon />
                              Verify now
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`${href}#history`}>
                              <HistoryIcon />
                              View verification history
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {sampleCount > 0 ? (
          <p className="border-t border-rule px-3 py-2 text-xs text-ink-faint">
            Includes {sampleCount} fictional sample {sampleCount === 1 ? "employee" : "employees"}, labeled Sample.
          </p>
        ) : null}
      </div>
    </>
  );
}
