"use client";

import { useMemo, useState } from "react";
import { EmployeeFilters } from "@/components/employees/employee-filters";
import { EmployeeTable } from "@/components/employees/employee-table";
import { SelectionToolbar } from "@/components/employees/selection-toolbar";
import { pageSlice, TablePagination } from "@/components/employees/table-pagination";
import { useTableSelection } from "@/components/employees/use-table-selection";
import { PageHeader } from "@/components/layout/page-header";
import { useBulkVerify } from "@/components/verify/use-bulk-verify";
import { applyFilters, EMPTY_FILTERS, type Filters } from "@/lib/data/filters";
import { fullName } from "@/lib/data/format";
import { getRoles, joinRows } from "@/lib/data/selectors";
import { useStoreState } from "@/lib/store/credential-store";

export function EmployeesView({ initialFilters }: { initialFilters: Filters }) {
  const state = useStoreState();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const bulk = useBulkVerify();

  const rows = useMemo(
    () => joinRows(state).sort((a, b) => fullName(a.employee).localeCompare(fullName(b.employee))),
    [state],
  );
  const roles = useMemo(() => getRoles(state), [state]);
  const visible = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const paged = pageSlice(visible, page);
  const { selection, selectedVisible, clear } = useTableSelection(visible);
  const sampleCount = paged.rows.filter((r) => r.employee.isSample).length;

  const changeFilters = (next: Filters) => {
    setFilters(next);
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Employees" subtitle="View employees and their credential status." />
      <section className="flex flex-col gap-3" aria-label="Employee directory">
        <EmployeeFilters filters={filters} onChange={changeFilters} roles={roles} />
        <SelectionToolbar
          selectedCount={selectedVisible.length}
          pageCount={paged.rows.length}
          running={bulk.running}
          starting={bulk.starting}
          onVerifySelected={() => void bulk.start(selectedVisible)}
          onVerifyPage={() => void bulk.start(paged.rows.map((r) => r.employee.id))}
          onClearSelection={clear}
          onCancel={bulk.cancel}
        />
        <EmployeeTable
          rows={paged.rows}
          today={state.today}
          sampleCount={sampleCount}
          selection={selection}
          onClearFilters={() => changeFilters(EMPTY_FILTERS)}
        />
        <TablePagination page={paged.page} pageCount={paged.pageCount} total={visible.length} onPageChange={setPage} />
      </section>
    </>
  );
}
