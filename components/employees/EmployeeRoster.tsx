"use client";
import { useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ExternalLink,
  FileSpreadsheet,
  LoaderCircle,
  Check,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/workspace/DashboardProvider";
import { formatDate, formatTimestamp } from "@/lib/utils";
import { MICHIGAN_URL } from "@/services/credentialProviders/types";
import { needsAttention } from "@/lib/employees-client";
import { categoryLabels, stateLabels } from "@/lib/credential-labels";
export function EmployeeRoster({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  const { data, pending, verify, verifyMany, starting } = useDashboard();
  const [query, setQuery] = useState(""),
    [manager, setManager] = useState(""),
    [status, setStatus] = useState(""),
    [tab, setTab] = useState("all"),
    [checked, setChecked] = useState<Set<string>>(new Set());
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
              : needsAttention(e))) &&
          (!status ||
            (status.startsWith("verification:")
              ? e.verificationState === status.split(":")[1]
              : e.expirationCategory === status.split(":")[1])),
      ) || [],
    [data, query, manager, status, tab],
  );
  if (!data) return null;
  const { summary: s, batch } = data;
  const selectable = filtered.filter(
    (e) => !pending.has(e.id) && e.verificationState !== "VERIFYING",
  );
  const allChecked =
    selectable.length > 0 && selectable.every((e) => checked.has(e.id));
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
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
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <optgroup label="Verification">
                {Object.entries(stateLabels).map(([value, label]) => (
                  <option key={value} value={`verification:${value}`}>
                    {label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Expiration">
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={`expiration:${value}`}>
                    {label}
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown size={12} />
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
      {checked.size > 0 && (
        <div className="selection-toolbar">
          <strong>{checked.size} employees selected</strong>
          <Button
            size="sm"
            disabled={batch.running || starting}
            onClick={() => void verifyMany([...checked])}
          >
            <ShieldCheck size={14} />
            Verify selected
          </Button>
          <button onClick={() => setChecked(new Set())}>Clear selection</button>
        </div>
      )}
      <div className="table-scroll">
        <table className="employee-table">
          <thead>
            <tr>
              <th className="selection-cell">
                <input
                  type="checkbox"
                  aria-label="Select all visible employees"
                  checked={allChecked}
                  disabled={batch.running || !selectable.length}
                  ref={(el) => {
                    if (el)
                      el.indeterminate =
                        !allChecked &&
                        selectable.some((e) => checked.has(e.id));
                  }}
                  onChange={() =>
                    setChecked((prev) => {
                      const next = new Set(prev);
                      for (const e of selectable) {
                        if (allChecked) next.delete(e.id);
                        else next.add(e.id);
                      }
                      return next;
                    })
                  }
                />
              </th>
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
                <tr
                  key={e.id}
                  className={checked.has(e.id) ? "selected-row" : ""}
                >
                  <td className="selection-cell">
                    <input
                      type="checkbox"
                      aria-label={`Select ${e.firstName} ${e.lastName}`}
                      checked={checked.has(e.id)}
                      disabled={busy || batch.running}
                      onChange={() => toggle(e.id)}
                    />
                  </td>
                  <td>
                    <button
                      className="employee-name"
                      onClick={() => onSelect(e.id)}
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
                    <span className="credential-label">Registered Nurse</span>
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
                        {e.demoExpiration && (
                          <span className="demo-date-tag">DEMO</span>
                        )}
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
                    {e.lastVerifiedAt && e.verificationState !== "VERIFIED" && (
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
                        onClick={() => onSelect(e.id)}
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
                setStatus("");
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
  );
}
