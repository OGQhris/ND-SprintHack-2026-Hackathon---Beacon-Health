import { db } from "../lib/db";
import { resetDemoEmployees } from "../lib/sample-employees";
try {
  const employees = await resetDemoEmployees();
  console.log(
    "Added sample employees:",
    employees
      .map((e) => `${e.firstName} ${e.lastName}: ${e.expirationDate}`)
      .join(", "),
  );
} finally {
  await db.$disconnect();
}
