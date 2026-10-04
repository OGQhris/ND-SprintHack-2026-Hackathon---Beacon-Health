import { TableSkeleton } from "@/components/shared/loading-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <div className="flex items-start gap-5">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-56" />
          <div className="flex gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24" />
            ))}
          </div>
        </div>
      </div>
      <Skeleton className="h-[260px] w-full rounded-lg" />
      <TableSkeleton rows={3} columns={6} />
    </>
  );
}
