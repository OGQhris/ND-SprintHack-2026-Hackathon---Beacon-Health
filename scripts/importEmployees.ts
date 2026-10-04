import { importEmployees } from "../services/excelImport";
import { seedSampleEmployees } from "../lib/sample-employees";
import { db } from "../lib/db";
const path = process.argv[2] || "data/Credentialing List - KZO.xlsx";
try {
  console.log("[Import]", await importEmployees(path));
  await seedSampleEmployees();
} catch (error) {
  console.error(
    "[Import]",
    error instanceof Error ? error.message : "Import failed",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
