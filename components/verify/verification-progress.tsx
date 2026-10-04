import { ScanLineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { VerificationMode } from "@/lib/types";
import { cn } from "@/lib/utils";

export type VerificationProgressState = {
  stage: number;
  totalStages: number;
  holding?: boolean;
};

type Props = {
  stage: number;
  totalStages: number;
  label: string;
  holding?: boolean;
  mode: VerificationMode;
  /** Opens the live browser viewer for this run (live mode only). */
  onWatch?: () => void;
  className?: string;
  showBar?: boolean;
};

export function VerificationProgress({
  stage,
  totalStages,
  label,
  holding,
  mode,
  onWatch,
  className,
  showBar = true,
}: Props) {
  const fraction = Math.min((stage + 1) / totalStages, 1);
  return (
    <div
      className={cn("flex w-full min-w-0 flex-col gap-2", className)}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <Spinner className="shrink-0 text-seal" />
        <span className="min-w-0 flex-1">
          {label}
          <span className="text-ink-faint">…</span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {onWatch ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="bg-paper"
              onClick={onWatch}
            >
              <ScanLineIcon data-icon="inline-start" />
              Watch the browser
            </Button>
          ) : null}
          {mode === "simulated" ? (
            <span className="inline-flex h-4 items-center rounded-sm bg-folder-inset px-1 text-[10px] font-semibold tracking-wide text-ink-faint">
              Simulated
            </span>
          ) : null}
        </span>
      </div>
      {showBar ? (
        <div
          className="h-0.5 w-full overflow-hidden rounded-full bg-rule"
          aria-hidden
        >
          <div
            className={cn(
              "h-full origin-left rounded-full bg-seal transition-transform duration-300 ease-out",
              holding && "animate-pulse",
            )}
            style={{ transform: `scaleX(${fraction})` }}
          />
        </div>
      ) : null}
      <p className="text-xs text-ink-faint">
        Step {Math.min(stage + 1, totalStages)} of {totalStages}
        {holding ? ". The credential source is taking longer than usual." : ""}
      </p>
    </div>
  );
}
