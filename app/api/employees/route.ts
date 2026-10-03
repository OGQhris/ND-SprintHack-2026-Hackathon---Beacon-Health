import { listEmployees, needsAttention } from "@/lib/employees";
import { safeError } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    let employees = await listEmployees();
    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim().toLowerCase();
    const manager = params.get("manager");
    const state = params.get("state");
    if (q)
      employees = employees.filter((e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q),
      );
    if (manager) employees = employees.filter((e) => e.manager === manager);
    if (state)
      employees = employees.filter((e) => e.verificationState === state);
    if (params.get("attention") === "true")
      employees = employees.filter(needsAttention);
    return Response.json({ employees });
  } catch (e) {
    return safeError(
      e,
      "Employee records are unavailable. Run npm run setup and retry.",
    );
  }
}
