"use client";

import { ShieldCheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Props = {
  selectedCount: number;
  pageCount: number;
  /** A server-side roster check is in progress (the global banner shows its progress). */
  running: boolean;
  /** The start request is on its way to the server. */
  starting: boolean;
  onVerifySelected: () => void;
  onVerifyPage: () => void;
  onClearSelection: () => void;
  onCancel: () => void;
  className?: string;
};

/** Bulk actions for the employee table. Checks run one at a time on the server; only one roster check runs at once. */
export function SelectionToolbar({
  selectedCount,
  pageCount,
  running,
  starting,
  onVerifySelected,
  onVerifyPage,
  onClearSelection,
  onCancel,
  className,
}: Props) {
  const busy = running || starting;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {selectedCount > 0 ? (
        <>
          <span className="numeric text-sm text-ink">{selectedCount} selected</span>
          <Button size="sm" onClick={onVerifySelected} disabled={busy}>
            <ShieldCheckIcon data-icon="inline-start" />
            Verify selected
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearSelection} className="text-ink-soft">
            <XIcon data-icon="inline-start" />
            Clear
          </Button>
        </>
      ) : null}

      {running ? (
        <div className="ml-auto flex items-center gap-2" role="status" aria-live="polite">
          <Spinner className="text-seal" />
          <span className="text-sm font-medium text-ink">Roster check in progress</span>
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-ink-soft">
            Stop after this one
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={onVerifyPage}
          disabled={pageCount === 0 || busy}
          className="ml-auto bg-paper"
        >
          {starting ? <Spinner data-icon="inline-start" /> : <ShieldCheckIcon data-icon="inline-start" />}
          Verify all on this page
          <span className="numeric text-ink-faint">{pageCount}</span>
        </Button>
      )}
    </div>
  );
}
