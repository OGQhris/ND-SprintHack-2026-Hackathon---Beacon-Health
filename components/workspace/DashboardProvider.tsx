"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import type { DashboardData } from "@/lib/types";
type Toast = { id: number; message: string; error: boolean };
type Store = {
  data: DashboardData | null;
  error: string;
  refreshing: boolean;
  refresh: (manual?: boolean) => Promise<void>;
  pending: Set<string>;
  starting: boolean;
  verify: (id: string) => Promise<void>;
  verifyMany: (ids?: string[]) => Promise<void>;
  notify: (message: string, error?: boolean) => void;
};
const Context = createContext<Store | null>(null);
export function useDashboard() {
  const store = useContext(Context);
  if (!store) throw new Error("DashboardProvider is missing.");
  return store;
}
export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null),
    [error, setError] = useState(""),
    [refreshing, setRefreshing] = useState(false),
    [pending, setPending] = useState<Set<string>>(new Set()),
    [starting, setStarting] = useState(false),
    [toasts, setToasts] = useState<Toast[]>([]);
  const snapshot = useRef<DashboardData | null>(null),
    flight = useRef<Promise<void> | null>(null),
    toastId = useRef(0);
  const notify = useCallback((message: string, error = false) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, message, error }]);
  }, []);
  useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(() => setToasts((t) => t.slice(1)), 6500);
    return () => clearTimeout(timer);
  }, [toasts]);
  const refresh = useCallback(
    (manual = false): Promise<void> => {
      if (flight.current) return flight.current;
      if (manual) setRefreshing(true);
      const work = (async () => {
        try {
          const response = await fetch("/api/dashboard", { cache: "no-store" });
          const value = (await response.json()) as DashboardData & {
            error?: string;
          };
          if (!response.ok)
            throw new Error(value.error || "Workspace could not load.");
          const previous = snapshot.current;
          if (previous) {
            if (!previous.batch.running && value.batch.running)
              notify(`Started ${value.batch.total} credential checks.`);
            if (previous.batch.running && !value.batch.running)
              notify(
                `Verification finished: ${value.batch.verified} verified, ${value.batch.failed} need attention.`,
                value.batch.failed > 0,
              );
            if (!previous.batch.running && !value.batch.running)
              for (const employee of value.employees) {
                const before = previous.employees.find(
                  (e) => e.id === employee.id,
                );
                if (
                  before &&
                  employee.lastAttemptAt &&
                  before.lastAttemptAt !== employee.lastAttemptAt
                )
                  notify(
                    `${employee.firstName} ${employee.lastName}: ${employee.verificationState === "VERIFIED" ? "credential verified" : employee.verificationState.replaceAll("_", " ").toLowerCase()}.`,
                    employee.verificationState !== "VERIFIED",
                  );
              }
          }
          snapshot.current = value;
          setData(value);
          setError("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Workspace unavailable.");
        } finally {
          setRefreshing(false);
        }
      })();
      flight.current = work;
      void work.finally(() => {
        flight.current = null;
      });
      return work;
    },
    [notify],
  );
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 4000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh]);
  const verify = async (id: string) => {
    setPending((prev) => new Set([...prev, id]));
    notify("Checking credential with Michigan MILARA…");
    try {
      const response = await fetch(`/api/employees/${id}/verify`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Verification failed.", true);
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };
  const verifyMany = async (ids?: string[]) => {
    setStarting(true);
    try {
      const response = await fetch("/api/verify-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { employeeIds: ids } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Could not start verification.",
        true,
      );
    } finally {
      setStarting(false);
    }
  };
  return (
    <Context.Provider
      value={{
        data,
        error,
        refreshing,
        refresh,
        pending,
        starting,
        verify,
        verifyMany,
        notify,
      }}
    >
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`workspace-toast ${t.error ? "is-error" : ""}`}
            role="status"
          >
            {t.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{t.message}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() =>
                setToasts((all) => all.filter((x) => x.id !== t.id))
              }
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}
