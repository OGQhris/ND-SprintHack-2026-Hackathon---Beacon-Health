"use client";
import { DashboardOverview } from "./DashboardOverview";
import { EmployeeRoster } from "@/components/employees/EmployeeRoster";
import { useDashboard } from "@/components/workspace/DashboardProvider";
import { DemoControls } from "@/components/workspace/DemoControls";
import { BatchProgressBanner } from "@/components/workspace/BatchProgressBanner";
import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  TriangleAlert,
  ScanLine,
  RefreshCw,
  ArrowUpRight,
  LoaderCircle,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeDetail } from "@/components/employees/EmployeeDetail";
import { Chat } from "@/components/chat/Chat";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { EmployeeRecord } from "@/lib/types";
import { categoryLabels, stateLabels } from "@/lib/credential-labels";
const isAttention = (e: EmployeeRecord) =>
  ["NEEDS_REVIEW", "NOT_FOUND", "ERROR"].includes(e.verificationState) ||
  (e.daysUntilExpiration !== null && e.daysUntilExpiration <= 30) ||
  (!!e.credentialStatus && e.credentialStatus.toLowerCase() !== "active");
export function Dashboard({ rosterOnly = false }: { rosterOnly?: boolean }) {
  const {
    data,
    error,
    refreshing,
    refresh,
    pending,
    starting: allStarting,
    verify,
    verifyMany,
  } = useDashboard();
  const verifyAll = () => verifyMany();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  if (!data)
    return (
      <div className="dashboard-page">
        <div className="page-topbar">
          <span>Workspace / Overview</span>
        </div>
        <div className="dashboard-loading">
          {error ? (
            <>
              <TriangleAlert size={30} />
              <h2>Let’s get your workspace ready.</h2>
              <p>{error}</p>
              <Button onClick={() => void refresh(true)}>Try again</Button>
            </>
          ) : (
            <>
              <LoaderCircle className="spin" size={30} />
              <p>Loading your credential workspace…</p>
            </>
          )}
        </div>
      </div>
    );
  const { summary: s, batch } = data;
  const selected = data.employees.find((e) => e.id === selectedId) || null;
  const attention = data.employees.filter(isAttention);
  return (
    <div className="dashboard-page">
      <div className="page-topbar">
        <span>
          Workspace <span className="breadcrumb-slash">/</span>{" "}
          <strong>{rosterOnly ? "Employee credentials" : "Overview"}</strong>
        </span>
        <div>
          <span className="topbar-location">Michigan RN workspace</span>
          <button
            className="notification-button"
            aria-label="Open attention center"
            onClick={() => setAttentionOpen(true)}
          >
            <Bell size={18} />
            {s.attention > 0 && <i />}
          </button>
          <span className="top-avatar">BM</span>
        </div>
      </div>
      <div className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <div className="eyebrow">
              A LITTLE OVERSIGHT. A LOT OF CONFIDENCE.
            </div>
            <h1>
              {rosterOnly ? "Employee credentials" : "Your team, in good view."}
            </h1>
            <p>
              {rosterOnly
                ? "A source-backed credential record for every member of your team."
                : "Keep credentials current. Catch renewals early. Focus on your people."}
            </p>
          </div>
          <div className="header-actions">
            <Button
              variant="outline"
              onClick={() => void refresh(true)}
              aria-label="Refresh dashboard"
              disabled={refreshing}
            >
              {refreshing ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <RefreshCw size={15} />
              )}
            </Button>
            <Button
              onClick={() => void verifyAll()}
              disabled={batch.running || allStarting}
            >
              {batch.running || allStarting ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <ScanLine size={16} />
              )}{" "}
              {batch.running ? "Verifying roster" : "Verify all credentials"}
            </Button>
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            <TriangleAlert size={17} />
            {error}
          </div>
        )}
        <DemoControls />
        <BatchProgressBanner />
        {!rosterOnly && (
          <DashboardOverview
            onSelect={setSelectedId}
            onAsk={() => setChatOpen(true)}
          />
        )}
        <EmployeeRoster onSelect={setSelectedId} />
        <footer className="dashboard-footer">
          <span>
            <ShieldCheck size={13} />
            Source-backed records. Clearer decisions.
          </span>
          <span>Beacon Health System · Michigan RN credentials</span>
        </footer>
      </div>
      <EmployeeDetail
        employee={selected}
        onClose={() => setSelectedId(null)}
        onVerify={(id) => void verify(id)}
        busy={
          !!selected &&
          (pending.has(selected.id) ||
            selected.verificationState === "VERIFYING" ||
            batch.running)
        }
      />
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="assistant-drawer">
          <DialogTitle className="sr-only">
            Beacon Health System Credential Assistant
          </DialogTitle>
          <DialogDescription className="sr-only">
            Ask questions about your employee credential records.
          </DialogDescription>
          <Chat compact />
          <Link className="drawer-expand" href="/assistant">
            Open full assistant <ArrowUpRight size={13} />
          </Link>
        </DialogContent>
      </Dialog>
      <Dialog open={attentionOpen} onOpenChange={setAttentionOpen}>
        <DialogContent className="attention-dialog">
          <div className="eyebrow">PROACTIVE CREDENTIAL MONITORING</div>
          <DialogTitle>Attention center</DialogTitle>
          <DialogDescription>
            Renewal windows and records that need follow-up.
          </DialogDescription>
          <div className="attention-counts">
            {[
              ["Expired", s.expired],
              ["Within 7 days", s.expiringWithin7Days],
              ["Within 14 days", s.expiringWithin14Days],
              ["Within 30 days", s.expiringWithin30Days],
              ["Needs review", s.needsReview],
              ["Not found", s.notFound],
              ["Check errors", s.errors],
            ].map(([label, count]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <p className="attention-explainer">
            Renewal windows are cumulative. Missing dates are unknown;{" "}
            {s.unverified} employees have not yet been verified.
          </p>
          <div className="attention-list">
            {attention.map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  setAttentionOpen(false);
                  setSelectedId(e.id);
                }}
              >
                <span className="attention-symbol">
                  <TriangleAlert size={15} />
                </span>
                <div>
                  <strong>
                    {e.firstName} {e.lastName}
                  </strong>
                  <small>
                    {stateLabels[e.verificationState]} ·{" "}
                    {categoryLabels[e.expirationCategory]}
                  </small>
                </div>
                <ArrowUpRight size={15} />
              </button>
            ))}
            {!attention.length && (
              <div className="audit-empty">
                No attention flags in the current records.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
