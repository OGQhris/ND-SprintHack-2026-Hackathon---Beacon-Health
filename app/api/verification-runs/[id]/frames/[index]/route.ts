import { readFrame } from "@/services/verificationRecorder";
export const runtime = "nodejs";
export async function GET(
  _: Request,
  context: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await context.params;
  const frame = await readFrame(id, index);
  return frame
    ? new Response(new Uint8Array(frame), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, max-age=86400",
          "X-Content-Type-Options": "nosniff",
        },
      })
    : new Response("Frame not found", { status: 404 });
}
