import { db } from "@/lib/db";
import { serializeEmployee } from "@/lib/employees";
import { safeError } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const employee = await db.employee.findUnique({
      where: { id },
      include: { audits: { orderBy: { checkedAt: "desc" }, take: 25 } },
    });
    if (!employee)
      return Response.json({ error: "Employee not found." }, { status: 404 });
    const { audits, ...record } = employee;
    return Response.json({
      employee: serializeEmployee(record),
      audits: audits.map((a) => ({
        id: a.id,
        source: a.source,
        sourceUrl: a.sourceUrl,
        checkedAt: a.checkedAt,
        state: a.state,
        licenseNumber: a.licenseNumber,
        status: a.status,
        expirationDate: a.expirationDate,
        error: a.error,
        normalized: JSON.parse(a.normalizedJson),
      })),
    });
  } catch (e) {
    return safeError(e);
  }
}
