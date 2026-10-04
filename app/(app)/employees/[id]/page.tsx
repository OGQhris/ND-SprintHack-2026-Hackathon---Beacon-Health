import type { Metadata } from "next";
import { EmployeeDetailView } from "@/components/employees/employee-detail-view";

export const metadata: Metadata = { title: "Employee" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EmployeePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  return <EmployeeDetailView id={id} autoVerify={sp.verify === "1"} />;
}
