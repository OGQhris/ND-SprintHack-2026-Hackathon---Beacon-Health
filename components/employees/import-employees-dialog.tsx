"use client";

import { FileSpreadsheetIcon, InfoIcon, TriangleAlertIcon, UploadIcon, UserRoundPlusIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { pluralize } from "@/lib/data/format";
import { importEmployeesCsv } from "@/lib/services/employee-import";
import { useStoreState } from "@/lib/store/credential-store";
import { requestWorkspaceRefresh } from "@/lib/store/workspace-events";
import { cn } from "@/lib/utils";

const MAX_BYTES = 1_000_000;
const TEMPLATE_HREF = "/templates/new-hires-template.csv";

function fileProblem(file: File): string | null {
  if (!/\.csv$/i.test(file.name)) return "Choose a .csv file (export it from Excel or Google Sheets).";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_BYTES) return "That file is larger than 1 MB.";
  return null;
}

const formatSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`);
const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

/**
 * "Add employees": drop an HR export, optionally verify the new people right away. The upload stands in for
 * the HR feed a production deployment would receive automatically; the dialog says so.
 */
export function ImportEmployeesDialog({ trigger }: { trigger?: ReactNode }) {
  const { batch } = useStoreState();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [verify, setVerify] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const inputId = useId();
  const dragDepth = useRef(0);
  const zoneRef = useRef<HTMLLabelElement>(null);
  const batchRunning = batch.running;
  const willVerify = verify && !batchRunning;

  // While the dialog is open, a file dropped outside the zone must not navigate the page away,
  // and the cursor outside the zone shows "no drop" instead of "copy".
  useEffect(() => {
    if (!open) return;
    const block = (event: globalThis.DragEvent) => {
      event.preventDefault();
      const inZone = event.target instanceof Node && !!zoneRef.current?.contains(event.target);
      if (event.type === "dragover" && !inZone && event.dataTransfer) event.dataTransfer.dropEffect = "none";
    };
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, [open]);

  function reset() {
    setFile(null);
    setError(null);
    setNotice(null);
    setDragging(false);
    dragDepth.current = 0;
  }

  function choose(candidate: File | undefined) {
    if (!candidate) return;
    const problem = fileProblem(candidate);
    setError(problem);
    setFile(problem ? null : candidate);
  }

  const onDragEnter = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragOver = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!importing) choose(event.dataTransfer.files[0]);
  };

  function close() {
    setOpen(false);
    reset();
  }

  async function submit() {
    if (!file || importing) return;
    setImporting(true);
    setError(null);
    const call = await importEmployeesCsv(file, { verify: willVerify });
    setImporting(false);
    if (!call.ok) {
      setError(call.error);
      return;
    }
    const { imported, alreadyOnRoster, skipped, verification } = call.data;
    const notes: string[] = [];
    if (alreadyOnRoster.length) notes.push(`${pluralize(alreadyOnRoster.length, "person", "people")} already on the roster`);
    if (skipped.length) notes.push(`${pluralize(skipped.length, "row")} skipped`);
    if (imported.length === 0) {
      // Nothing changed: say so in the dialog instead of a green toast, with the first reasons.
      const reasons = skipped.slice(0, 3).map((s) => `row ${s.row}: ${s.reason.toLowerCase()}`);
      setNotice(`Nobody was added (${notes.join(", ")}).${reasons.length ? ` ${reasons.join("; ")}.` : ""}`);
      return;
    }
    toast.success(`${pluralize(imported.length, "employee")} added`, { description: notes.join(" · ") || undefined });
    if (verification.requested && !verification.started) {
      toast.warning("Verification did not start", { description: verification.message });
    }
    requestWorkspaceRefresh();
    close();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (importing) return;
        if (next) setOpen(true);
        else close();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="bg-paper">
            <UserRoundPlusIcon data-icon="inline-start" />
            Add employees
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-paper sm:max-w-md"
        showCloseButton={!importing}
        onEscapeKeyDown={(event) => {
          if (importing) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (importing) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-ink">Add employees</DialogTitle>
          <DialogDescription>Drop an HR export of new hires. Names are kept exactly as written.</DialogDescription>
        </DialogHeader>

        <p className="rounded-lg bg-folder px-3 py-2 text-xs leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">Demo shortcut. </span>
          In production Beacon receives new hires automatically from the HR system, so nobody uploads anything.
          This upload stands in for that feed.
        </p>

        <div className="flex flex-col gap-1.5">
          <label
            ref={zoneRef}
            htmlFor={inputId}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-rule bg-folder/60 px-4 py-6 text-center transition-colors hover:bg-folder",
              "has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              dragging && "border-seal bg-seal-tint",
              importing && "pointer-events-none opacity-60",
            )}
          >
            <input
              id={inputId}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={importing}
              onChange={(event) => {
                choose(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {file ? (
              <>
                <FileSpreadsheetIcon className="size-5 text-seal" aria-hidden />
                <span className="text-sm font-medium text-ink">{file.name}</span>
                <span className="numeric text-xs text-ink-faint">{formatSize(file.size)} · click to change</span>
              </>
            ) : (
              <>
                <UploadIcon className="size-5 text-ink-faint" aria-hidden />
                <span className="text-sm font-medium text-ink">Drag a CSV here or click to browse</span>
              </>
            )}
          </label>
          <p className="text-xs text-ink-faint">
            Columns: First name, Last name, Manager (optional). Up to 500 people per file.{" "}
            <a href={TEMPLATE_HREF} download className="font-medium text-seal underline-offset-4 hover:underline">
              Download the template
            </a>
            .
          </p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {notice ? (
          <Alert className="border-rule bg-folder text-ink">
            <InfoIcon />
            <AlertDescription className="text-ink-soft">{notice}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-start gap-3 rounded-lg border border-rule px-3 py-2.5">
          <Checkbox
            id={`${inputId}-verify`}
            checked={willVerify}
            disabled={batchRunning || importing}
            onCheckedChange={(value) => setVerify(value === true)}
            aria-describedby={`${inputId}-verify-help`}
            className="mt-0.5"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${inputId}-verify`} className={cn("text-ink", batchRunning && "opacity-50")}>
              Verify after import
            </Label>
            <p id={`${inputId}-verify-help`} className="text-xs leading-relaxed text-ink-soft">
              {batchRunning
                ? "A roster check is already running. Verify the new people from the Employees page when it finishes."
                : "Checks each new person against Michigan MILARA, one at a time, about a minute each. Stop after the current check from the banner."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!file} aria-busy={importing} aria-disabled={importing}>
            {importing ? <Spinner data-icon="inline-start" /> : <UploadIcon data-icon="inline-start" />}
            {willVerify ? "Import and verify" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
