"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useStoreState } from "@/lib/store/credential-store";
import { requestWorkspaceRefresh } from "@/lib/store/workspace-events";

const VERIFY_ALL_URL = "/api/verify-all";
/** The server accepts at most this many ids per roster check. */
export const BULK_LIMIT = 100;

function errorText(json: unknown, fallback: string): string {
  if (json && typeof json === "object" && typeof (json as { error?: unknown }).error === "string") {
    return (json as { error: string }).error;
  }
  return fallback;
}

/**
 * Starts and stops a server-side roster check. The server verifies the ids one at a time; the store's
 * polling picks up progress and announces the start and the result, so this hook only talks to the API.
 */
export function useBulkVerify() {
  const { batch } = useStoreState();
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const running = batch.running;

  const start = useCallback(
    async (ids: string[]): Promise<void> => {
      if (running) {
        toast.info("A roster check is already running.");
        return;
      }
      if (startingRef.current) return;
      const unique = Array.from(new Set(ids));
      if (unique.length === 0) return;
      const employeeIds = unique.slice(0, BULK_LIMIT);
      if (unique.length > BULK_LIMIT) {
        toast(`Checking the first ${BULK_LIMIT} of ${unique.length} people.`, {
          description: `A roster check covers up to ${BULK_LIMIT} people at a time. Run it again for the rest.`,
        });
      }

      startingRef.current = true;
      setStarting(true);
      try {
        const response = await fetch(VERIFY_ALL_URL, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ employeeIds }),
        });
        const json: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          toast.error(errorText(json, `The roster check could not start (${response.status}).`));
        }
      } catch {
        toast.error("The verification service could not be reached.");
      } finally {
        startingRef.current = false;
        setStarting(false);
        requestWorkspaceRefresh();
      }
    },
    [running],
  );

  const cancel = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(VERIFY_ALL_URL, { method: "DELETE", headers: { accept: "application/json" } });
      const json: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(errorText(json, `The roster check could not be stopped (${response.status}).`));
        return;
      }
      toast("Stopping after the current check.");
    } catch {
      toast.error("The verification service could not be reached.");
    } finally {
      requestWorkspaceRefresh();
    }
  }, []);

  return { start, cancel, running, starting };
}
