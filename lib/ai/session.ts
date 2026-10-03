import { cookies } from "next/headers";
import { db } from "@/lib/db";
export const SESSION_COOKIE = "beacon_chat";
const shared = globalThis as unknown as { beaconChatLocks?: Set<string> };
export const chatLocks = (shared.beaconChatLocks ??= new Set());
export async function currentSession() {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return db.chatSession.findUnique({ where: { id } });
}
