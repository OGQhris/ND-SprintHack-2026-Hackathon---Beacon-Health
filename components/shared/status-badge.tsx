import type { CredentialStatus, DerivedStatus } from "@/lib/types";
import { statusLabel } from "@/lib/data/status";
import { cn } from "@/lib/utils";

const STYLES: Record<CredentialStatus, { chip: string; dot: string }> = {
  active: { chip: "bg-status-active-bg text-status-active-fg", dot: "bg-status-active-dot" },
  expiring: { chip: "bg-status-expiring-bg text-status-expiring-fg", dot: "bg-status-expiring-dot" },
  expired: { chip: "bg-status-expired-bg text-status-expired-fg", dot: "bg-status-expired-dot" },
  needs_review: {
    chip: "bg-status-review-bg text-status-review-fg",
    dot: "border-[1.5px] border-status-review-dot bg-transparent",
  },
  verification_failed: { chip: "bg-status-failed-bg text-status-failed-fg", dot: "bg-status-failed-dot" },
};

type Props = {
  derived: DerivedStatus;
  size?: "sm" | "md";
  label?: string;
  className?: string;
};

/** The only component that paints status colors. */
export function StatusBadge({ derived, size = "md", label, className }: Props) {
  const style = STYLES[derived.status];
  const urgent = derived.status === "expiring" && derived.tier === 7;
  return (
    <span
      data-status={derived.status}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md font-medium whitespace-nowrap",
        size === "md" ? "h-[22px] px-2 text-xs" : "h-5 px-1.5 text-[11px]",
        style.chip,
        urgent && "bg-status-expiring-strong-bg font-semibold",
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", style.dot)} />
      {label ?? statusLabel(derived)}
    </span>
  );
}

export function StatusDot({ status, className }: { status: CredentialStatus; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 rounded-full", STYLES[status].dot, className)} />;
}
