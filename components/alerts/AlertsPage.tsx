"use client";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ShieldAlert,
  Search,
  ShieldCheck,
  ArrowUpRight,
  LoaderCircle,
} from "lucide-react";
import { useDashboard } from "@/components/workspace/DashboardProvider";
import { BatchProgressBanner } from "@/components/workspace/BatchProgressBanner";
import { DemoControls } from "@/components/workspace/DemoControls";
import { EmployeeDetail } from "@/components/employees/EmployeeDetail";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { EmployeeRecord } from "@/lib/types";
const categories = [
  {
    key: "expired",
    label: "Expired",
    description: "Past their renewal date",
    icon: AlertTriangle,
    test: (e: EmployeeRecord) =>
      e.daysUntilExpiration !== null && e.daysUntilExpiration < 0,
  },
  {
    key: "7",
    label: "Within 7 days",
    description: "Immediate renewal follow-up",
    icon: CalendarClock,
    test: (e: EmployeeRecord) =>
      e.daysUntilExpiration !== null &&
      e.daysUntilExpiration >= 0 &&
      e.daysUntilExpiration <= 7,
  },
  {
    key: "14",
    label: "Within 14 days",
    description: "Plan the next two weeks",
    icon: CalendarClock,
    test: (e: EmployeeRecord) =>
      e.daysUntilExpiration !== null &&
      e.daysUntilExpiration >= 0 &&
      e.daysUntilExpiration <= 14,
  },
  {
    key: "30",
    label: "Within 30 days",
    description: "Upcoming renewal window",
    icon: CalendarClock,
    test: (e: EmployeeRecord) =>
      e.daysUntilExpiration !== null &&
      e.daysUntilExpiration >= 0 &&
      e.daysUntilExpiration <= 30,
  },
  {
    key: "issues",
    label: "Verification issues",
    description: "Failed, missing or ambiguous records",
    icon: ShieldAlert,
    test: (e: EmployeeRecord) =>
      ["ERROR", "NOT_FOUND", "NEEDS_REVIEW"].includes(e.verificationState),
  },
];
export function AlertsPage() {
  const { data, error, pending, starting, verify, verifyMany } = useDashboard();
  const [category, setCategory] = useState("expired"),
    [query, setQuery] = useState(""),
    [manager, setManager] = useState(""),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const active = categories.find((c) => c.key === category)!;
  const filtered = useMemo(
    () =>
      data?.employees
        .filter(
          (e) =>
            active.test(e) &&
            (!query ||
              `${e.firstName} ${e.lastName}`
                .toLowerCase()
                .includes(query.toLowerCase())) &&
            (!manager || e.manager === manager),
        )
        .sort(
          (a, b) =>
            (a.daysUntilExpiration ?? Infinity) -
            (b.daysUntilExpiration ?? Infinity),
        ) || [],
    [data, active, query, manager],
  );
  const selected = data?.employees.find((e) => e.id === selectedId) || null;
  return (
    <div className="dashboard-page">
      <div className="page-topbar">Workspace / Alerts</div>
      <div className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <div className="eyebrow">CREDENTIAL FOLLOW-UP</div>
            <h1>Know what needs attention.</h1>
            <p>
              Prioritize renewals and resolve verification issues before they
              become surprises.
            </p>
          </div>
        </header>
        <DemoControls />
        <BatchProgressBanner />
        {error && <div className="error-banner">{error}</div>}
        {!data ? (
          <div className="dashboard-loading">
            <LoaderCircle className="spin" />
            Loading alerts…
          </div>
        ) : (
          <>
            <section className="alert-categories" aria-label="Alert categories">
              {categories.map((c) => (
                <button
                  key={c.key}
                  className={`alert-category ${c.key} ${category === c.key ? "selected" : ""}`}
                  onClick={() => setCategory(c.key)}
                  aria-pressed={category === c.key}
                >
                  <span>
                    <c.icon size={19} />
                    {c.label}
                  </span>
                  <strong>{data.employees.filter(c.test).length}</strong>
                  <small>{c.description}</small>
                </button>
              ))}
            </section>
            <p className="alert-explainer">
              Renewal windows are cumulative: 7-day alerts are also included in
              the 14- and 30-day views.{" "}
              {data.employees.filter((e) => e.expirationDate === null).length}{" "}
              employees have unknown expiration dates.
            </p>
            <section className="roster-panel panel">
              <div className="roster-heading">
                <div>
                  <h2>
                    {active.label}
                    <span>{filtered.length}</span>
                  </h2>
                  <p>
                    As of {formatDate(data.today)}
                    {data.demo.enabled ? " · demo clock" : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={!filtered.length || data.batch.running || starting}
                  onClick={() => void verifyMany(filtered.map((e) => e.id))}
                >
                  <ShieldCheck size={14} />
                  Verify this group
                </Button>
              </div>
              <div className="alert-filters">
                <label className="search-input">
                  <Search size={15} />
                  <input
                    aria-label="Search alerts"
                    placeholder="Search employees"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <label className="manager-filter">
                  <select
                    aria-label="Filter alerts by manager"
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                  >
                    <option value="">All managers</option>
                    {data.managers.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="alert-list">
                {filtered.map((e) => (
                  <article className="alert-item" key={e.id}>
                    <div className={`alert-item-icon ${category}`}>
                      <active.icon size={20} />
                    </div>
                    <div className="alert-item-person">
                      <button onClick={() => setSelectedId(e.id)}>
                        {e.firstName} {e.lastName}
                        <ArrowUpRight size={13} />
                      </button>
                      <span>{e.manager} · Registered Nurse</span>
                      <p>
                        {category === "issues"
                          ? e.verificationError ||
                            "Review this licensing result."
                          : e.daysUntilExpiration! < 0
                            ? `${Math.abs(e.daysUntilExpiration!)} days overdue`
                            : `Expires in ${e.daysUntilExpiration} days`}
                      </p>
                    </div>
                    <div className="alert-item-date">
                      {e.demoExpiration && (
                        <span className="demo-date-tag">DEMO</span>
                      )}
                      <strong>{formatDate(e.expirationDate)}</strong>
                      <small>
                        {e.verificationState.replaceAll("_", " ").toLowerCase()}
                      </small>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        pending.has(e.id) ||
                        e.verificationState === "VERIFYING" ||
                        data.batch.running
                      }
                      onClick={() => void verify(e.id)}
                    >
                      {pending.has(e.id) ? (
                        <LoaderCircle size={14} className="spin" />
                      ) : (
                        <ShieldCheck size={14} />
                      )}
                      Verify
                    </Button>
                  </article>
                ))}
              </div>
              {!filtered.length && (
                <div className="table-empty">
                  <ShieldCheck size={28} />
                  <h3>No alerts in this view.</h3>
                  <p>
                    {query || manager
                      ? "Try another name or manager."
                      : "Choose another renewal window or enable demo data to explore alerts."}
                  </p>
                </div>
              )}
            </section>
          </>
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
