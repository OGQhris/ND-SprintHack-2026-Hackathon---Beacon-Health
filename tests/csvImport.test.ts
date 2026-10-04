import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CsvImportError,
  nameKey,
  parseCsv,
  parseEmployeeCsv,
} from "../services/csvImport";
import { toCsv } from "../lib/export/csv";

// Pure parsing rules for the "Add employees" CSV import; the database path is exercised by the import route.

test("parseCsv handles BOM, CRLF, quoted delimiters, doubled quotes and semicolon files", () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n'), [
    ["a", "b"],
    ["x, y", 'say "hi"'],
  ]);
  assert.deepEqual(parseCsv("First name;Last name\nAnn;Lee\n"), [
    ["First name", "Last name"],
    ["Ann", "Lee"],
  ]);
  assert.deepEqual(parseCsv("\n\nFirst name\tLast name\nAnn\tLee"), [
    [""],
    [""],
    ["First name", "Last name"],
    ["Ann", "Lee"],
  ]);
});

test("a stray quote inside a field stays text and never swallows the rest of the file", () => {
  const parsed = parseEmployeeCsv(
    "First name,Last name,Manager\nMary,O\"Brien,Boss\nNext,Person,Boss\nThird,Person,Boss\n",
  );
  assert.equal(parsed.total, 3);
  assert.deepEqual(
    parsed.rows.map((r) => [r.row, r.firstName, r.lastName]),
    [
      [2, "Mary", 'O"Brien'],
      [3, "Next", "Person"],
      [4, "Third", "Person"],
    ],
  );
  assert.throws(
    () => parseCsv('First name,Last name\n"Mary,Smith\nNext,Person\n'),
    (e: unknown) =>
      e instanceof CsvImportError && /never closed/.test(e.message),
  );
});

test("header aliases, skipped rows with reasons, duplicates and control characters", () => {
  const parsed = parseEmployeeCsv(
    [
      "FIRST NAME,Surname,Supervisor,Dept",
      "Kathryn,Cell,Kimblery Gjeltema,ICU",
      ",Nolast,Boss,",
      "Onlyfirst,,Boss,",
      "KATHRYN , cell ,Other,",
      '"Jane\nAnne",Smith,Boss,',
      "Zero​Width,Space,Boss,",
      "",
    ].join("\r\n"),
  );
  assert.equal(parsed.total, 6);
  assert.deepEqual(
    parsed.rows.map((r) => `${r.row}:${r.firstName} ${r.lastName}/${r.manager}`),
    ["2:Kathryn Cell/Kimblery Gjeltema", "7:ZeroWidth Space/Boss"],
  );
  assert.deepEqual(
    parsed.skipped.map((s) => `${s.row}:${s.reason}`),
    [
      "3:Missing first name",
      "4:Missing last name",
      "5:Duplicate of row 2",
      "6:Name contains a line break or control character",
    ],
  );
});

test("missing or wrong headers, empty files and oversized files are rejected", () => {
  assert.throws(
    () => parseEmployeeCsv("Name,Dept\nA,B\n"),
    (e: unknown) =>
      e instanceof CsvImportError && /found: Name, Dept/.test(e.message),
  );
  assert.throws(
    () => parseEmployeeCsv("\n\n"),
    (e: unknown) => e instanceof CsvImportError && /empty/.test(e.message),
  );
  const headerOnly = parseEmployeeCsv("First name,Last name\n");
  assert.equal(headerOnly.total, 0);
  const big =
    "First name,Last name\n" +
    Array.from({ length: 501 }, (_, i) => `P${i},Q${i}`).join("\n");
  assert.throws(
    () => parseEmployeeCsv(big),
    (e: unknown) =>
      e instanceof CsvImportError && /up to 500/.test(e.message),
  );
});

test("nameKey ignores case, accents and extra spaces", () => {
  assert.equal(nameKey("José", " SMITH "), nameKey("jose", "smith"));
  assert.notEqual(nameKey("Ann", "Lee"), nameKey("Anne", "Lee"));
});

test("Export CSV neutralises spreadsheet formulas in imported names", () => {
  const csv = toCsv(["Name"], [['=HYPERLINK("http://evil","x")'], ["+1-555"], ["Ann"]]);
  assert.match(csv, /^Name\r\n"'=HYPERLINK\(""http:\/\/evil"",""x""\)"\r\n'\+1-555\r\nAnn\r\n$/);
});
