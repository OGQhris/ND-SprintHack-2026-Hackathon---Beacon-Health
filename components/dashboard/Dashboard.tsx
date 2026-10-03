"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  UsersRound,
  ShieldCheck,
  CalendarClock,
  TriangleAlert,
  ScanLine,
  RefreshCw,
  Search,
  ChevronDown,
  ArrowUpRight,
  ArrowRight,
  Check,
  Clock,
  LoaderCircle,
  Sparkles,
  SlidersHorizontal,
  ExternalLink,
  Bell,
  FileSpreadsheet,
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
import { formatDate, formatTimestamp } from "@/lib/utils";
import type { DashboardData, EmployeeRecord } from "@/lib/types";
import { MICHIGAN_URL } from "@/services/credentialProviders/types";
const categoryLabels: Record<string, string> = {
  UNKNOWN: "Unknown",
  EXPIRED: "Expired",
  EXPIRING_WITHIN_7_DAYS: "Within 7 days",
  EXPIRING_WITHIN_14_DAYS: "Within 14 days",
  EXPIRING_WITHIN_30_DAYS: "Within 30 days",
  ACTIVE: "Current",
};
const stateLabels: Record<string, string> = {
  UNVERIFIED: "Unverified",
  VERIFYING: "Checking",
  VERIFIED: "Verified",
  NEEDS_REVIEW: "Needs review",
  NOT_FOUND: "Not found",
  ERROR: "Check failed",
};
const isAttention = (e: EmployeeRecord) =>
  ["NEEDS_REVIEW", "NOT_FOUND", "ERROR"].includes(e.verificationState) ||
  (e.daysUntilExpiration !== null && e.daysUntilExpiration <= 30) ||
  (!!e.credentialStatus && e.credentialStatus.toLowerCase() !== "active");
