"use client";
import { useState } from "react";
import { RefreshCw, ScanLine, LoaderCircle } from "lucide-react";
import { useDashboard } from "@/components/workspace/DashboardProvider";
import { BatchProgressBanner } from "@/components/workspace/BatchProgressBanner";
import { DemoControls } from "@/components/workspace/DemoControls";
import { EmployeeRoster } from "./EmployeeRoster";
import { EmployeeDetail } from "./EmployeeDetail";
import { Button } from "@/components/ui/button";
export function EmployeesPage() {
  const {
    data,
    error,
    refresh,
    refreshing,
    verify,
    verifyMany,
    pending,
    starting,
  } = useDashboard();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data?.employees.find((e) => e.id === selectedId) || null;
  return (
    <div className="dashboard-page">
      <div className="page-topbar">Workspace / Employees</div>
      <div className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <div className="eyebrow">TEAM CREDENTIALS</div>
            <h1>Employee credentials</h1>
            <p>
              Find employees, filter credentials, and verify selected team
              members.
            </p>
          </div>
          <div className="header-actions">
            <Button
              variant="outline"
              aria-label="Refresh employees"
              disabled={refreshing}
              onClick={() => void refresh(true)}
            >
              <RefreshCw size={15} />
            </Button>
            <Button
              disabled={data?.batch.running || starting}
              onClick={() => void verifyMany()}
            >
              <ScanLine size={16} />
              Verify all credentials
            </Button>
          </div>
        </header>
        <DemoControls />
        <BatchProgressBanner />
        {error && <div className="error-banner">{error}</div>}
        {!data ? (
          <div className="dashboard-loading">
            <LoaderCircle className="spin" />
            Loading employees…
          </div>
        ) : (
          <EmployeeRoster onSelect={setSelectedId} />
        )}
      </div>
      <EmployeeDetail
        employee={selected}
        onClose={() => setSelectedId(null)}
        onVerify={(id) => void verify(id)}
        busy={
          !!selected &&
          (pending.has(selected.id) ||
            selected.verificationState === "VERIFYING" ||
            !!data?.batch.running)
        }
      />
    </div>
  );
}
