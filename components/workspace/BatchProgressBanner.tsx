"use client";
import { LoaderCircle } from "lucide-react";
import { useDashboard } from "./DashboardProvider";
export function BatchProgressBanner() {
  const { data } = useDashboard();
  const batch = data?.batch;
  if (!batch?.running) return null;
  return (
    <div className="batch-banner">
      <LoaderCircle size={18} className="spin" />
      <div>
        <strong>Checking your team with Michigan MILARA</strong>
        <span>
          {batch.completed} / {batch.total} checks complete ·{" "}
          {batch.currentEmployee || "Preparing the next check"}
        </span>
      </div>
      <div
        className="batch-track"
        role="progressbar"
        aria-label="Credential verification progress"
        aria-valuemin={0}
        aria-valuemax={batch.total}
        aria-valuenow={batch.completed}
      >
        <span
          style={{
            width: `${batch.total ? (batch.completed / batch.total) * 100 : 0}%`,
          }}
        />
      </div>
    </div>
  );
}
