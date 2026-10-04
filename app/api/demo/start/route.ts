import { z } from "zod";
import { resetDemoEmployees } from "@/lib/sample-employees";
import { db } from "@/lib/db";
import { guardOrigin, safeError } from "@/lib/http";
import {
  DEFAULT_EMAIL_DELAY_SECONDS,
  MAX_EMAIL_DELAY_SECONDS,
} from "@/lib/demo-settings";

export const runtime = "nodejs";
export const maxDuration = 330;
const shared = globalThis as unknown as { beaconDemoStarting?: boolean };
const settingsSchema = z.strictObject({
  delaySeconds: z
    .number()
    .int()
    .min(0)
    .max(MAX_EMAIL_DELAY_SECONDS)
    .default(DEFAULT_EMAIL_DELAY_SECONDS),
});

export async function POST(request: Request) {
  const startedAt = Date.now();
  const blocked = guardOrigin(request);
  if (blocked) return blocked;
  const body = await request.text();
  let settings;
  try {
    settings = settingsSchema.safeParse(body ? JSON.parse(body) : {});
  } catch {
    return Response.json({ error: "Invalid demo settings." }, { status: 400 });
  }
  if (!settings.success) {
    return Response.json(
      {
        error: `Email delay must be a whole number from 0 to ${MAX_EMAIL_DELAY_SECONDS} seconds.`,
      },
      { status: 400 },
    );
  }
  const sendAfter = startedAt + settings.data.delaySeconds * 1000;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const recipient = process.env.RESEND_TEST_EMAIL_TO?.trim();
  if (shared.beaconDemoStarting) {
    return Response.json(
      { error: "The demo is already starting. Please wait." },
      { status: 409 },
    );
  }
  shared.beaconDemoStarting = true;
  try {
    await resetDemoEmployees();
    const matches = await db.employee.findMany({
      where: { firstName: "Kathryn", lastName: "Cell", sourceSheet: "RNS" },
      select: { demoExpirationDate: true },
    });
    const expirationDate =
      matches.length === 1 ? matches[0].demoExpirationDate : null;
    if (!expirationDate)
      throw new Error(
        "Kathryn Cell's demo expiration date could not be found.",
      );
    if (!apiKey || !recipient || !z.email().safeParse(recipient).success) {
      return Response.json({
        samplesAdded: true,
        expirationDate,
        emailSkipped: true,
      });
    }

    // Keep the delay on the server so navigation doesn't cancel the demo email.
    const remainingDelay = Math.max(0, sendAfter - Date.now());
    if (remainingDelay > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, remainingDelay));
    }
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `beacon-sample-demo-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          from: "Beacon Demo <onboarding@resend.dev>",
          to: [recipient],
          subject: "Kathryn Cell expires in 5 days!",
          text: `Kathryn Cell's Registered Nurse credential expires in 5 days, on ${expirationDate}.\n\nPlease follow up with Kathryn to confirm her renewal before the expiration date.\n\nDemo notification: Kathryn Cell is a real employee, but this expiration date is simulated for the Beacon demo and does not represent her actual license expiration. Run a live verification to retrieve the source date.`,
          html: `<h1>Kathryn Cell expires in 5 days!</h1><p>Kathryn Cell's Registered Nurse credential expires in 5 days, on <strong>${expirationDate}</strong>.</p><p>Please follow up with Kathryn to confirm her renewal before the expiration date.</p><hr><p><strong>Demo notification:</strong> Kathryn Cell is a real employee, but this expiration date is simulated for the Beacon demo and does not represent her actual license expiration. Run a live verification to retrieve the source date.</p>`,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const error =
          response.status === 401
            ? "Sample employees have been added, but Resend rejected the API key. Check RESEND_API_KEY."
            : response.status === 403
              ? "Sample employees have been added, but Resend's test sender can only email your Resend account address. Check RESEND_TEST_EMAIL_TO and key permissions."
              : "Sample employees have been added, but Resend could not send the notification. Check your Resend dashboard and try again.";
        return Response.json(
          { error, samplesAdded: true, expirationDate },
          { status: 502 },
        );
      }
      const result = await response.json();
      if (typeof result.id !== "string")
        throw new Error("Unexpected Resend response");
      return Response.json({
        samplesAdded: true,
        expirationDate,
        recipient,
        emailId: result.id,
      });
    } catch {
      return Response.json(
        {
          error:
            "Sample employees have been added, but the email send could not be confirmed. Check your Resend dashboard before retrying.",
          samplesAdded: true,
          expirationDate,
        },
        { status: 502 },
      );
    }
  } catch (error) {
    return safeError(error, "The demo could not be started.");
  } finally {
    shared.beaconDemoStarting = false;
  }
}
