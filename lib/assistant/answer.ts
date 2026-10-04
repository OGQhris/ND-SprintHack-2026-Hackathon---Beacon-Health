import { addDays, endOfMonth, format, parse, parseISO, startOfMonth } from "date-fns";
import { dateOnly } from "@/lib/data/clock";
import { formatDate, formatDaysAgo, fullName } from "@/lib/data/format";
import { joinRows, sortRowsByUrgency } from "@/lib/data/selectors";
import { GROUP_META } from "@/lib/data/sources";
import { STATUS_LABEL } from "@/lib/data/status";
import type { EmployeeGroup, EmployeeRow, StoreState } from "@/lib/types";

export type AssistantAnswer = {
  intent: "person" | "expiring" | "expired" | "attention" | "verified_recently" | "count" | "help";
  summary: string;
  rows: EmployeeRow[];
  href?: string;
};

const GROUP_WORDS: [RegExp, EmployeeGroup][] = [
  [/\b(rn|rns|nurse|nurses|nursing)\b/, "RNS"],
  [/\b(rad|radiolog\w*|x-?ray)\b/, "RAD_TECHS"],
  [/\b(us tech\w*|ultrasound|sonograph\w*)\b/, "US_TECHS"],
  [/\b(nuc\w*|nuclear)\b/, "NUC_MED_TECHS"],
];

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function groupIn(q: string): EmployeeGroup | undefined {
  return GROUP_WORDS.find(([re]) => re.test(q))?.[1];
}

function plural(n: number, word: string): string {
  return `${n} ${n === 1 ? word : `${word}s`}`;
}

function list(rows: EmployeeRow[]): string {
  const names = rows.slice(0, 3).map((r) => fullName(r.employee));
  return rows.length > 3 ? `${names.join(", ")} and ${rows.length - 3} more` : names.join(", ");
}

/** Resolves "this month", "next month", "in 14 days", "October", "this week" into a date window. */
function windowFor(q: string, today: string): { from: string; to: string; label: string } | null {
  const base = parseISO(today);
  const days = q.match(/\b(?:in|within|next)\s+(\d{1,3})\s+days?\b/);
  if (days) return { from: today, to: dateOnly(addDays(base, Number(days[1])).toISOString()), label: `in the next ${days[1]} days` };
  if (/\b(this|next)\s+week\b/.test(q)) return { from: today, to: format(addDays(base, 7), "yyyy-MM-dd"), label: "in the next 7 days" };
  if (/\bnext month\b/.test(q)) {
    const m = addDays(endOfMonth(base), 1);
    return { from: format(startOfMonth(m), "yyyy-MM-dd"), to: format(endOfMonth(m), "yyyy-MM-dd"), label: `in ${format(m, "MMMM")}` };
  }
  const month = MONTHS.find((name) => new RegExp(`\\b${name}\\b`).test(q));
  if (month) {
    let m = parse(month, "MMMM", base);
    // A month already behind us means next year's.
    if (m < startOfMonth(base)) m = parse(`${month} ${base.getFullYear() + 1}`, "MMMM yyyy", base);
    return { from: format(startOfMonth(m), "yyyy-MM-dd"), to: format(endOfMonth(m), "yyyy-MM-dd"), label: `in ${format(m, "MMMM yyyy")}` };
  }
  if (/\bthis month\b|\bmonth\b/.test(q)) {
    return { from: today, to: format(endOfMonth(base), "yyyy-MM-dd"), label: `by the end of ${format(base, "MMMM")}` };
  }
  if (/\bsoon\b|\bexpir/.test(q)) return { from: today, to: format(addDays(base, 30), "yyyy-MM-dd"), label: "in the next 30 days" };
  return null;
}

