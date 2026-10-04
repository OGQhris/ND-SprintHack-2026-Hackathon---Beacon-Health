"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  useWorkspacePolling,
  type WorkspaceSync,
} from "@/lib/store/use-workspace-polling";
import type {
  Credential,
  StoreState,
  VerificationOutcome,
  VerificationRecord,
  WorkspacePayload,
} from "@/lib/types";

export type StoreAction =
  | {
      type: "VERIFICATION_COMPLETED";
      credentialId: string;
      outcome: VerificationOutcome;
      record: VerificationRecord;
    }
  | { type: "ALERT_RESOLVED"; alertId: string }
  | { type: "ALERT_REOPENED"; alertId: string }
  | { type: "REMINDER_SENT"; alertId: string; at: string }
  /** Replaces the server-owned slices with a fresh snapshot; local alert actions survive unless the snapshot is newer. */
  | {
      type: "HYDRATE";
      workspace: WorkspacePayload;
      includeAlertActions: boolean;
    };

const ALERT_MUTATIONS = new Set<StoreAction["type"]>([
  "ALERT_RESOLVED",
  "ALERT_REOPENED",
  "REMINDER_SENT",
]);

function applyOutcome(
  credential: Credential,
  outcome: VerificationOutcome,
): Credential {
  switch (outcome.kind) {
    case "verified": {
      const c = outcome.credential;
      return {
        ...credential,
        credentialType: c.credentialType || credential.credentialType,
        credentialNumber: c.credentialNumber ?? credential.credentialNumber,
        expirationDate: c.expirationDate ?? credential.expirationDate,
        demoExpiration: undefined,
        sourceExpirationDate: undefined,
        source: c.source,
        lastChecked: c.lastChecked,
        lastVerifiedAt: c.lastChecked,
        sourceStatus: c.sourceStatus ?? credential.sourceStatus,
        issueDate: c.issueDate ?? credential.issueDate,
        county: c.county ?? credential.county,
        sourceUrl: c.sourceUrl ?? credential.sourceUrl,
        verificationState: "verified",
        lastReason: undefined,
        lastError: undefined,
        inFlight: undefined,
      };
    }
    case "needs_review":
      return {
        ...credential,
        lastChecked: outcome.lastChecked,
        verificationState: "needs_review",
        lastReason: outcome.reason,
        lastError: outcome.detail,
        inFlight: undefined,
      };
    case "verification_failed":
      return {
        ...credential,
        lastChecked: outcome.lastChecked,
        verificationState: "verification_failed",
        lastReason: outcome.reason,
        lastError: outcome.detail,
        inFlight:
          outcome.reason === "in_progress" ? credential.inFlight : undefined,
      };
  }
}

function initState(workspace: WorkspacePayload): StoreState {
  const { seed } = workspace;
  return {
    ...seed,
    resolvedAlertIds: [...seed.alertActions.resolvedAlertIds],
    reminders: { ...seed.alertActions.reminders },
    batch: workspace.batch,
    aiConfigured: workspace.aiConfigured,
    lastSyncedAt: workspace.generatedAt,
  };
}

function hydrate(
  state: StoreState,
  workspace: WorkspacePayload,
  includeAlertActions: boolean,
): StoreState {
  const { seed } = workspace;
  const next: StoreState = {
    ...state,
    source: seed.source,
    employees: seed.employees,
    credentials: seed.credentials,
    records: seed.records,
    sourceLinks: seed.sourceLinks,
    alertActions: seed.alertActions,
    today: seed.today,
    sampleCount: seed.sampleCount,
    batch: workspace.batch,
    aiConfigured: workspace.aiConfigured,
    lastSyncedAt: workspace.generatedAt,
  };
  if (includeAlertActions) {
    next.resolvedAlertIds = [...seed.alertActions.resolvedAlertIds];
    next.reminders = { ...seed.alertActions.reminders };
  }
  return next;
}

function reducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case "VERIFICATION_COMPLETED": {
      const records = state.records.some((r) => r.id === action.record.id)
        ? state.records.map((r) =>
            r.id === action.record.id ? action.record : r,
          )
        : [action.record, ...state.records];
      return {
        ...state,
        credentials: state.credentials.map((c) =>
          c.id === action.credentialId ? applyOutcome(c, action.outcome) : c,
        ),
        records,
      };
    }
    case "ALERT_RESOLVED":
      return state.resolvedAlertIds.includes(action.alertId)
        ? state
        : {
            ...state,
            resolvedAlertIds: [...state.resolvedAlertIds, action.alertId],
          };
    case "ALERT_REOPENED":
      return {
        ...state,
        resolvedAlertIds: state.resolvedAlertIds.filter(
          (id) => id !== action.alertId,
        ),
      };
    case "REMINDER_SENT":
      return {
        ...state,
        reminders: { ...state.reminders, [action.alertId]: action.at },
      };
    case "HYDRATE":
      return hydrate(state, action.workspace, action.includeAlertActions);
  }
}

type StoreValue = {
  state: StoreState;
  dispatch: (action: StoreAction) => void;
};

const StoreContext = createContext<StoreValue | null>(null);
const SyncContext = createContext<WorkspaceSync | null>(null);

/**
 * Holds the server snapshot plus the manager's local, optimistic changes. `workspace` is the
 * snapshot the (app) layout loaded on the server; afterwards the provider polls /api/workspace
 * and announces what changed (roster checks, verifications finished elsewhere) with toasts.
 */
export function CredentialStoreProvider({
  workspace,
  children,
}: {
  workspace: WorkspacePayload;
  children: ReactNode;
}) {
  const [state, rawDispatch] = useReducer(reducer, workspace, initState);
  const lastAlertMutationAt = useRef<string | null>(null);

  const dispatch = useCallback((action: StoreAction) => {
    if (ALERT_MUTATIONS.has(action.type))
      lastAlertMutationAt.current = new Date().toISOString();
    rawDispatch(action);
  }, []);

  const sync = useWorkspacePolling({ state, dispatch, lastAlertMutationAt });
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  return (
    <StoreContext.Provider value={value}>
      <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>
    </StoreContext.Provider>
  );
}

export function useCredentialStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx)
    throw new Error(
      "useCredentialStore must be used inside CredentialStoreProvider",
    );
  return ctx;
}

export function useStoreState(): StoreState {
  return useCredentialStore().state;
}

/** Manual refresh plus the health of the background sync, for banners and "last updated" labels. */
export function useWorkspaceSync(): WorkspaceSync {
  const ctx = useContext(SyncContext);
  if (!ctx)
    throw new Error(
      "useWorkspaceSync must be used inside CredentialStoreProvider",
    );
  return ctx;
}
