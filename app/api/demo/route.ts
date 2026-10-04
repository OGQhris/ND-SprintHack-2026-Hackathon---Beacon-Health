import { z } from "zod";
import { getDemoSettings, setDemoSettings } from "@/lib/demo";
import { guardOrigin, safeError } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const denied = guardOrigin(request);
  if (denied) return denied;
  const parsed = z
    .strictObject({
      enabled: z.boolean(),
      today: z.string(),
      seedDate: z.string().optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Choose a valid demo configuration." },
      { status: 400 },
    );
  try {
    return Response.json({
      demo: await setDemoSettings({ ...getDemoSettings(), ...parsed.data }),
    });
  } catch (e) {
    return safeError(e, "The demo date could not be updated.", 400);
  }
}
