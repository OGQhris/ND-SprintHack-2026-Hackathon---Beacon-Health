import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: number | string;
  caption?: ReactNode;
  tone?: "default" | "warning" | "danger" | "review";
  children?: ReactNode;
  className?: string;
};

const VALUE_TONE = {
  default: "text-ink",
  warning: "text-status-expiring-fg",
  danger: "text-status-expired-fg",
  review: "text-status-review-fg",
} as const;

export function StatCard({ label, value, caption, tone = "default", children, className }: Props) {
  return (
    <section
      className={cn("flex min-w-0 flex-col gap-3 rounded-lg border border-rule bg-paper px-5 py-4", className)}
      aria-label={label}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-ink-faint">{label}</h3>
        <p className={cn("numeric text-[28px] leading-none font-semibold tracking-[-0.02em]", VALUE_TONE[tone])}>
          {value}
        </p>
        {caption ? <p className="text-xs text-ink-soft">{caption}</p> : null}
      </div>
      {children}
    </section>
  );
}
