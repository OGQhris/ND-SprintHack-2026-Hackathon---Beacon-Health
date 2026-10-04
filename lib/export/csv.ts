/**
 * RFC 4180 CSV: quote fields containing commas, quotes or newlines; double embedded quotes.
 * Text that a spreadsheet would run as a formula (=, +, -, @, tab, CR) is prefixed with an apostrophe,
 * so an imported name can never execute when the export is opened in Excel.
 */
export function toCsv(headers: string[], records: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined) => {
    if (typeof value === "number") return String(value);
    let text = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...records].map((row) => row.map(escape).join(",")).join("\r\n") + "\r\n";
}

/** Triggers a browser download of CSV text. Client-side only. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
