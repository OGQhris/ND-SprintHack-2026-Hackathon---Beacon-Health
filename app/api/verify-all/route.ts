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
    return Response.json({ progress: await startVerifyAll() }, { status: 202 });
  } catch (e) {
    return safeError(e);
  }
}
