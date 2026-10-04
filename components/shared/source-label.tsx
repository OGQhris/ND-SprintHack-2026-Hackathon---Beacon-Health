import type { CredentialSource } from "@/lib/types";
import { SOURCE_META } from "@/lib/data/sources";
import { cn } from "@/lib/utils";

type Props = {
  source: CredentialSource;
  variant?: "short" | "full";
  showLive?: boolean;
  className?: string;
};

export function SourceLabel({ source, variant = "short", showLive = true, className }: Props) {
  const meta = SOURCE_META[source];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span>{variant === "full" ? meta.label : meta.shortLabel}</span>
      {showLive && meta.live ? <LiveTag /> : null}
    </span>
  );
}

export function LiveTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 items-center rounded-sm bg-seal-tint px-1 text-[10px] font-semibold tracking-wide text-seal-strong",
        className,
      )}
      title="Verified against the live credential source"
    >
      Live
    </span>
  );
}

export function SampleTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 items-center rounded-sm bg-folder-inset px-1 text-[10px] font-medium text-ink-faint",
        className,
      )}
      title="Sample record, not Beacon staff"
    >
      Sample
    </span>
  );
}

/** Marks an expiration date that the demo clock seeded; the source's own date is untouched. */
export function DemoTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 items-center rounded-sm bg-folder-inset px-1 text-[10px] font-medium text-ink-faint",
        className,
      )}
      title="Simulated expiration from the demo clock; the source date is unchanged"
    >
      Demo
    </span>
  );
}
