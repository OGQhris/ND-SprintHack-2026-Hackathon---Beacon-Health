import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import type { Page, Locator } from "playwright";
import type {
  VerificationRun,
  VerificationStep,
} from "@/lib/verification-view";
import type { CredentialVerificationResult } from "./credentialProviders/types";
const root = path.join(process.cwd(), "data", "verification-runs");
const shared = globalThis as unknown as {
  beaconRuns?: Map<string, VerificationRun>;
};
const runs = (shared.beaconRuns ??= new Map());
export const validRunId = (id: string) => /^[a-f0-9-]{36}$/.test(id);
export function activeRuns() {
  return [...runs.values()].filter((r) => !r.finishedAt);
}
export async function getRun(id: string): Promise<VerificationRun | null> {
  if (!validRunId(id)) return null;
  const live = runs.get(id);
  if (live) return live;
  try {
    const run: VerificationRun = JSON.parse(
      await readFile(path.join(root, id, "manifest.json"), "utf8"),
    );
    if (!run.finishedAt) {
      run.state = "ERROR";
      run.finishedAt = run.steps.at(-1)?.timestamp || run.startedAt;
      run.error =
        "The server stopped during this recording. Saved browser steps are available for review.";
    }
    return run;
  } catch {
    return null;
  }
}
export async function readFrame(id: string, index: string) {
  if (!validRunId(id) || !/^\d{1,3}$/.test(index)) return null;
  try {
    return await readFile(path.join(root, id, `${index}.jpg`));
  } catch {
    return null;
  }
}
export class VerificationRecorder {
  run: VerificationRun;
  constructor(
    employee: { id: string; firstName: string; lastName: string },
    origin: "single" | "batch" = "single",
  ) {
    this.run = {
      id: randomUUID(),
      employeeId: employee.id,
      origin,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      startedAt: new Date().toISOString(),
      state: "VERIFYING",
      steps: [],
    };
    runs.set(this.run.id, this.run);
    // Live memory is bounded; completed recordings remain available on disk.
    for (const [id, run] of runs)
      if (runs.size > 40 && run.finishedAt) runs.delete(id);
  }
  async save() {
    await mkdir(path.join(root, this.run.id), { recursive: true });
    const manifest = path.join(root, this.run.id, "manifest.json");
    await writeFile(`${manifest}.tmp`, JSON.stringify(this.run));
    await rename(`${manifest}.tmp`, manifest);
  }
  async capture(
    page: Page,
    label: string,
    kind: VerificationStep["kind"],
    locator?: Locator,
  ) {
    try {
      if (locator) {
        await locator.scrollIntoViewIfNeeded();
        await locator.evaluate((el) =>
          el.scrollIntoView({
            block: "center",
            inline: "nearest",
            behavior: "instant",
          }),
        );
      }
      const box = locator ? await locator.boundingBox() : null;
      const viewport = page.viewportSize()!;
      const index = this.run.steps.length;
      await mkdir(path.join(root, this.run.id), { recursive: true });
      await page.screenshot({
        path: path.join(root, this.run.id, `${index}.jpg`),
        type: "jpeg",
        quality: 78,
        timeout: 5000,
      });
      this.run.steps.push({
        index,
        label,
        kind,
        timestamp: new Date().toISOString(),
        frameUrl: `/api/verification-runs/${this.run.id}/frames/${index}`,
        ...(box
          ? {
              target: {
                x: (box.x + box.width / 2) / viewport.width,
                y: (box.y + box.height / 2) / viewport.height,
                width: box.width / viewport.width,
                height: box.height / viewport.height,
              },
            }
          : {}),
      });
      await this.save();
    } catch (error) {
      console.warn(
        "[Verification viewer] Frame unavailable",
        error instanceof Error ? error.message : "Capture failed",
      );
    }
  }
  async finish(result: CredentialVerificationResult) {
    this.run.state = result.state;
    this.run.finishedAt = new Date().toISOString();
    this.run.error = result.error;
    this.run.result = result.credential
      ? {
          licenseNumber: result.credential.licenseNumber,
          status: result.credential.status,
          expirationDate: result.credential.expirationDate,
        }
      : undefined;
    await this.save();
  }
}
