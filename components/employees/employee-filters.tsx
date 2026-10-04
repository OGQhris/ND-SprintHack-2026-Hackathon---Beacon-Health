"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EMPTY_FILTERS, isFiltered, type Filters } from "@/lib/data/filters";
import { GROUP_META, GROUP_ORDER, SOURCE_META, SOURCE_ORDER } from "@/lib/data/sources";
import { STATUS_LABEL } from "@/lib/data/status";
import type { CredentialStatus } from "@/lib/types";

const STATUSES: CredentialStatus[] = ["active", "expiring", "expired", "needs_review", "verification_failed"];

type Props = {
  filters: Filters;
  onChange: (next: Filters) => void;
  roles?: string[];
  className?: string;
};

export function EmployeeFilters({ filters, onChange, roles, className }: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-9 w-full bg-paper sm:w-64">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search employees"
            aria-label="Search employees"
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
          />
        </InputGroup>

        <Select value={filters.group} onValueChange={(v) => set("group", v as Filters["group"])}>
          <SelectTrigger className="h-9 w-full bg-paper sm:w-[200px]" aria-label="Employee group">
            <SelectValue placeholder="Group" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All groups</SelectItem>
              {GROUP_ORDER.map((g) => (
                <SelectItem key={g} value={g}>
                  {GROUP_META[g].label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {roles ? (
          <Select value={filters.role} onValueChange={(v) => set("role", v)}>
            <SelectTrigger className="h-9 w-full bg-paper sm:w-[200px]" aria-label="Role">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}

        <Select value={filters.source} onValueChange={(v) => set("source", v as Filters["source"])}>
          <SelectTrigger className="h-9 w-full bg-paper sm:w-[170px]" aria-label="Credential source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All sources</SelectItem>
              {SOURCE_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_META[s].shortLabel}
                  {SOURCE_META[s].live ? " (live)" : ""}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={(v) => set("status", v as Filters["status"])}>
          <SelectTrigger className="h-9 w-full bg-paper sm:w-[170px]" aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {isFiltered(filters) ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)} className="text-ink-soft">
            <XIcon data-icon="inline-start" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
