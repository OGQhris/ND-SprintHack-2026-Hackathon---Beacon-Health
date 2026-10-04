import { PageHeaderSkeleton } from "@/components/shared/loading-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <Skeleton className="h-9 w-full max-w-xl" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[132px] w-full rounded-lg" />
      ))}
    </>
  );
}