export function Dashboard({ rosterOnly = false }: { rosterOnly?: boolean }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [manager, setManager] = useState("");
  const [tab, setTab] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [allStarting, setAllStarting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const r = await fetch("/api/dashboard", { cache: "no-store" });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error);
      setData(value);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The dashboard is unavailable.",
      );
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 4000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh]);
  const verify = async (id: string) => {
    setActionError("");
    setPending((prev) => new Set([...prev, id]));
    try {
      const r = await fetch(`/api/employees/${id}/verify`, { method: "POST" });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error);
      await refresh();
    } catch (e) {
      setActionError(
        e instanceof Error
          ? e.message
          : "Verification failed. Please try again.",
      );
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };
  const verifyAll = async () => {
    setAllStarting(true);
    setActionError("");
    try {
      const r = await fetch("/api/verify-all", { method: "POST" });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error);
      await refresh();
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Could not start verification.",
      );
    } finally {
      setAllStarting(false);
    }
  };
  const filtered = useMemo(
    () =>
      data?.employees.filter(
        (e) =>
          (!query ||
            `${e.firstName} ${e.lastName}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (!manager || e.manager === manager) &&
          (tab === "all" ||
            (tab === "unverified"
              ? e.verificationState === "UNVERIFIED"
              : isAttention(e))),
      ) || [],
    [data, query, manager, tab],
  );
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
  const verificationPercent = data.employees.length
    ? Math.round((s.verified / s.total) * 100)
    : 0;
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
        {(error || actionError) && (
          <div className="error-banner" role="alert">
            <TriangleAlert size={17} />
            {actionError || error}
          </div>
        )}
        {batch.running && (
          <div className="batch-banner">
            <LoaderCircle size={18} className="spin" />
            <div>
              <strong>Checking your team with Michigan MILARA</strong>
              <span>
                {batch.completed} / {batch.total} checks complete ·{" "}
                {batch.currentEmployee || "Preparing the next check"}
              </span>
            </div>
            <div className="batch-track">
              <span
                style={{ width: `${(batch.completed / batch.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        {!rosterOnly && (
          <>
            <section className="metrics" aria-label="Credential summary">
              {[
                {
                  label: "Total employees",
                  value: s.total,
                  icon: UsersRound,
                  note: "Registered Nurses",
                  tone: "neutral",
                },
                {
                  label: "Active credentials",
                  value: s.active,
                  icon: ShieldCheck,
                  note: "Source status: Active",
                  tone: "green",
                },
                {
                  label: "Expiring soon",
                  value: s.expiringWithin30Days,
                  icon: CalendarClock,
                  note: "In the next 30 days",
                  tone: "amber",
                },
                {
                  label: "Expired credentials",
                  value: s.expired,
                  icon: Clock,
                  note: "Past expiration date",
                  tone: "red",
                },
                {
                  label: "Needs review",
                  value: s.needsReview + s.notFound + s.errors,
                  icon: TriangleAlert,
                  note: "Review, not found & errors",
                  tone: "purple",
                },
              ].map(({ label, value, icon: Icon, note, tone }) => (
                <div className={`metric metric-${tone}`} key={label}>
                  <div>
                    <span>{label}</span>
                    <Icon size={17} />
                  </div>
                  <strong>{value.toString().padStart(2, "0")}</strong>
                  <small>
                    <span />
                    {note}
                  </small>
                </div>
              ))}
            </section>
            <section className="overview-panels">
              <div className="health-panel panel">
                <div className="panel-heading">
                  <h2>Credential coverage</h2>
                  <span className="subtle-tag">LIVE RECORDS</span>
                </div>
                <div className="health-content">
                  <div
                    className="coverage-ring"
                    style={{
                      background: `conic-gradient(var(--teal) ${verificationPercent * 3.6}deg, #edf0ed 0deg)`,
                    }}
                  >
                    <div>
                      <strong>
                        {verificationPercent}
                        <span>%</span>
                      </strong>
                      <small>verified</small>
                    </div>
                  </div>
                  <div className="coverage-details">
                    <h3>
                      {s.verified === s.total
                        ? "A complete view of your team."
                        : "Build a clearer picture."}
                    </h3>
                    <p>
                      {s.verified} of {s.total} employees have a confirmed
                      state-source record.
                    </p>
                    <div>
                      <span>
                        <i className="legend-verified" />
                        Verified <strong>{s.verified}</strong>
                      </span>
                      <span>
                        <i className="legend-unverified" />
                        Unverified <strong>{s.unverified}</strong>
                      </span>
                    </div>
                    {s.errors + s.needsReview + s.notFound > 0 && (
                      <small>
                        {s.errors + s.needsReview + s.notFound} records need
                        follow-up.
                      </small>
                    )}
                  </div>
                </div>
                <div className="panel-footer">
                  <ShieldCheck size={14} /> Every check is saved with its source
                  and timestamp.
                </div>
              </div>
              <div className="attention-panel panel">
                <div className="panel-heading">
                  <h2>
                    Attention center{" "}
                    {s.attention > 0 && (
                      <span className="count-tag">{s.attention}</span>
                    )}
                  </h2>
                  <button onClick={() => setAttentionOpen(true)}>
                    View all <ArrowUpRight size={14} />
                  </button>
                </div>
                {attention.length ? (
                  <div className="attention-list">
                    {attention.slice(0, 3).map((e) => (
                      <button key={e.id} onClick={() => setSelectedId(e.id)}>
                        <span className="attention-symbol">
                          <TriangleAlert size={15} />
                        </span>
                        <div>
                          <strong>
                            {e.firstName} {e.lastName}
                          </strong>
                          <small>
                            {["ERROR", "NEEDS_REVIEW", "NOT_FOUND"].includes(
                              e.verificationState,
                            )
                              ? stateLabels[e.verificationState]
                              : categoryLabels[e.expirationCategory]}{" "}
                            ·{" "}
                            {e.expirationDate
                              ? formatDate(e.expirationDate)
                              : "Review state source"}
                          </small>
                        </div>
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="attention-empty">
                    <span>
                      <Check size={24} />
                    </span>
                    <h3>No alerts in checked records.</h3>
                    <p>
                      {s.unverified
                        ? `${s.unverified} employees are still unverified. Check the roster to complete your view.`
                        : "Your current records have no upcoming expirations or review flags."}
                    </p>
                  </div>
                )}
                <div className="attention-windows">
                  <span>RENEWAL WINDOWS</span>
                  <span>30 days</span>
                  <span>14 days</span>
                  <span>7 days</span>
                </div>
              </div>
            </section>
            <div className="assistant-teaser">
              <div className="teaser-icon">
                <Sparkles size={22} />
              </div>
              <div>
                <span className="eyebrow">LESS SEARCHING. MORE KNOWING.</span>
                <h3>Meet your credential assistant.</h3>
                <p>“Who needs attention?” is a good place to start.</p>
              </div>
              <Button variant="outline" onClick={() => setChatOpen(true)}>
                Ask assistant <ArrowRight size={15} />
              </Button>
            </div>
          </>
        )}
        <section className="roster-panel panel">
          <div className="roster-heading">
            <div>
              <h2>
                Your employee roster <span>{s.total}</span>
              </h2>
              <p>Michigan Registered Nurses · Imported from worksheet four</p>
            </div>
            <a href={MICHIGAN_URL} target="_blank" rel="noreferrer">
              State source <ExternalLink size={13} />
            </a>
          </div>
          <div className="roster-controls">
            <div className="roster-tabs">
              {[
                ["all", "All employees", s.total],
                ["attention", "Needs attention", s.attention],
                ["unverified", "Unverified", s.unverified],
              ].map(([value, label, count]) => (
                <button
                  key={value}
                  className={tab === value ? "active" : ""}
                  onClick={() => setTab(String(value))}
                >
                  {label}
                  <span>{count}</span>
                </button>
              ))}
            </div>
            <div className="roster-filters">
              <label className="search-input">
                <Search size={15} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search employees"
                  aria-label="Search employees"
                />
              </label>
              <label className="manager-filter">
                <SlidersHorizontal size={14} />
                <select
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                  aria-label="Filter by manager"
                >
                  <option value="">All managers</option>
                  {data.managers.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <ChevronDown size={12} />
              </label>
            </div>
          </div>
          <div className="table-scroll">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Manager</th>
                  <th>Credential</th>
                  <th>License status</th>
                  <th>Expiration</th>
                  <th>Expiration category</th>
                  <th>Last verified</th>
                  <th>Verification</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const busy =
                    pending.has(e.id) || e.verificationState === "VERIFYING";
                  return (
                    <tr key={e.id}>
                      <td>
                        <button
                          className="employee-name"
                          onClick={() => setSelectedId(e.id)}
                        >
                          <span className={`employee-avatar avatar-${i % 4}`}>
                            {e.firstName[0]}
                            {e.lastName[0]}
                          </span>
                          <span>
                            <strong>
                              {e.firstName} {e.lastName}
                            </strong>
                            <small>
                              {e.licenseNumber
                                ? `#${e.licenseNumber}`
                                : "License not yet verified"}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>{e.manager}</td>
                      <td>
                        <span className="credential-label">
                          Registered Nurse
                        </span>
                      </td>
                      <td>
                        {e.credentialStatus ? (
                          <span
                            className={`badge ${e.credentialStatus.toLowerCase() === "active" ? "badge-active" : "badge-error"}`}
                          >
                            <i />
                            {e.credentialStatus}
                          </span>
                        ) : (
                          <span className="unknown-value">Unknown</span>
                        )}
                      </td>
                      <td>
                        {e.expirationDate ? (
                          <>
                            <span className="date-value">
                              {formatDate(e.expirationDate)}
                            </span>
                            <small className="days-value">
                              {e.daysUntilExpiration !== null
                                ? e.daysUntilExpiration < 0
                                  ? `${Math.abs(e.daysUntilExpiration)} days overdue`
                                  : `${e.daysUntilExpiration} days remaining`
                                : ""}
                            </small>
                          </>
                        ) : (
                          <span className="unknown-value">Not available</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`expiration-label expiration-${e.expirationCategory.toLowerCase()}`}
                        >
                          {categoryLabels[e.expirationCategory]}
                        </span>
                      </td>
                      <td>
                        <span className="verified-date">
                          {formatTimestamp(e.lastVerifiedAt)}
                        </span>
                        {e.lastVerifiedAt &&
                          e.verificationState !== "VERIFIED" && (
                            <small className="days-value">
                              Previous successful check
                            </small>
                          )}
                      </td>
                      <td>
                        <span
                          className={`verification-label verification-${e.verificationState.toLowerCase()}`}
                        >
                          {busy ? (
                            <LoaderCircle size={12} className="spin" />
                          ) : e.verificationState === "VERIFIED" ? (
                            <Check size={12} />
                          ) : (
                            <i />
                          )}
                          {stateLabels[e.verificationState]}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            onClick={() => void verify(e.id)}
                            disabled={busy || batch.running}
                            aria-label={`Verify ${e.firstName} ${e.lastName}`}
                            title="Verify credential"
                          >
                            {busy ? (
                              <LoaderCircle size={16} className="spin" />
                            ) : (
                              <ShieldCheck size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => setSelectedId(e.id)}
                            aria-label={`View details for ${e.firstName} ${e.lastName}`}
                            title="View details"
                          >
                            <ArrowUpRight size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filtered.length && (
              <div className="table-empty">
                <Search size={24} />
                <h3>No employees in this view.</h3>
                <p>
                  {query || manager
                    ? "Try another name or manager."
                    : "No records match this category."}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTab("all");
                    setQuery("");
                    setManager("");
                  }}
                >
                  Show all employees
                </Button>
              </div>
            )}
          </div>
          <div className="table-footer">
            <span>
              Showing {filtered.length} of {s.total} employees
            </span>
            <span>
              <FileSpreadsheet size={13} />
              RNS · Worksheet 4 <i /> Spelling preserved from source
            </span>
          </div>
        </section>
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
