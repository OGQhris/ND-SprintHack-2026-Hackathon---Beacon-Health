import { CheckIcon, Loader2Icon, WrenchIcon, XIcon } from "lucide-react";
import type { ChatActivity } from "@/lib/assistant/types";

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
  return (
    <section
      aria-label="Agent tool calls"
      className="rounded-lg border border-rule bg-folder-inset/50 px-3 py-2"
    >
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-ink-faint uppercase">
        <WrenchIcon className="size-3" aria-hidden /> Tool calls
      </p>
      <ul className="flex flex-col gap-2">
        {activities.map((a) => (
          <li
            key={a.id}
            data-tool-state={!a.done ? "running" : a.ok ? "complete" : "failed"}
            className="flex min-w-0 items-center gap-2 text-xs text-ink-soft"
          >
            <ActivityIcon activity={a} />
            <div className="min-w-0 flex-1">
              <p>{a.label}</p>
              {a.name ? (
                <code className="block break-all text-[10px] text-ink-faint">
                  {a.name}
                </code>
              ) : null}
            </div>
            <span className="shrink-0 text-[10px] text-ink-faint">
              {!a.done ? "Running" : a.ok ? "Complete" : "Needs attention"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
