"use client";

import { useCallback, useMemo, useState } from "react";
import type { TableSelection } from "@/components/employees/employee-table";
import type { EmployeeRow } from "@/lib/types";

/** Checkbox selection for an employee table, restricted to the rows currently visible under the filters. */
export function useTableSelection(visible: EmployeeRow[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const visibleIds = useMemo(() => new Set(visible.map((r) => r.employee.id)), [visible]);
  const selectedVisible = useMemo(() => [...selected].filter((id) => visibleIds.has(id)), [selected, visibleIds]);

  const onToggle = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const onToggleAll = useCallback((ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const selection: TableSelection = { selected, onToggle, onToggleAll };
  return { selection, selectedVisible, clear };
}
