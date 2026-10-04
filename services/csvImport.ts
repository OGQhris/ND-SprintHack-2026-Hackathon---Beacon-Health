import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { db } from "@/lib/db";
import type {
  EmployeeImportResult,
  EmployeeImportSkipped,
  EmployeeImportVerification,
  ImportedEmployee,
} from "@/lib/types";
import type { CredentialProvider } from "./credentialProviders/types";
import { getBatchProgress, startVerifyAll } from "./credentialService";

/**
 * CSV import of new employees (POST /api/employees/import). It stands in for the HR feed: in production new
 * hires would arrive from the HR system automatically; for the demo a manager drops the export.
 *
 * Rules: names are trimmed but otherwise kept exactly as written; people already on the roster (same first and
 * last name, ignoring case and accents) are left untouched; every import gets its own sourceSheet, so ids never
 * collide with the workbook roster or with an earlier import of the same file.
 */

export const CSV_MAX_BYTES = 1_000_000;
export const CSV_MAX_ROWS = 500;
/** Matches the per-request ceiling of POST /api/verify-all. */
export const VERIFY_LIMIT = 100;
const NAME_MAX = 80;

export class CsvImportError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 = 400,
  ) {
    super(message);
    this.name = "CsvImportError";
  }
}

const DELIMITERS = [",", ";", "\t"] as const;

