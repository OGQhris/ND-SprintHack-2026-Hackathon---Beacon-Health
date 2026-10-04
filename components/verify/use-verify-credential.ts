"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { commitVerification, outcomeTitle } from "@/components/verify/commit-verification";
import { getRowForEmployee } from "@/lib/data/selectors";
import { resolveVerifyMode, verifyCredential } from "@/lib/services/credential-verification";
import { useCredentialStore } from "@/lib/store/credential-store";
import type { VerificationOutcome } from "@/lib/types";

export type VerifyPhase = "idle" | "running" | "complete";

export const STAGES = [
  "Starting verification",
  "Connecting to credential source",
  "Searching credential records",
  "Credential record found",
  "Updating credential history",
  "Verification complete",
] as const;

const HOLD_LABEL = "Still searching the credential source";
const HOLD_AFTER_MS = 15_000;
const MIN_SEARCH_MS = 2_100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { outcomeTitle };

/**
 * Orchestrates one Verify Now run: staged copy on a timer, the service call, the store/database update, and the toast.
 * "Credential record found" is never shown before the source has answered, and a run cannot be started twice.
 */
export function useVerifyCredential(employeeId: string) {
  const { state, dispatch } = useCredentialStore();
  const router = useRouter();
  const [phase, setPhase] = useState<VerifyPhase>("idle");
  const [stage, setStage] = useState(0);
  const [holding, setHolding] = useState(false);
  const [outcome, setOutcome] = useState<VerificationOutcome | null>(null);
  const [foundLabel, setFoundLabel] = useState<string>(STAGES[3]);
  const [lastRecordId, setLastRecordId] = useState<string | undefined>();
  const alive = useRef(true);
  const running = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const row = getRowForEmployee(state, employeeId);
  const mode = row ? resolveVerifyMode(row.credential.source) : "simulated";

  const start = useCallback(async () => {
    if (!row || running.current) return;
    running.current = true;
    const { employee, credential } = row;
    setPhase("running");
    setOutcome(null);
    setStage(0);
    setHolding(false);

    const timers = [
      setTimeout(() => alive.current && setStage(1), 700),
      setTimeout(() => alive.current && setStage(2), 1400),
      setTimeout(() => alive.current && setHolding(true), HOLD_AFTER_MS),
    ];

    try {
      const [result] = await Promise.all([
        verifyCredential(employeeId, { employee, credential, today: state.today }),
        sleep(MIN_SEARCH_MS),
      ]);
      timers.forEach(clearTimeout);
      if (!alive.current) return;

      setHolding(false);
      setFoundLabel(result.kind === "verified" ? STAGES[3] : outcomeTitle(result));
      setStage(3);
      await sleep(600);
      if (!alive.current) return;

      setStage(4);
      // Commit (store, database, toast) before any further await: a cleared alert may unmount this hook now.
      const record = commitVerification({ employee, credential, outcome: result, dispatch, navigate: router.push });
      setLastRecordId(record.id);
      await sleep(600);
      if (!alive.current) return;

      setStage(5);
      await sleep(500);
      if (!alive.current) return;

      setOutcome(result);
      setPhase("complete");
    } finally {
      timers.forEach(clearTimeout);
      running.current = false;
    }
  }, [row, employeeId, state.today, dispatch, router]);

  const reset = useCallback(() => {
    if (running.current) return;
    setPhase("idle");
    setStage(0);
    setOutcome(null);
    setHolding(false);
  }, []);

  const stageLabel = holding ? HOLD_LABEL : stage === 3 ? foundLabel : STAGES[stage];

  return { phase, stage, stageLabel, holding, outcome, mode, lastRecordId, start, reset };
}
