"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { toast } from "sonner";
import { fullName } from "@/lib/data/format";
import { REASON_LABEL } from "@/lib/data/status";
import { WORKSPACE_REFRESH_EVENT } from "@/lib/store/workspace-events";
import { isAssistantVerification } from "@/lib/store/assistant-verifications";
import type { StoreState, WorkspacePayload } from "@/lib/types";

export const WORKSPACE_URL = "/api/workspace";
const POLL_MS = 4000;

export type WorkspaceSync = {
  /** Fetches the server snapshot now (deduplicated with any poll already in flight). */
  refresh: () => Promise<void>;
  /** Why the last poll failed, or null once a poll succeeds again. Existing data is never wiped. */
  syncError: string | null;
  /** True while a refresh requested through `refresh()` is running. */
  refreshing: boolean;
};

export type HydrateDispatch = (action: {
  type: "HYDRATE";
  workspace: WorkspacePayload;
  includeAlertActions: boolean;
}) => void;

type Options = {
  state: StoreState;
  dispatch: HydrateDispatch;
  /** ISO time of the last local alert action; a snapshot older than it keeps the local alert state. */
  lastAlertMutationAt: MutableRefObject<string | null>;
};

function isWorkspacePayload(value: unknown): value is WorkspacePayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<WorkspacePayload>;
  return typeof v.generatedAt === "string" && !!v.seed && Array.isArray(v.seed.credentials) && !!v.batch;
}

/**
 * Server-driven toasts, computed by comparing the last applied snapshot with the new one.
 * Roster checks announce their start and end; outside a roster check each finished verification
 * is announced once, unless this screen already applied it through VERIFICATION_COMPLETED.
 */
function announceChanges(previous: WorkspacePayload, next: WorkspacePayload, current: StoreState): void {
  const wasRunning = previous.batch.running;
  const isRunning = next.batch.running;

  if (!wasRunning && isRunning) {
    toast(`Started ${next.batch.total} credential ${next.batch.total === 1 ? "check" : "checks"}.`);
    return;
  }
  if (wasRunning && !isRunning) {
    const message = `Verification finished: ${next.batch.verified} verified, ${next.batch.failed} need attention.`;
    if (next.batch.failed > 0) toast.warning(message);
    else toast.success(message);
    return;
  }
  if (isRunning) return;

  const before = new Map(previous.seed.credentials.map((c) => [c.id, c.lastChecked]));
  const held = new Map(current.credentials.map((c) => [c.id, c.lastChecked]));
  const names = new Map(next.seed.employees.map((e) => [e.id, fullName(e)]));

  for (const credential of next.seed.credentials) {
    if (!credential.lastChecked || credential.inFlight) continue;
    if (!before.has(credential.id) || before.get(credential.id) === credential.lastChecked) continue;
    if (held.get(credential.id) === credential.lastChecked) continue;
    if (isAssistantVerification(credential.employeeId, credential.lastChecked)) continue;
    const name = names.get(credential.employeeId) ?? "Employee";
    if (credential.verificationState === "verified") {
      toast.success(`${name}: credential verified`);
    } else {
      const reason = credential.lastReason ? REASON_LABEL[credential.lastReason] : "needs attention";
      toast.warning(`${name}: ${reason}`);
    }
  }
}

/**
 * Keeps the store in step with the server: a poll every 4 seconds while the tab is visible,
 * an immediate one when the tab comes back or any client code calls requestWorkspaceRefresh().
 * Requests never overlap; a refresh asked for mid-flight runs once more after the current one.
 */
export function useWorkspacePolling({ state, dispatch, lastAlertMutationAt }: Options): WorkspaceSync {
  const [syncError, setSyncError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const stateRef = useRef(state);
  const previousRef = useRef<WorkspacePayload | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const queued = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /** One fetch-compare-apply pass. Never throws; failures land in syncError and leave the data alone. */
  const syncOnce = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(WORKSPACE_URL, { cache: "no-store", headers: { accept: "application/json" } });
      const json: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = json && typeof json === "object" && "error" in json ? String((json as { error: unknown }).error) : "";
        throw new Error(message || `The workspace could not be loaded (${response.status}).`);
      }
      if (!isWorkspacePayload(json)) throw new Error("The workspace answered with an unexpected shape.");
      if (!alive.current) return;

      const current = stateRef.current;
      if (current.lastSyncedAt && json.generatedAt <= current.lastSyncedAt) {
        setSyncError(null);
        return;
      }
      const previous = previousRef.current;
      if (previous) announceChanges(previous, json, current);
      previousRef.current = json;
      const mutation = lastAlertMutationAt.current;
      dispatch({ type: "HYDRATE", workspace: json, includeAlertActions: !mutation || json.generatedAt > mutation });
      setSyncError(null);
    } catch (error) {
      if (!alive.current) return;
      setSyncError(error instanceof Error ? error.message : "The workspace could not refresh.");
    }
  }, [dispatch, lastAlertMutationAt]);

  /** Serializes passes: a refresh asked for mid-flight marks `queued` and the loop runs once more. */
  const run = useCallback(
    (manual: boolean): Promise<void> => {
      if (inFlight.current) {
        queued.current = true;
        return inFlight.current;
      }
      if (manual) setRefreshing(true);
      const work = (async () => {
        try {
          do {
            queued.current = false;
            await syncOnce();
          } while (queued.current && alive.current);
        } finally {
          inFlight.current = null;
          if (alive.current && manual) setRefreshing(false);
        }
      })();
      inFlight.current = work;
      return work;
    },
    [syncOnce],
  );

  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    const tick = () => {
      if (cancelled || document.hidden) return;
      void run(false);
    };
    const onVisibility = () => {
      if (!document.hidden) tick();
    };
    const interval = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(WORKSPACE_REFRESH_EVENT, tick);
    return () => {
      cancelled = true;
      alive.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(WORKSPACE_REFRESH_EVENT, tick);
    };
  }, [run]);

  const refresh = useCallback(() => run(true), [run]);

  return useMemo(() => ({ refresh, syncError, refreshing }), [refresh, syncError, refreshing]);
}
