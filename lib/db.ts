import "./env";
import { PrismaClient } from "@prisma/client";
const shared = globalThis as unknown as { beaconDb?: PrismaClient };
export const db = shared.beaconDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") shared.beaconDb = db;
