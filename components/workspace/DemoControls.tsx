"use client";
import { useState } from "react";
import { CalendarClock, FlaskConical } from "lucide-react";
import { useDashboard } from "./DashboardProvider";
export function DemoControls() {
  const { data, refresh, notify } = useDashboard();
  const [saving, setSaving] = useState(false);
  if (!data?.demo) return null;
  const demo = data.demo;
  async function save(
    enabled: boolean,
    today = demo.today,
    seedDate = demo.seedDate,
  ) {
    setSaving(true);
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, today, seedDate }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Demo settings failed.", true);
    } finally {
      setSaving(false);
    }
  }
  const advance = (days: number) =>
    void save(
      true,
      new Date(Date.parse(`${demo.today}T00:00:00Z`) + days * 86400000)
        .toISOString()
        .slice(0, 10),
    );
  return (
    <div className={`demo-controls ${demo.enabled ? "enabled" : ""}`}>
      <div>
        <FlaskConical size={16} />
        <strong>{demo.enabled ? "Demo data enabled" : "Demo workspace"}</strong>
        <span>
          {demo.enabled
            ? "Simulated expirations · real license records are preserved"
            : "Seed expiration alerts for your presentation"}
        </span>
      </div>
      <div className="demo-actions">
        {demo.enabled && (
          <>
            <label>
              <CalendarClock size={14} />
              <input
                aria-label="Demo date"
                type="date"
                value={demo.today}
                disabled={saving}
                onChange={(e) =>
                  e.target.value && void save(true, e.target.value)
                }
              />
            </label>
            <button disabled={saving} onClick={() => advance(7)}>
              +7 days
            </button>
            <button disabled={saving} onClick={() => advance(30)}>
              +30 days
            </button>
            <button
              disabled={saving}
              onClick={() => void save(true, demo.seedDate)}
            >
              Reset clock
            </button>
          </>
        )}
        <button
          className="demo-toggle"
          disabled={saving}
          onClick={() => void save(!demo.enabled)}
        >
          {demo.enabled ? "Use live dates" : "Enable demo data"}
        </button>
      </div>
    </div>
  );
}
