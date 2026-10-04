"use client";

import { RotateCcwIcon, ShieldCheckIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { watchVerification } from "@/components/verification/viewer-events";
import {
  STAGES,
  useVerifyCredential,
} from "@/components/verify/use-verify-credential";
import { VerificationProgress } from "@/components/verify/verification-progress";
import { VerificationResult } from "@/components/verify/verification-result";
import { SOURCE_META } from "@/lib/data/sources";
import type { CredentialSource } from "@/lib/types";

type Props = {
  employeeId: string;
  source: CredentialSource;
  sourceLink?: string;
  /** Start a run as soon as the panel mounts (used by the table's "Verify now" action). */
  autoStart?: boolean;
  /** Small outline trigger for use inside alert cards. */
  compact?: boolean;
  /** Compact trigger wording: "Verify now" for a credential that was never checked, "Reverify" otherwise. */
  compactLabel?: "Verify now" | "Reverify";
  onRecord?: (recordId: string) => void;
};

export function VerifyPanel(props: Props) {
  const verify = useVerifyCredential(props.employeeId);
  return <VerifyPanelControls {...props} verify={verify} />;
}

/** Shared controls; detail pages own the check state so the card edge stays in sync. */
export function VerifyPanelControls({
  employeeId,
  source,
  sourceLink,
  autoStart,
  compact,
  compactLabel = "Reverify",
  onRecord,
  verify,
  cardEdgeProgress = false,
}: Props & {
  verify: ReturnType<typeof useVerifyCredential>;
  cardEdgeProgress?: boolean;
}) {
  const { phase, start, lastRecordId } = verify;

  useEffect(() => {
    if (autoStart && phase === "idle") {
      const id = setTimeout(() => void start(), 400);
      return () => clearTimeout(id);
    }
    // Reacts only to the mount-time autoStart flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  useEffect(() => {
    if (lastRecordId) onRecord?.(lastRecordId);
  }, [lastRecordId, onRecord]);

  if (phase === "running") {
    return (
      <VerificationProgress
        stage={verify.stage}
        totalStages={STAGES.length}
        label={verify.stageLabel}
        holding={verify.holding}
        mode={verify.mode}
        showBar={!cardEdgeProgress}
        onWatch={
          verify.mode === "live"
            ? () => watchVerification(employeeId)
            : undefined
        }
      />
    );
  }

  if (phase === "complete" && verify.outcome) {
    return (
      <VerificationResult
        outcome={verify.outcome}
        sourceLink={sourceLink}
        onRetry={() => {
          verify.reset();
          void start();
        }}
        onDismiss={verify.reset}
      />
    );
  }

  if (compact) {
    const CompactIcon =
      compactLabel === "Verify now" ? ShieldCheckIcon : RotateCcwIcon;
    return (
      <Button variant="outline" size="sm" onClick={() => void start()}>
        <CompactIcon data-icon="inline-start" />
        {compactLabel}
      </Button>
    );
  }

  const meta = SOURCE_META[source];
  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <Button
        size="lg"
        className="h-10 px-4 text-sm"
        onClick={() => void start()}
      >
        <ShieldCheckIcon data-icon="inline-start" />
        Verify now
      </Button>
      <p className="text-xs text-ink-faint">
        {verify.mode === "live"
          ? `Checks ${meta.label} directly.`
          : `Simulated for ${meta.shortLabel} in this demo.`}
      </p>
    </div>
  );
}
