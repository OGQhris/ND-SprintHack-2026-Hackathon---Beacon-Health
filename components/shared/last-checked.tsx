"use client";

import { useEffect, useState } from "react";
import { parseISO } from "date-fns";
import { formatDateTime, formatDaysAgo } from "@/lib/data/format";
import { cn } from "@/lib/utils";

const RECENT_MS = 3 * 60 * 1000;

type Props = { iso?: string; today: string; className?: string };

/**
 * Renders "n days ago" deterministically on the server, then upgrades to "Just now"
 * on the client when the timestamp is fresh. Keeps hydration clean and the demo honest.
 */
export function LastChecked({ iso, today, className }: Props) {
  const [recent, setRecent] = useState(false);

  useEffect(() => {
    if (!iso) return;
    const check = () => setRecent(Date.now() - parseISO(iso).getTime() < RECENT_MS);
    check();
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, [iso]);

  const label = recent ? "Just now" : formatDaysAgo(iso, today);
  return (
    <time
      dateTime={iso}
      title={iso ? formatDateTime(iso) : undefined}
      className={cn(recent && "font-medium text-seal-strong", className)}
    >
      {label}
    </time>
  );
}
