"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  VERIFICATION_REPLAY_EVENT,
  VERIFICATION_WATCH_EVENT,
  type ReplayDetail,
  type WatchDetail,
} from "@/components/verification/viewer-events";
import type { VerificationRun } from "@/lib/verification-view";

const POLL_MS = 900;
const WATCH_TIMEOUT_MS = 120_000;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

const fetchRun = (id: string) => fetchJson<VerificationRun>(`/api/verification-runs/${encodeURIComponent(id)}`);
const fetchActiveRuns = () => fetchJson<{ runs: VerificationRun[] }>("/api/verification-runs").then((d) => d.runs);

function latestRunFor(runs: VerificationRun[], employeeId: string): VerificationRun | undefined {
  return runs
    .filter((r) => r.employeeId === employeeId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}

export type ViewerSession = {
  open: boolean;
  run: VerificationRun | null;
  /** Opened from history, or the manager pressed the replay control: the badge reads REPLAY. */
  replay: boolean;
  /** Watching an employee whose browser session has not appeared in the active-run list yet. */
  waiting: boolean;
  close: () => void;
  markReplay: () => void;
};

/**
 * All of the viewer's data access. A replay loads the recording once (and keeps polling only if it is
 * still unfinished); a watch polls the active-run list until this employee's run appears, then follows
 * that run until it finishes. Every async response is checked against a version counter so a newer
 * event or a closed dialog makes older responses no-ops.
 */
export function useVerificationRun(): ViewerSession {
  const [open, setOpen] = useState(false);
  const [run, setRun] = useState<VerificationRun | null>(null);
  const [replay, setReplay] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const version = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bumps the version (orphaning in-flight work) and clears any scheduled poll.
  const invalidate = useCallback(() => {
    version.current += 1;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    return version.current;
  }, []);

  const close = useCallback(() => {
    invalidate();
    setOpen(false);
    setWaiting(false);
  }, [invalidate]);

  const markReplay = useCallback(() => setReplay(true), []);

  useEffect(() => {
    const schedule = (v: number, fn: () => void, ms: number) => {
      if (v !== version.current) return;
      timer.current = setTimeout(fn, ms);
    };

    // Refreshes one run every POLL_MS until it reports finishedAt. Transient failures keep the last payload.
    const follow = (id: string, v: number, first: boolean) => {
      void (async () => {
        try {
          const next = await fetchRun(id);
          if (v !== version.current) return;
          setRun(next);
          setWaiting(false);
          if (next.finishedAt) return;
        } catch {
          if (v !== version.current) return;
          if (first) {
            toast.error("This recording could not be loaded", {
              description: "It may have been removed from the server. The verification history still has the result.",
            });
            setOpen(false);
            return;
          }
        }
        schedule(v, () => follow(id, v, false), POLL_MS);
      })();
    };

    const onReplay = (event: Event) => {
      const { runId } = (event as CustomEvent<ReplayDetail>).detail;
      const v = invalidate();
      setReplay(true);
      setWaiting(false);
      setRun(null);
      setOpen(true);
      follow(runId, v, true);
    };

    const onWatch = (event: Event) => {
      const { employeeId } = (event as CustomEvent<WatchDetail>).detail;
      const v = invalidate();
      const deadline = Date.now() + WATCH_TIMEOUT_MS;
      setReplay(false);
      setRun(null);
      setWaiting(true);
      setOpen(true);
      const poll = () => {
        void (async () => {
          try {
            const match = latestRunFor(await fetchActiveRuns(), employeeId);
            if (v !== version.current) return;
            if (match) {
              follow(match.id, v, false);
              return;
            }
          } catch {
            // The list endpoint hiccuped; try again on the next tick.
          }
          if (v !== version.current) return;
          if (Date.now() >= deadline) {
            toast.error("No browser session appeared for this check", {
              description: "It may have finished before the viewer connected. Replay it from the verification history.",
            });
            setOpen(false);
            setWaiting(false);
            return;
          }
          schedule(v, poll, POLL_MS);
        })();
      };
      poll();
    };

    window.addEventListener(VERIFICATION_REPLAY_EVENT, onReplay);
    window.addEventListener(VERIFICATION_WATCH_EVENT, onWatch);
    return () => {
      window.removeEventListener(VERIFICATION_REPLAY_EVENT, onReplay);
      window.removeEventListener(VERIFICATION_WATCH_EVENT, onWatch);
      invalidate();
    };
  }, [invalidate]);

  return { open, run, replay, waiting, close, markReplay };
}
