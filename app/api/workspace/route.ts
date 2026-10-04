import { loadWorkspace } from "@/lib/data/repository";
import { safeError } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** The front end's whole snapshot; the store polls this and re-fetches it after any mutation. */
export async function GET() {
  try {
    return Response.json(await loadWorkspace(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return safeError(
      e,
      "The database is unavailable. Run npm run setup and reload.",
    );
  }
}
