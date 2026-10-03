import { getRun } from "@/services/verificationRecorder";
export const runtime = "nodejs";
export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const run = await getRun(id);
  return run
    ? Response.json(run, { headers: { "Cache-Control": "no-store" } })
    : Response.json({ error: "Recording not found." }, { status: 404 });
}
