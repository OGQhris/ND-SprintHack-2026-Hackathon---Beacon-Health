"use client";
import {
  UsersRound,
  Check,
  ShieldCheck,
  CalendarClock,
  Clock,
  TriangleAlert,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { useDashboard } from "@/components/workspace/DashboardProvider";
import { needsAttention } from "@/lib/employees-client";
import { categoryLabels, stateLabels } from "@/lib/credential-labels";
export function DashboardOverview({
  onSelect,
  onAsk,
}: {
  onSelect: (id: string) => void;
  onAsk: () => void;
}) {
  const { data } = useDashboard();
  if (!data) return null;
  const s = data.summary;
  const verificationPercent = s.total
    ? Math.round((s.verified / s.total) * 100)
    : 0;
  const attention = data.employees.filter(needsAttention);
  return (
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
            <ShieldCheck size={14} /> Every check is saved with its source and
            timestamp.
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
            <Link href="/alerts">
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          {attention.length ? (
            <div className="attention-list">
              {attention.slice(0, 3).map((e) => (
                <button key={e.id} onClick={() => onSelect(e.id)}>
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
        <Button variant="outline" onClick={() => onAsk()}>
          Ask assistant <ArrowRight size={15} />
        </Button>
      </div>
    </>
  );
}
