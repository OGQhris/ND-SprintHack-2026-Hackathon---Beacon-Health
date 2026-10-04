import "../lib/env";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { db } from "../lib/db";

/**
 * Save, restore and reset the demo state so you can exercise every verification path and then put the
 * app back the way the judges should first see it.
 *
 *   npm run demo:snapshot -- <name>              consistent copy of the database, recordings and demo clock
 *   npm run demo:restore  -- <name>              put that copy back (stop the dev server first)
 *   npm run demo:reset    -- [--keep "First Last"]...   everyone back to "Not yet verified", except the people kept
 *   npm run demo:list                            what snapshots exist
 *
 * State covered: prisma/beacon.db (employees, audits, alert actions), data/verification-runs (browser
 * recordings), data/demo-settings.json (demo clock). Ask Beacon threads live in the browser; delete them
 * from the /ask page if a clean chat matters for the demo.
 */

const TAG = "[Demo state]";
const root = process.cwd();
const dataDir = path.resolve(root, process.env.DEMO_DATA_DIR || "data");
const dbUrl = process.env.DATABASE_URL || "file:./beacon.db";
const dbPath = path.resolve(root, "prisma", dbUrl.replace(/^file:/, ""));
const runsDir = path.join(dataDir, "verification-runs");
const demoFile = path.join(dataDir, "demo-settings.json");
const snapshotsDir = path.resolve(root, process.env.DEMO_SNAPSHOT_DIR || path.join(dataDir, "snapshots"));

type Manifest = {
  name: string;
  createdAt: string;
  employees: number;
  verified: number;
  audits: number;
  alertActions: number;
  recordings: number;
  demoClock: boolean;
};

function fail(message: string): never {
  console.error(TAG, message);
  process.exit(1);
}

function parseArgs(argv: string[]): { command: string; name: string; keep: string[]; force: boolean } {
  const [command = "help", ...rest] = argv;
  const keep: string[] = [];
  const positional: string[] = [];
  let force = false;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--keep") {
      const value = rest[++i];
      if (!value) fail("--keep needs a name, for example --keep \"Kathryn Cell\".");
      keep.push(...value.split(",").map((s) => s.trim()).filter(Boolean));
    } else if (arg === "--force") force = true;
    else positional.push(arg);
  }
  const name = positional[0] ?? "pristine";
  if (!/^[a-z0-9][a-z0-9._-]{0,60}$/i.test(name)) fail("Snapshot names use letters, digits, dots, dashes and underscores.");
  return { command, name, keep, force };
}

