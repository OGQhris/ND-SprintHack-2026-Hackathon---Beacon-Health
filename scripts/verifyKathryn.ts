import { db } from "../lib/db";
import { verifyEmployee } from "../services/credentialService";
try {
  const employee = await db.employee.findFirst({
    where: { firstName: "Kathryn", lastName: "Cell" },
  });
  if (!employee) throw new Error("Run npm run import first.");
  const result = await verifyEmployee(employee.id);
  console.log(JSON.stringify(result, null, 2));
  if (result.verificationState !== "VERIFIED") process.exitCode = 1;
} finally {
  await db.$disconnect();
}
