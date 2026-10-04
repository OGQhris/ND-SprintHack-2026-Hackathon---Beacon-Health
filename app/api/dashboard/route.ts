import { getDemoSettings } from "@/lib/demo";
import { listEmployees, summarize } from "@/lib/employees";
import { getBatchProgress } from "@/services/credentialService";
import { todayDate } from "@/lib/expiration";
import { aiConfigured } from "@/lib/openai";
import { safeError } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const employees = await listEmployees();
    return Response.json({
      demo: getDemoSettings(),
      employees,
      summary: summarize(employees),
      batch: getBatchProgress(),
      today: todayDate(),
      aiConfigured: aiConfigured(),
      managers: [...new Set(employees.map((e) => e.manager))].sort(),
    });
  } catch (e) {
    return safeError(
      e,
      "The database is unavailable. Run npm run setup and reload.",
    );
  }
}
