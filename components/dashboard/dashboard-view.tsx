"use client";

import { DownloadIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { EmployeeFilters } from "@/components/employees/employee-filters";
import { EmployeeTable } from "@/components/employees/employee-table";
import { SelectionToolbar } from "@/components/employees/selection-toolbar";
import { pageSlice, TablePagination } from "@/components/employees/table-pagination";
import { useTableSelection } from "@/components/employees/use-table-selection";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useBulkVerify } from "@/components/verify/use-bulk-verify";
import { applyFilters, EMPTY_FILTERS, type Filters } from "@/lib/data/filters";
import { reportToCsv } from "@/lib/data/report";
import { downloadCsv } from "@/lib/export/csv";
import { getDashboardMetrics, joinRows, sortRowsByUrgency } from "@/lib/data/selectors";
import { useStoreState } from "@/lib/store/credential-store";

export function DashboardView({ initialFilters }: { initialFilters: Filters }) {
  const state = useStoreState();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const bulk = useBulkVerify();

  const metrics = useMemo(() => getDashboardMetrics(state), [state]);
  const rows = useMemo(() => sortRowsByUrgency(joinRows(state)), [state]);
  const visible = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const paged = pageSlice(visible, page);
  const { selection, selectedVisible, clear } = useTableSelection(visible);
  const sampleCount = paged.rows.filter((r) => r.employee.isSample).length;

  function exportCsv() {
    downloadCsv(`beacon-credential-report-${state.today}.csv`, reportToCsv(visible, state.today));
    toast.success("Report exported", { description: `${visible.length} rows saved as CSV.` });
  }

  const changeFilters = (next: Filters) => {
    setFilters(next);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Credential Monitoring"
        subtitle="Monitor employee licenses, expirations, and verification status."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={visible.length === 0} className="bg-paper">
            <DownloadIcon data-icon="inline-start" />
            Export CSV
            <span className="numeric text-ink-faint">{visible.length}</span>
          </Button>
        }
      />

      <KpiRow metrics={metrics} />

      <section className="flex flex-col gap-3" aria-label="Credential overview">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold text-ink">Credential overview</h2>
          <p className="numeric text-xs text-ink-faint">
            Showing {visible.length} of {rows.length}
          </p>
        </div>
        <EmployeeFilters filters={filters} onChange={changeFilters} />
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
