import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { SampleTag } from "@/components/shared/source-label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { fullName, initials } from "@/lib/data/format";
import { GROUP_META } from "@/lib/data/sources";
import type { Employee } from "@/lib/types";

export function EmployeeHeader({ employee }: { employee: Employee }) {
  const facts: { label: string; value?: string }[] = [
    { label: "Role", value: employee.role },
    { label: "Group", value: GROUP_META[employee.group].label },
    { label: "Manager", value: employee.managerName },
    { label: "State", value: employee.state },
  ];

  return (
    <header className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="w-fit -ml-2 text-ink-soft">
        <Link href="/employees">
          <ArrowLeftIcon data-icon="inline-start" />
          Employees
        </Link>
      </Button>
      <div className="flex flex-wrap items-start gap-5">
        <Avatar className="size-14">
          <AvatarFallback className="bg-seal-tint text-lg font-semibold text-seal-strong">
            {initials(employee)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl leading-7 font-semibold tracking-[-0.02em] text-ink">{fullName(employee)}</h1>
            {employee.isSample ? <SampleTag /> : null}
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col">
                <dt className="text-xs text-ink-faint">{f.label}</dt>
                <dd className="text-sm font-medium text-ink">{f.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </header>
  );
}
