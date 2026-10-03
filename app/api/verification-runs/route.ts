import { activeRuns } from "@/services/verificationRecorder";
export const runtime = "nodejs";
export async function GET() {
  return Response.json(
    { runs: activeRuns() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
