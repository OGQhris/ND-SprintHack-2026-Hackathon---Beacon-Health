import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { parseFilters } from "@/lib/data/filters";

export const metadata: Metadata = { title: "Dashboard" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DashboardPage({ searchParams }: Props) {
  const sp = await searchParams;
  return <DashboardView initialFilters={parseFilters(sp)} />;
}
