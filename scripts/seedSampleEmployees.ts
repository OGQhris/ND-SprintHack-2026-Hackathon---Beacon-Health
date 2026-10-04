import { db } from "../lib/db";
import { seedSampleEmployees } from "../lib/sample-employees";
try {
  const employees = await seedSampleEmployees();
  console.log(
    "Added sample employees:",
    employees
      .map((e) => `${e.firstName} ${e.lastName}: ${e.expirationDate}`)
      .join(", "),
  );
} finally {
  await db.$disconnect();
}
