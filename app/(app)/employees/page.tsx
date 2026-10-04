import type { Metadata } from "next";
import { EmployeesView } from "@/components/employees/employees-view";
import { parseFilters } from "@/lib/data/filters";

export const metadata: Metadata = { title: "Employees" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EmployeesPage({ searchParams }: Props) {
  const sp = await searchParams;
  return <EmployeesView initialFilters={parseFilters(sp)} />;
}
