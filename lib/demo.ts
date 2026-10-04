import { readFileSync, existsSync } from "node:fs";
import { mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import type { DemoSettings } from "./types";
export type { DemoSettings };
const file = path.join(process.cwd(), "data", "demo-settings.json");
const realToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Indiana/Indianapolis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function validDemoDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}
const shared = globalThis as unknown as { beaconDemo?: DemoSettings };
function initial(): DemoSettings {
  const today = realToday();
  if (
    process.env.NODE_ENV !== "test" &&
    !process.env.DATABASE_URL?.includes("beacon-tests-") &&
    existsSync(file)
  ) {
    try {
      const saved = JSON.parse(readFileSync(file, "utf8"));
      if (
        typeof saved.enabled === "boolean" &&
        validDemoDate(saved.today) &&
        validDemoDate(saved.seedDate)
      )
        return saved;
    } catch {}
  }
  return { enabled: false, today, seedDate: today };
}
export function getDemoSettings() {
  return { ...(shared.beaconDemo ??= initial()) };
}
export async function setDemoSettings(settings: DemoSettings) {
  if (!validDemoDate(settings.today) || !validDemoDate(settings.seedDate))
    throw new Error("Choose a valid demo date.");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, JSON.stringify(settings));
  await rename(`${file}.tmp`, file);
  shared.beaconDemo = { ...settings };
  return getDemoSettings();
}
export function seededExpiration(
  sourceRow: number,
  settings = getDemoSettings(),
) {
  if (!settings.enabled) return null;
  const offsets = [-4, 3, 10, 23, 65];
  return new Date(
    Date.parse(`${settings.seedDate}T00:00:00Z`) +
      offsets[sourceRow % offsets.length] * 86400000,
  )
    .toISOString()
    .slice(0, 10);
}
