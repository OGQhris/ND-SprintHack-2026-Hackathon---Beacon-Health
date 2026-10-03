"use client";
import { useEffect, useState } from "react";
import {
  ExternalLink,
  ShieldCheck,
  Clock,
  FileCheck2,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDate, formatTimestamp } from "@/lib/utils";
import type { EmployeeRecord } from "@/lib/types";
import { MICHIGAN_URL } from "@/services/credentialProviders/types";
type Audit = {
  id: string;
  checkedAt: string;
  state: string;
  source: string;
  sourceUrl: string;
  licenseNumber: string | null;
  status: string | null;
  expirationDate: string | null;
  error: string | null;
  normalized: unknown;
};
export function EmployeeDetail({
  employee,
  onClose,
  onVerify,
  busy,
}: {
  employee: EmployeeRecord | null;
  onClose: () => void;
  onVerify: (id: string) => void;
  busy: boolean;
}) {
  const employeeId = employee?.id;
  const updatedAt = employee?.updatedAt;
  const [audits, setAudits] = useState<Audit[]>([]);
  const [auditError, setAuditError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setAuditError("");
      void fetch(`/api/employees/${employeeId}`)
        .then(async (r) => {
          if (!r.ok) throw new Error("Audit history could not load.");
          return r.json();
        })
        .then((data) => {
          if (!cancelled) setAudits(data.audits);
        })
        .catch((e) => {
          if (!cancelled) setAuditError(e.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [employeeId, updatedAt]);
  return (
    <Dialog
      open={!!employee}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {employee && (
          <>
            <div className="detail-heading">
              <span className="detail-avatar">
                {employee.firstName[0]}
                {employee.lastName[0]}
              </span>
              <span className="eyebrow">EMPLOYEE CREDENTIAL</span>
              <DialogTitle>
                {employee.firstName} {employee.lastName}
              </DialogTitle>
              <DialogDescription>
                Registered Nurse · Reports to {employee.manager}
              </DialogDescription>
            </div>
            <div className="detail-toolbar">
              <span
                className={`badge badge-${employee.verificationState.toLowerCase()}`}
              >
                {employee.verificationState.replaceAll("_", " ")}
              </span>
              <Button
                size="sm"
                onClick={() => onVerify(employee.id)}
                disabled={busy}
              >
                {busy ? (
                  <LoaderCircle size={14} className="spin" />
                ) : (
                  <ShieldCheck size={14} />
                )}
                Verify credential
              </Button>
            </div>
            {employee.verificationError && (
              <div className="error-banner">
                <AlertCircle size={17} />
                {employee.verificationError}
                {employee.lastVerifiedAt && (
                  <span>
                    Previous license data is retained from{" "}
                    {formatTimestamp(employee.lastVerifiedAt)}.
                  </span>
                )}
              </div>
            )}
            <dl className="detail-grid">
              {[
                ["Manager", employee.manager],
                ["Credential type", employee.credentialType],
                [
                  "License number",
                  employee.licenseNumber || "Not yet verified",
                ],
                [
                  "Source license status",
                  employee.credentialStatus || "Unknown",
                ],
                ["Issue date", formatDate(employee.issueDate)],
                ["Expiration date", formatDate(employee.expirationDate)],
                [
                  "Expiration category",
                  employee.expirationCategory
                    .replaceAll("_", " ")
                    .toLowerCase(),
                ],
                ["County", employee.county || "Not available"],
                [
                  "Last successfully verified",
                  formatTimestamp(employee.lastVerifiedAt),
                ],
                [
                  "Last verification attempt",
                  formatTimestamp(employee.lastAttemptAt),
                ],
                ["Source", employee.credentialSource],
                [
                  "Workbook location",
                  `Worksheet 4 · ${employee.sourceSheet} · Row ${employee.sourceRow}`,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <a
              className="source-link"
              href={employee.sourceUrl || MICHIGAN_URL}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} /> View state licensing source{" "}
              <span>Michigan MILARA</span>
            </a>
            <div className="audit-heading">
              <h3>
                <FileCheck2 size={17} />
                Verification history
              </h3>
              <span>Source-backed audit trail</span>
            </div>
            {loading ? (
              <div className="audit-empty">Loading verification history…</div>
            ) : auditError ? (
              <div className="error-banner">{auditError}</div>
            ) : audits.length ? (
              audits.map((a) => (
                <details className="audit-row" key={a.id}>
                  <summary>
                    <Clock size={14} />
                    <strong>{a.state.replaceAll("_", " ")}</strong>
                    <span>{formatTimestamp(a.checkedAt)}</span>
                  </summary>
                  <div className="audit-body">
                    <p>
                      {a.source} · License {a.licenseNumber || "unavailable"} ·{" "}
                      {a.status || "No confirmed status"} · Expires{" "}
                      {formatDate(a.expirationDate)}
                    </p>
                    {a.error && <p>{a.error}</p>}
                    <pre>{JSON.stringify(a.normalized, null, 2)}</pre>
                  </div>
                </details>
              ))
            ) : (
              <div className="audit-empty">
                No checks yet. Verify this employee to create the first audit
                record.
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
