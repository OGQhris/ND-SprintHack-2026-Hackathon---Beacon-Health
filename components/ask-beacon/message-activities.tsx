import { CheckIcon, ChevronRightIcon, MinusIcon, XIcon } from "lucide-react";
import type { ChatActivity } from "@/lib/assistant/types";

function ActivityIcon({ activity }: { activity: ChatActivity }) {
  if (!activity.done) return <MinusIcon className="size-3 shrink-0 text-ink-ghost" aria-hidden />;
  if (activity.ok) return <CheckIcon className="size-3 shrink-0 text-seal" aria-hidden />;
  return <XIcon className="size-3 shrink-0 text-status-failed-fg" aria-hidden />;
}

/** The tool steps behind a finished reply; folded away when there were more than two. */
export function ActivityList({ activities }: { activities: ChatActivity[] }) {
  if (!activities.length) return null;
  const items = (
    <ul className="flex flex-col gap-0.5">
      {activities.map((a) => (
        <li key={a.id} className="flex items-center gap-1.5 text-xs text-ink-faint">
          <ActivityIcon activity={a} />
          <span>{a.label}</span>
        </li>
      ))}
    </ul>
  );
  if (activities.length <= 2) return items;
  return (
    <details className="group text-xs text-ink-faint">
      <summary className="flex cursor-pointer list-none items-center gap-1 select-none [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="size-3 transition-transform group-open:rotate-90" aria-hidden />
        Checked {activities.length} sources
      </summary>
      <div className="mt-1 pl-4">{items}</div>
    </details>
  );
}
