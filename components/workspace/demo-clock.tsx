"use client";

import { format, parseISO } from "date-fns";
import { CalendarClockIcon, FlaskConicalIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { addDaysISO } from "@/lib/data/clock";
import { useStoreState } from "@/lib/store/credential-store";
import { requestWorkspaceRefresh } from "@/lib/store/workspace-events";
import type { DemoSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const AMBER = "border-status-expiring-dot/40 bg-status-expiring-bg text-status-expiring-fg";

function shortDate(iso: string): string {
  return format(parseISO(iso), "MMM d");
}

/** POSTs the whole settings object (all three keys, always) so the server never merges a partial clock. */
async function saveDemoSettings(next: DemoSettings): Promise<void> {
  const res = await fetch("/api/demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled: next.enabled, today: next.today, seedDate: next.seedDate }),
  });
  const json = (await res.json().catch(() => null)) as { demo?: DemoSettings; error?: string } | null;
  if (!res.ok || !json?.demo) {
    throw new Error(json?.error ?? `The server answered ${res.status}.`);
  }
}

/** The amber chip shown beside the page title while the demo clock is on. Hidden on phones. */
export function DemoClockChip({ className }: { className?: string }) {
  const { demo } = useStoreState();
  if (!demo?.enabled) return null;
  return (
    <span
      className={cn(
        "hidden h-5 items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium whitespace-nowrap sm:inline-flex",
        AMBER,
        className,
      )}
    >
      <FlaskConicalIcon className="size-3" aria-hidden />
      Demo clock on
    </span>
  );
}

/**
 * The demo clock control in the top nav. Seeds expiration dates for the whole roster relative to the
 * seed date and evaluates them as of `today`; the source records in the database are never changed.
 */
export function DemoClock({ className }: { className?: string }) {
  const { demo } = useStoreState();
  const [saving, setSaving] = useState(false);

  if (!demo) return null;

  const save = async (patch: Partial<DemoSettings>) => {
    setSaving(true);
    try {
      await saveDemoSettings({ ...demo, ...patch });
      requestWorkspaceRefresh();
    } catch (error) {
      toast.error("The demo clock was not updated", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    } finally {
      setSaving(false);
    }
  };

  const label = demo.enabled ? `Demo data · ${shortDate(demo.today)}` : "Demo clock";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={label}
          className={cn(
            "bg-paper max-sm:w-7 max-sm:px-0",
            demo.enabled && `${AMBER} hover:bg-status-expiring-strong-bg hover:text-status-expiring-fg`,
            className,
          )}
        >
          <FlaskConicalIcon />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="leading-snug font-normal whitespace-normal text-ink-soft">
          Seeds expiration dates for the whole roster relative to the seed date; source records are untouched.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={saving} onSelect={() => void save({ enabled: !demo.enabled })}>
          <FlaskConicalIcon />
          {demo.enabled ? "Use live dates" : "Enable demo data"}
        </DropdownMenuItem>
        {demo.enabled ? (
          <>
            <DropdownMenuSeparator />
            {/* Not a menu item: keystrokes stay in the date field instead of driving the menu's typeahead. */}
            <div className="flex items-center gap-2 px-1.5 py-1" onKeyDown={(event) => event.stopPropagation()}>
              <CalendarClockIcon className="size-4 shrink-0 text-ink-faint" aria-hidden />
              <Input
                type="date"
                aria-label="Demo date"
                value={demo.today}
                disabled={saving}
                onChange={(event) => {
                  if (event.target.value) void save({ today: event.target.value });
                }}
                className="numeric h-7 bg-paper text-sm"
              />
            </div>
            <DropdownMenuItem
              disabled={saving}
              onSelect={(event) => {
                event.preventDefault();
                void save({ today: addDaysISO(demo.today, 7) });
              }}
            >
              +7 days
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={saving}
              onSelect={(event) => {
                event.preventDefault();
                void save({ today: addDaysISO(demo.today, 30) });
              }}
            >
              +30 days
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={saving || demo.today === demo.seedDate}
              onSelect={(event) => {
                event.preventDefault();
                void save({ today: demo.seedDate });
              }}
            >
              Reset clock
              <DropdownMenuShortcut className="numeric tracking-normal">{shortDate(demo.seedDate)}</DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
