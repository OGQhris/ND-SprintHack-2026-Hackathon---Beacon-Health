"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PAGE_SIZE = 30;

export function pageSlice<T>(rows: T[], page: number): { rows: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safe = Math.min(Math.max(1, page), pageCount);
  const start = (safe - 1) * PAGE_SIZE;
  return { rows: rows.slice(start, start + PAGE_SIZE), page: safe, pageCount };
}

type Props = { page: number; pageCount: number; total: number; onPageChange: (page: number) => void };

export function TablePagination({ page, pageCount, total, onPageChange }: Props) {
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-ink-soft">
      <p className="numeric">
        Showing {first}-{last} of {total}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeftIcon />
          </Button>
          <span className="numeric px-2 text-ink">
            Page {page} of {pageCount}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
            <ChevronRightIcon />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
