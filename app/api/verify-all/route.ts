import { z } from "zod";
import { getBatchProgress, startVerifyAll } from "@/services/credentialService";
import { safeError, guardOrigin } from "@/lib/http";
export const runtime = "nodejs";
export async function GET() {
  return Response.json({ progress: getBatchProgress() });
}
export async function POST(request: Request) {
  const denied = guardOrigin(request);
  if (denied) return denied;
  try {
    const body = await request.text();
    let payload: unknown = {};
    if (body) {
      try {
        payload = JSON.parse(body);
      } catch {
        return Response.json(
          { error: "Invalid verification request." },
          { status: 400 },
        );
      }
    }
    const parsed = z
      .strictObject({
        employeeIds: z.array(z.string().min(1)).min(1).max(100).optional(),
      })
      .safeParse(payload);
    if (!parsed.success)
      return Response.json(
        { error: "Select between 1 and 100 employees." },
        { status: 400 },
      );
    return Response.json(
      { progress: await startVerifyAll(undefined, parsed.data.employeeIds) },
      { status: 202 },
    );
  } catch (e) {
    return safeError(e);
  }
}
