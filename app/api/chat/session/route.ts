import { db } from "@/lib/db";
import { currentSession, SESSION_COOKIE, chatLocks } from "@/lib/ai/session";
import { cookies } from "next/headers";
import { aiConfigured } from "@/lib/openai";
import { safeError, guardOrigin } from "@/lib/http";
export const runtime = "nodejs";
async function createSession() {
  const session = await db.chatSession.create({ data: {} });
  (await cookies()).set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "strict",
    secure:
      process.env.NODE_ENV === "production" && process.env.HTTPS === "true",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return session;
}
export async function GET() {
  try {
    const session = (await currentSession()) || (await createSession());
    const messages = await db.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({
      messages,
      configured: aiConfigured(),
      busy: chatLocks.has(session.id),
    });
  } catch (e) {
    return safeError(e);
  }
}
export async function POST(request: Request) {
  const denied = guardOrigin(request);
  if (denied) return denied;
  try {
    await createSession();
    return Response.json({
      messages: [],
      configured: aiConfigured(),
      busy: false,
    });
  } catch (e) {
    return safeError(e);
  }
}
