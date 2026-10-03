import "../lib/env";
import { mkdir, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const url = process.env.DATABASE_URL || "file:./beacon.db";
if (!url.startsWith("file:"))
  throw new Error("This proof of concept requires a SQLite file DATABASE_URL.");
const path = resolve("prisma", url.slice(5));
await mkdir(dirname(path), { recursive: true });
// Prisma's schema engine expects an existing SQLite file on this environment.
// Append mode creates it without truncating any existing database.
const handle = await open(path, "a");
await handle.close();
console.log("[Database] SQLite file ready.");