/** Rule-based answers computed from the same rows the dashboard shows. No model, no external calls. */
export function answerQuestion(question: string, state: StoreState): AssistantAnswer {
  const q = question.toLowerCase().trim();
  const all = sortRowsByUrgency(joinRows(state));
  const group = groupIn(q);
  const scoped = group ? all.filter((r) => r.employee.group === group) : all;
  const scopeLabel = group ? GROUP_META[group].label.toLowerCase() : "employees";

  // A specific person: match full name first, then last name.
  const person =
    all.find((r) => q.includes(fullName(r.employee).toLowerCase())) ??
    all.find((r) => new RegExp(`\\b${r.employee.lastName.toLowerCase()}\\b`).test(q));
  if (person && /\b(is|license|licensed|status|credential|expire|expir|check|verified)\b/.test(q)) {
    const { employee, credential, derived } = person;
    const name = fullName(employee);
    const when = credential.expirationDate ? formatDate(credential.expirationDate) : "an unknown date";
    const checked = formatDaysAgo(credential.lastChecked, state.today).toLowerCase();
    const summary =
      derived.status === "active"
        ? `${name}'s ${credential.credentialType} license is active and expires ${when} (${derived.daysUntil} days). Last verified ${checked}.`
        : derived.status === "expiring"
          ? `${name}'s ${credential.credentialType} license expires ${when}, in ${derived.daysUntil} days. Last verified ${checked}.`
          : derived.status === "expired"
            ? `${name}'s ${credential.credentialType} license shows as expired on ${when}. Last verified ${checked}; re-verify to check for a renewal.`
            : `${name}'s ${credential.credentialType} license ${STATUS_LABEL[derived.status].toLowerCase()}. Last attempt ${checked}.`;
    return { intent: "person", summary, rows: [person], href: `/employees/${employee.id}` };
  }

  if (/\bexpired\b|\blapsed\b/.test(q)) {
    const rows = scoped.filter((r) => r.derived.status === "expired");
    const summary = rows.length
      ? `${plural(rows.length, scopeLabel.replace(/s$/, ""))} ${rows.length === 1 ? "has" : "have"} an expired license: ${list(rows)}.`
      : `No ${scopeLabel} have an expired license.`;
    return { intent: "expired", summary, rows, href: `/dashboard?status=expired${group ? `&group=${group}` : ""}` };
  }

  if (/\battention\b|\breview\b|\bissues?\b|\bfailed\b|\bworr/.test(q)) {
    const rows = scoped.filter((r) => r.derived.status !== "active");
    const parts = (["expired", "expiring", "needs_review", "verification_failed"] as const)
      .map((s) => ({ s, n: rows.filter((r) => r.derived.status === s).length }))
      .filter((x) => x.n > 0)
      .map((x) => `${x.n} ${STATUS_LABEL[x.s].toLowerCase()}`);
    const summary = rows.length
      ? `${plural(rows.length, scopeLabel.replace(/s$/, ""))} need attention: ${parts.join(", ")}. Start with ${list(rows.slice(0, 3))}.`
      : `Nobody needs attention right now. All ${scopeLabel} are current.`;
    return { intent: "attention", summary, rows, href: group ? `/alerts?group=${group}` : "/alerts" };
  }

  if (/\bverified\b|\bchecked\b|\bverifications?\b/.test(q)) {
    const span = /\bweek\b/.test(q) ? 7 : 0;
    const ids = new Set(
      state.records
        .filter((r) => {
          const d = dateOnly(r.checkedAt);
          return d <= state.today && d >= format(addDays(parseISO(state.today), -span), "yyyy-MM-dd");
        })
        .map((r) => r.employeeId),
    );
    const rows = scoped.filter((r) => ids.has(r.employee.id));
    const label = span ? "this week" : "today";
    const summary = rows.length ? `${plural(rows.length, "credential")} ${rows.length === 1 ? "was" : "were"} verified ${label}: ${list(rows)}.` : `No credentials have been verified ${label} yet.`;
    return { intent: "verified_recently", summary, rows };
  }

  const window = windowFor(q, state.today);
  if (window && /\bexpir|\bdue\b|\brenew/.test(q)) {
    const rows = scoped.filter((r) => r.credential.expirationDate && r.credential.expirationDate >= window.from && r.credential.expirationDate <= window.to);
    const summary = rows.length
      ? `${plural(rows.length, "license")} expire${rows.length === 1 ? "s" : ""} ${window.label}: ${list(rows)}.`
      : `No ${scopeLabel} have a license expiring ${window.label}.`;
    return { intent: "expiring", summary, rows, href: `/dashboard?status=expiring${group ? `&group=${group}` : ""}` };
  }

  if (/\bhow many\b|\bcount\b|\btotal\b/.test(q)) {
    const summary = group
      ? `${plural(scoped.length, GROUP_META[group].label.replace(/s$/, ""))} are monitored.`
      : `${all.length} employees are monitored: ${(Object.keys(GROUP_META) as EmployeeGroup[])
          .map((g) => `${all.filter((r) => r.employee.group === g).length} ${GROUP_META[g].shortLabel}`)
          .join(", ")}.`;
    return { intent: "count", summary, rows: scoped, href: group ? `/employees?group=${group}` : "/employees" };
  }

  return {
    intent: "help",
    summary:
      "I can answer questions about expirations, expired licenses, who needs attention, recent verifications, and any employee by name. Try one of the prompts below.",
    rows: [],
  };
}