/** The header line decides the delimiter: comma unless semicolons or tabs are clearly in use (Excel locales). */
function sniffDelimiter(text: string): string {
  const header = text.split(/\r\n|\r|\n/).find((line) => line.trim()) ?? "";
  let best: string = ",";
  let bestCount = 0;
  for (const delimiter of DELIMITERS) {
    const count = header.split(delimiter).length - 1;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

/** RFC 4180: quoted fields, doubled quotes, delimiters and newlines inside quotes, CRLF or LF, UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const delimiter = sniffDelimiter(src);
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    // A quote opens a quoted field only at the start of the field; O"Brien keeps its quote as text.
    if (ch === '"' && field.length === 0) {
      quoted = true;
      continue;
    }
    if (ch === delimiter) {
      record.push(field);
      field = "";
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      continue;
    }
    field += ch;
  }
  if (quoted) {
    throw new CsvImportError(
      `A quote on row ${records.length + 1} is never closed. Fix that cell and try again.`,
    );
  }
  if (field.length || record.length) {
    record.push(field);
    records.push(record);
  }
  return records;
}

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\s_.\-]+/g, " ")
    .trim();
const FIRST_HEADERS = new Set([
  "first name",
  "firstname",
  "first",
  "given name",
  "fname",
]);
const LAST_HEADERS = new Set([
  "last name",
  "lastname",
  "last",
  "surname",
  "family name",
  "lname",
]);
const MANAGER_HEADERS = new Set([
  "manager",
  "manager name",
  "supervisor",
  "reports to",
]);

function findColumn(headers: string[], names: Set<string>): number {
  return headers.findIndex((header) => names.has(normalizeHeader(header)));
}

/** Line breaks, tabs and other control characters never belong in a name. */
const CONTROL_CHARS = /\p{Cc}/u;

/** Drops invisible format characters (zero-width spaces, soft hyphens, BOMs) that spreadsheets leave behind. */
function cleanCell(cell: string): string {
  return cell.replace(/\p{Cf}/gu, "").trim();
}

/** Case- and accent-insensitive identity of a person, used to spot duplicates in the file and on the roster. */
export function nameKey(firstName: string, lastName: string): string {
  const fold = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  return `${fold(firstName)}\u001f${fold(lastName)}`;
}

export type ParsedEmployeeRow = {
  row: number;
  firstName: string;
  lastName: string;
  manager: string;
};

export type ParsedEmployeeCsv = {
  rows: ParsedEmployeeRow[];
  skipped: EmployeeImportSkipped[];
  /** Non-empty data records, usable or not. */
  total: number;
};

export function parseEmployeeCsv(text: string): ParsedEmployeeCsv {
  const records = parseCsv(text);
  const headerIndex = records.findIndex((record) =>
    record.some((cell) => cell.trim()),
  );
  if (headerIndex === -1) throw new CsvImportError("That file is empty.");
  const headers = records[headerIndex].map((header) => header.trim());
  const first = findColumn(headers, FIRST_HEADERS);
  const last = findColumn(headers, LAST_HEADERS);
  const manager = findColumn(headers, MANAGER_HEADERS);
  if (first === -1 || last === -1) {
    const found = headers
      .filter((header) => header && header.length <= 40)
      .join(", ")
      .slice(0, 120);
    throw new CsvImportError(
      `The first row needs "First name" and "Last name" columns${found ? ` (found: ${found})` : ""}.`,
    );
  }

  const rows: ParsedEmployeeRow[] = [];
  const skipped: EmployeeImportSkipped[] = [];
  const seen = new Map<string, number>();
  let total = 0;
  for (let i = headerIndex + 1; i < records.length; i++) {
    const cells = records[i].map(cleanCell);
    if (cells.every((cell) => !cell)) continue;
    total++;
    if (total > CSV_MAX_ROWS)
      throw new CsvImportError(
        `Import up to ${CSV_MAX_ROWS} people at a time.`,
      );
    const row = i + 1;
    const firstName = cells[first] ?? "";
    const lastName = cells[last] ?? "";
    const managerName = manager === -1 ? "" : (cells[manager] ?? "");
    const name = `${firstName} ${lastName}`.trim();
    if (!firstName) {
      skipped.push({
        row,
        reason: "Missing first name",
        name: name || undefined,
      });
      continue;
    }
    if (!lastName) {
      skipped.push({ row, reason: "Missing last name", name });
      continue;
    }
    if (
      CONTROL_CHARS.test(firstName) ||
      CONTROL_CHARS.test(lastName) ||
      CONTROL_CHARS.test(managerName)
    ) {
      skipped.push({
        row,
        reason: "Name contains a line break or control character",
        name,
      });
      continue;
    }
    if (
      firstName.length > NAME_MAX ||
      lastName.length > NAME_MAX ||
      managerName.length > 120
    ) {
      skipped.push({ row, reason: "Name is too long", name });
      continue;
    }
    const key = nameKey(firstName, lastName);
    const duplicateOf = seen.get(key);
    if (duplicateOf) {
      skipped.push({ row, reason: `Duplicate of row ${duplicateOf}`, name });
      continue;
    }
    seen.set(key, row);
    rows.push({ row, firstName, lastName, manager: managerName });
  }
  return { rows, skipped, total };
}

function safeFileName(fileName: string): string {
  const base = path
    .basename(fileName.replace(/\\/g, "/"))
    .replace(/[^\w.\- ]+/g, "")
    .trim();
  return (base || "upload.csv").slice(0, 80);
}

/** Same scheme as the workbook importer, so every employee id is derived from its provenance. */
export function employeeIdFor(sourceSheet: string, sourceRow: number): string {
  return (
    "rn_" +
    createHash("sha256")
      .update(`${sourceSheet}:${sourceRow}`)
      .digest("hex")
      .slice(0, 16)
  );
}

async function kickOffVerification(
  ids: string[],
  requested: boolean,
  importedAt: string,
  provider?: CredentialProvider,
): Promise<EmployeeImportVerification> {
  const people = `${ids.length} ${ids.length === 1 ? "person" : "people"}`;
  if (!requested)
    return {
      requested: false,
      started: false,
      count: 0,
      message: "Verification not requested.",
    };
  if (!ids.length)
    return {
      requested: true,
      started: false,
      count: 0,
      message: "Nothing new to verify.",
    };
  if (getBatchProgress().running) {
    return {
      requested: true,
      started: false,
      count: ids.length,
      message:
        "A roster check is already running. Verify the new people from the Employees page when it finishes.",
    };
  }
  // Same ceiling as POST /api/verify-all: one import never queues more than a roster check would.
  const toCheck = ids.slice(0, VERIFY_LIMIT);
  const capped =
    ids.length > VERIFY_LIMIT
      ? ` The first ${VERIFY_LIMIT} are being checked; verify the rest from the Employees page.`
      : "";
  try {
    const progress = await startVerifyAll(provider, toCheck);
    const started =
      progress.running &&
      !!progress.startedAt &&
      progress.startedAt >= importedAt;
    return {
      requested: true,
      started,
      count: toCheck.length,
      message: started
        ? `Checking ${toCheck.length === ids.length ? people : toCheck.length + " people"} with Michigan MILARA.${capped}`
        : "The roster check could not start. Verify the new people from the Employees page.",
    };
  } catch (error) {
    console.error("[CSV import] Verification could not start", error);
    return {
      requested: true,
      started: false,
      count: toCheck.length,
      message:
        "The roster check could not start. Verify the new people from the Employees page.",
    };
  }
}

export async function importEmployeeCsv(input: {
  fileName: string;
  text: string;
  verify: boolean;
  /** Tests inject a fixture; the app uses the real Michigan provider. */
  provider?: CredentialProvider;
}): Promise<EmployeeImportResult> {
  const { rows, skipped, total } = parseEmployeeCsv(input.text);
  if (total === 0)
    throw new CsvImportError("That file has a header but no people in it.");

  const importedAt = new Date().toISOString();
  // The random suffix keeps two uploads in the same millisecond on separate sheets (ids never collide).
  const sourceSheet = `csv:${safeFileName(input.fileName)}:${importedAt}:${randomBytes(3).toString("hex")}`;
  const imported: ImportedEmployee[] = [];
  const alreadyOnRoster: EmployeeImportResult["alreadyOnRoster"] = [];

  // Read the roster and insert inside one transaction so two overlapping uploads cannot both add the same person.
  await db.$transaction(async (tx) => {
    const roster = await tx.employee.findMany({
      select: { id: true, firstName: true, lastName: true },
    });
    const rosterByName = new Map<string, string>();
    for (const employee of roster) {
      const key = nameKey(employee.firstName, employee.lastName);
      if (!rosterByName.has(key)) rosterByName.set(key, employee.id);
    }
    for (const row of rows) {
      const existingId = rosterByName.get(nameKey(row.firstName, row.lastName));
      if (existingId) {
        alreadyOnRoster.push({
          row: row.row,
          firstName: row.firstName,
          lastName: row.lastName,
          employeeId: existingId,
        });
      } else {
        imported.push({ id: employeeIdFor(sourceSheet, row.row), ...row });
      }
    }
    if (imported.length) {
      await tx.employee.createMany({
        data: imported.map((e) => ({
          id: e.id,
          sourceSheet,
          sourceRow: e.row,
          firstName: e.firstName,
          lastName: e.lastName,
          manager: e.manager,
        })),
      });
    }
  });

  const verification = await kickOffVerification(
    imported.map((e) => e.id),
    input.verify,
    importedAt,
    input.provider,
  );
  return {
    fileName: input.fileName,
    total,
    imported,
    alreadyOnRoster,
    skipped,
    importedAt,
    verification,
  };
}
