import { verifyEmployee } from "@/services/credentialService";
import { db } from "@/lib/db";
import { safeError, guardOrigin } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = guardOrigin(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    if (!(await db.employee.findUnique({ where: { id } })))
      return Response.json({ error: "Employee not found." }, { status: 404 });
    return Response.json({ employee: await verifyEmployee(id) });
  } catch (e) {
    return safeError(
      e,
      "Verification could not start. A check may already be in progress.",
      409,
    );
  }
}
