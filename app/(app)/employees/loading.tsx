import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-state";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <TableSkeleton rows={10} columns={8} />
    </>
  );
}
