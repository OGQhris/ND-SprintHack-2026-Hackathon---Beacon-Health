import { CheckIcon, Loader2Icon, SparklesIcon, XIcon } from "lucide-react";
import type { ChatActivity } from "@/lib/assistant/types";
import { cn } from "@/lib/utils";

function ActivityIcon({ activity }: { activity: ChatActivity }) {
  if (!activity.done)
    return (
      <Loader2Icon
        className="size-3 shrink-0 text-seal motion-safe:animate-spin"
        aria-hidden
      />
    );
  if (activity.ok)
    return <CheckIcon className="size-3 shrink-0 text-seal" aria-hidden />;
  return (
    <XIcon className="size-3 shrink-0 text-status-failed-fg" aria-hidden />
  );
}

/** Actual tool calls remain visible during work and after the reply. */
export function ActivityList({ activities }: { activities: ChatActivity[] }) {
  if (!activities.length) return null;
  const working = activities.some((activity) => !activity.done);
  const needsAttention = activities.some((activity) => activity.done && !activity.ok);
  return (
    <section
      aria-label="Agent tool calls"
      className="w-full max-w-xl overflow-hidden rounded-xl border border-rule/80 bg-paper shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-rule/60 bg-folder-inset/30 px-4 py-2.5">
        <p className="flex items-center gap-2 text-xs font-medium text-ink-soft">
          <SparklesIcon className="size-3.5 text-seal" aria-hidden /> Beacon activity
        </p>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", working ? "bg-seal-tint/60 text-seal" : needsAttention ? "bg-folder-inset text-status-failed-fg" : "bg-folder-inset text-ink-faint")}>
          {working ? "Working" : needsAttention ? "Needs attention" : "Done"}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-rule/40 px-4">
        {activities.map((a) => (
          <li
            key={a.id}
            data-tool-state={!a.done ? "running" : a.ok ? "complete" : "failed"}
            className="flex min-w-0 items-center gap-3 py-3 text-xs text-ink-soft"
          >
            <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", a.done && a.ok ? "bg-seal-tint/50" : "bg-folder-inset")}>
              <ActivityIcon activity={a} />
            </span>
            <p className="min-w-0 flex-1 leading-relaxed">{a.label}</p>
            <span className={cn("shrink-0 text-[10px] text-ink-faint", a.done && a.ok && "sr-only")}>
              {!a.done ? "In progress" : a.ok ? "Complete" : "Needs attention"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