/** PIDs holding the database open (the dev server, usually). lsof exits 1 when nothing matches. */
function databaseHolders(): string[] {
  try {
    return execFileSync("lsof", ["-t", dbPath], { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .split(/\s+/)
      .filter(Boolean);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 1) return [];
    console.warn(TAG, "Could not check whether the database is open; continuing.");
    return [];
  }
}

function requireServerStopped(action: string, force: boolean) {
  const holders = databaseHolders();
  if (!holders.length || force) return;
  fail(
    `${action} replaces files the running server has open (process ${holders.join(", ")}). ` +
      "Stop the dev server with Ctrl+C, run this again, then start it back up. Use --force to override.",
  );
}

async function counts(): Promise<Omit<Manifest, "name" | "createdAt" | "recordings" | "demoClock">> {
  const [employees, verified, audits, alertActions] = await Promise.all([
    db.employee.count(),
    db.employee.count({ where: { verificationState: "VERIFIED" } }),
    db.verificationAudit.count(),
    db.alertAction.count(),
  ]);
  return { employees, verified, audits, alertActions };
}

function recordingDirs(): string[] {
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function describe(m: Manifest): string {
  return `${m.employees} employees, ${m.verified} verified, ${m.audits} audits, ${m.alertActions} alert actions, ${m.recordings} recordings, demo clock ${m.demoClock ? "on file" : "off"}`;
}

async function snapshot(name: string) {
  const dir = path.join(snapshotsDir, name);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // VACUUM INTO writes a consistent copy even while the dev server has the database open.
  const target = path.join(dir, "beacon.db").replace(/'/g, "''");
  await db.$executeRawUnsafe(`VACUUM INTO '${target}'`);
  if (existsSync(runsDir)) cpSync(runsDir, path.join(dir, "verification-runs"), { recursive: true });
  if (existsSync(demoFile)) cpSync(demoFile, path.join(dir, "demo-settings.json"));
  const manifest: Manifest = {
    name,
    createdAt: new Date().toISOString(),
    ...(await counts()),
    recordings: recordingDirs().length,
    demoClock: existsSync(demoFile),
  };
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(TAG, `Saved snapshot "${name}" to ${path.relative(root, dir)}: ${describe(manifest)}.`);
}

async function restore(name: string, force: boolean) {
  const dir = path.join(snapshotsDir, name);
  const source = path.join(dir, "beacon.db");
  if (!existsSync(source)) fail(`No snapshot named "${name}" under ${path.relative(root, snapshotsDir)}. Run npm run demo:list.`);
  await db.$disconnect();
  requireServerStopped("Restoring", force);
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    if (existsSync(dbPath + suffix)) rmSync(dbPath + suffix);
  }
  cpSync(source, dbPath);
  rmSync(runsDir, { recursive: true, force: true });
  const savedRuns = path.join(dir, "verification-runs");
  if (existsSync(savedRuns)) cpSync(savedRuns, runsDir, { recursive: true });
  const savedDemo = path.join(dir, "demo-settings.json");
  if (existsSync(savedDemo)) cpSync(savedDemo, demoFile);
  else if (existsSync(demoFile)) rmSync(demoFile);
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as Manifest;
  console.log(TAG, `Restored snapshot "${name}" from ${manifest.createdAt}: ${describe(manifest)}.`);
  console.log(TAG, "Start the dev server again; roster-check progress and live recordings are in memory and start clean.");
}

async function reset(keep: string[]) {
  const employees = await db.employee.findMany({ select: { id: true, firstName: true, lastName: true } });
  const wanted = new Set(keep.map((n) => n.toLowerCase().replace(/\s+/g, " ")));
  const kept = employees.filter((e) => wanted.has(`${e.firstName} ${e.lastName}`.toLowerCase()));
  const missing = [...wanted].filter((n) => !kept.some((e) => `${e.firstName} ${e.lastName}`.toLowerCase() === n));
  if (missing.length) fail(`Nobody on the roster is named ${missing.join(", ")}. Names must match the workbook spelling.`);
  const keptIds = kept.map((e) => e.id);

  const result = await db.$transaction(async (tx) => {
    const audits = await tx.verificationAudit.deleteMany({ where: { employeeId: { notIn: keptIds } } });
    const alerts = await tx.alertAction.deleteMany();
    const reset = await tx.employee.updateMany({
      where: { id: { notIn: keptIds } },
      data: {
        licenseNumber: null,
        credentialStatus: null,
        issueDate: null,
        expirationDate: null,
        county: null,
        verificationState: "UNVERIFIED",
        lastVerifiedAt: null,
        lastAttemptAt: null,
        verificationError: null,
        sourceUrl: null,
      },
    });
    return { audits: audits.count, alerts: alerts.count, reset: reset.count };
  });

  let removedRecordings = 0;
  for (const id of recordingDirs()) {
    const manifestPath = path.join(runsDir, id, "manifest.json");
    let employeeId: string | undefined;
    try {
      employeeId = (JSON.parse(readFileSync(manifestPath, "utf8")) as { employeeId?: string }).employeeId;
    } catch {
      employeeId = undefined;
    }
    if (employeeId && keptIds.includes(employeeId)) continue;
    rmSync(path.join(runsDir, id), { recursive: true, force: true });
    removedRecordings++;
  }
  const hadDemo = existsSync(demoFile);
  if (hadDemo) rmSync(demoFile);

  console.log(
    TAG,
    `Reset ${result.reset} employees to Not yet verified` +
      (kept.length ? ` (kept ${kept.map((e) => `${e.firstName} ${e.lastName}`).join(", ")})` : "") +
      `; removed ${result.audits} audits, ${result.alerts} alert actions, ${removedRecordings} recordings` +
      (hadDemo ? "; demo clock turned off" : "") +
      ".",
  );
  if (databaseHolders().length) {
    console.log(TAG, "The dev server is running: the dashboard picks this up on its next poll. Restart it if the demo clock was on.");
  }
}

function list() {
  if (!existsSync(snapshotsDir)) {
    console.log(TAG, `No snapshots yet. Create one with: npm run demo:snapshot -- pristine`);
    return;
  }
  const names = readdirSync(snapshotsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  if (!names.length) {
    console.log(TAG, "No snapshots yet.");
    return;
  }
  for (const name of names) {
    try {
      const m = JSON.parse(readFileSync(path.join(snapshotsDir, name, "manifest.json"), "utf8")) as Manifest;
      console.log(`${name}  (${m.createdAt})  ${describe(m)}`);
    } catch {
      console.log(`${name}  (no manifest)`);
    }
  }
}

const { command, name, keep, force } = parseArgs(process.argv.slice(2));
try {
  if (command === "snapshot") await snapshot(name);
  else if (command === "restore") await restore(name, force);
  else if (command === "reset") await reset(keep);
  else if (command === "list") list();
  else {
    console.log("Usage: demoState.ts snapshot|restore|reset|list [name] [--keep \"First Last\"] [--force]");
    process.exitCode = command === "help" ? 0 : 1;
  }
} catch (error) {
  console.error(TAG, error instanceof Error ? error.message : "Failed");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
