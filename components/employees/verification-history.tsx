"use client";

import { HistoryIcon, PlayIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusDot } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { openVerificationReplay } from "@/components/verification/viewer-events";
import { formatDate, formatDateTime } from "@/lib/data/format";
import { SOURCE_META } from "@/lib/data/sources";
import { REASON_LABEL } from "@/lib/data/status";
import type { CredentialStatus, VerificationRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const OUTCOME: Record<VerificationRecord["outcome"], { label: string; status: CredentialStatus }> = {
  verified: { label: "Verified", status: "active" },
  needs_review: { label: "Needs review", status: "needs_review" },
  verification_failed: { label: "Failed", status: "verification_failed" },
};

const MODE_LABEL: Record<VerificationRecord["mode"], string | null> = {
  seed: null,
  simulated: "Simulated",
  live: "Live",
};

const HEAD = "h-9 bg-folder-inset/60 px-3 text-xs font-medium text-ink-faint";
const CELL = "px-3 py-2 text-sm";

function ModeChip({ mode }: { mode: VerificationRecord["mode"] }) {
  const label = MODE_LABEL[mode];
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex h-4 items-center rounded-sm px-1 text-[10px] font-semibold tracking-wide",
        mode === "live" ? "bg-seal-tint text-seal-strong" : "bg-folder-inset text-ink-faint",
      )}
    >
      {label}
    </span>
  );
}

/** Opens the browser recording of this check in the verification viewer. */
function ReplayButton({ recordingId, className }: { recordingId: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn("text-ink-soft", className)}
          aria-label="Replay this verification"
          onClick={() => openVerificationReplay(recordingId)}
        >
          <PlayIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Replay the browser recording</TooltipContent>
    </Tooltip>
  );
}

type Props = { records: VerificationRecord[]; highlightId?: string; className?: string };

export function VerificationHistory({ records, highlightId, className }: Props) {
  return (
    <section id="history" className={cn("flex flex-col gap-3", className)} aria-label="Verification history">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-base font-semibold text-ink">Verification history</h2>
        <p className="text-xs text-ink-faint">
          {records.length} {records.length === 1 ? "record" : "records"}. A digital audit trail replaces the printed license in the employee file.
        </p>
      </div>
      {records.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="No verifications yet" description="Run Verify now to create the first record." />
      ) : (
        <>
          <ol className="flex flex-col gap-2 md:hidden">
            {records.map((r) => {
              const o = OUTCOME[r.outcome];
              const recordingId = r.recordingId;
              return (
                <li
                  key={r.id}
                  className={cn("flex flex-col gap-1.5 rounded-lg border border-rule bg-paper p-3 text-sm", r.id === highlightId && "flash-seal")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="numeric text-xs text-ink-faint">{formatDateTime(r.checkedAt)}</span>
                    <span className="flex items-center gap-1.5">
                      <ModeChip mode={r.mode} />
                      {recordingId ? <ReplayButton recordingId={recordingId} /> : null}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                    <StatusDot status={o.status} />
                    {r.reason ? REASON_LABEL[r.reason] : o.label}
                    {r.note ? <span className="font-normal text-ink-faint">{r.note}</span> : null}
                  </span>
                  <span className="numeric text-xs text-ink-soft">
                    {r.credentialType ?? "—"}
                    {r.credentialNumber ? ` ${r.credentialNumber}` : ""}
                    {r.expirationDate ? `, expires ${formatDate(r.expirationDate)}` : ""}
                    {`, ${SOURCE_META[r.source].shortLabel}`}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="hidden overflow-hidden rounded-lg border border-rule bg-paper md:block">
            <Table className="numeric">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={HEAD}>Date</TableHead>
                  <TableHead className={HEAD}>Credential</TableHead>
                  <TableHead className={HEAD}>Status</TableHead>
                  <TableHead className={HEAD}>Expiration</TableHead>
                  <TableHead className={HEAD}>Source</TableHead>
                  <TableHead className={HEAD}>Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => {
                  const o = OUTCOME[r.outcome];
                  const recordingId = r.recordingId;
                  return (
                    <TableRow
                      key={r.id}
                      className={cn("h-10 border-rule hover:bg-folder-hover", r.id === highlightId && "flash-seal")}
                    >
                      <TableCell className={cn(CELL, "text-ink")}>{formatDateTime(r.checkedAt)}</TableCell>
                      <TableCell className={CELL}>
                        <div className="flex flex-col leading-tight">
                          <span className="text-ink">{r.credentialType ?? "—"}</span>
                          {r.credentialNumber ? <span className="text-xs text-ink-faint">{r.credentialNumber}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className={CELL}>
                        <span className="inline-flex items-center gap-1.5 text-ink">
                          <StatusDot status={o.status} />
                          {r.outcome === "verified" ? "Active" : o.label}
                        </span>
                      </TableCell>
                      <TableCell className={cn(CELL, "text-ink")}>{formatDate(r.expirationDate)}</TableCell>
                      <TableCell className={cn(CELL, "text-ink-soft")}>{SOURCE_META[r.source].shortLabel}</TableCell>
                      <TableCell className={CELL}>
                        <div className="flex items-center gap-2">
                          <span className="text-ink">{r.reason ? REASON_LABEL[r.reason] : o.label}</span>
                          {r.note ? <span className="text-xs text-ink-faint">{r.note}</span> : null}
                          <ModeChip mode={r.mode} />
                          {recordingId ? <ReplayButton recordingId={recordingId} className="ml-auto" /> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}
