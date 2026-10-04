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
    const employee = await verifyEmployee(id);
    // The audit row this check wrote, so the client can highlight the matching history entry.
    const audit = await db.verificationAudit
      .findFirst({
        where: { employeeId: id },
        orderBy: { checkedAt: "desc" },
        select: { id: true },
      })
      .catch(() => null);
    return Response.json({ employee, auditId: audit?.id });
  } catch (e) {
    return safeError(
      e,
      "Verification could not start. A check may already be in progress.",
      409,
    );
  }
}
