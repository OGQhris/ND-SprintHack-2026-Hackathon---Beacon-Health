import { KpiSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-state";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <KpiSkeleton />
      <TableSkeleton rows={8} columns={8} />
    </>
  );
}
