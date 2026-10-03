import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
export type ImportRow = {
  sourceSheet: string;
  sourceRow: number;
  firstName: string;
  lastName: string;
  manager: string;
};
export async function readFourthWorksheet(path: string): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.worksheets[3];
  if (!sheet) throw new Error("The workbook must contain a fourth worksheet.");
  const text = (cell: ExcelJS.Cell) => cell.text.trim();
  let headerRow = 0;
  const columns: Record<string, number> = {};
  sheet.eachRow((row, i) => {
    if (headerRow) return;
    const found: Record<string, number> = {};
    row.eachCell((cell, c) => {
      found[text(cell).toUpperCase()] = c;
    });
    if (["FIRST NAME", "LAST NAME", "MANAGER"].every((k) => found[k])) {
      headerRow = i;
      Object.assign(columns, found);
    }
  });
  if (!headerRow)
    throw new Error(
      "Worksheet four needs FIRST NAME, LAST NAME, and MANAGER headers.",
    );
  const rows: ImportRow[] = [];
  sheet.eachRow((row, i) => {
    if (i <= headerRow) return;
    const firstName = text(row.getCell(columns["FIRST NAME"]));
    const lastName = text(row.getCell(columns["LAST NAME"]));
    const manager = text(row.getCell(columns.MANAGER));
    if (!firstName && !lastName && !manager) return;
    if (!firstName || !lastName || !manager)
      throw new Error(
        `Incomplete employee on worksheet four, row ${i}. No records imported.`,
      );
    rows.push({
      sourceSheet: sheet.name,
      sourceRow: i,
      firstName,
      lastName,
      manager,
    });
  });
  if (!rows.length) throw new Error("Worksheet four contains no employees.");
  return rows;
}
export async function importEmployees(path: string) {
  const rows = await readFourthWorksheet(path);
  await db.$transaction(async (tx) => {
    for (const row of rows) {
      const id =
        "rn_" +
        createHash("sha256")
          .update(`${row.sourceSheet}:${row.sourceRow}`)
          .digest("hex")
          .slice(0, 16);
      const old = await tx.employee.findUnique({ where: { id } });
      if (
        old &&
        (old.firstName !== row.firstName || old.lastName !== row.lastName)
      ) {
        throw new Error(
          `Row ${row.sourceRow} changed employee identity. Import halted to preserve license ownership; review this row before re-importing.`,
        );
      }
      await tx.employee.upsert({
        where: { id },
        create: { id, ...row },
        update: { manager: row.manager },
      });
    }
  });
  return {
    imported: rows.length,
    worksheet: rows[0].sourceSheet,
    worksheetNumber: 4,
  };
}
