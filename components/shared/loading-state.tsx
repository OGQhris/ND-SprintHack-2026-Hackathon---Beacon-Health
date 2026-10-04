import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function TableSkeleton({ rows = 8, columns = 6, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-rule bg-paper", className)} aria-busy>
      <div className="flex h-9 items-center gap-6 border-b border-rule bg-folder-inset/60 px-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-10 items-center gap-6 border-b border-rule px-4 last:border-0">
          <Skeleton className="size-7 rounded-full" />
          {Array.from({ length: columns - 1 }).map((_, c) => (
            <Skeleton key={c} className={cn("h-3", c % 3 === 0 ? "w-32" : c % 3 === 1 ? "w-20" : "w-24")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12" aria-busy>
      {["xl:col-span-3", "xl:col-span-4", "xl:col-span-2", "xl:col-span-3"].map((span, i) => (
        <div
          key={i}
          className={cn("flex h-[132px] flex-col gap-3 rounded-lg border border-rule bg-paper px-5 py-4", span)}
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
  );
}
