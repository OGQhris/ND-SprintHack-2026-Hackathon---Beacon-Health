import { z } from "zod";
import { resetDemoEmployees } from "@/lib/sample-employees";
import { guardOrigin, safeError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;
const shared = globalThis as unknown as { beaconDemoStarting?: boolean };

export async function POST(request: Request) {
  const sendAfter = Date.now() + 30_000;
  const blocked = guardOrigin(request);
  if (blocked) return blocked;
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
    const employees = await resetDemoEmployees();
    const expirationDate = employees[0].expirationDate!;
    if (!apiKey || !recipient || !z.email().safeParse(recipient).success) {
      return Response.json({
        samplesAdded: true,
        expirationDate,
        emailSkipped: true,
      });
    }

    // Keep the delay on the server so navigation doesn't cancel the demo email.
    await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.max(0, sendAfter - Date.now())),
    );
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
          subject: "Jamie Morgan expires in 30 days!",
          text: `Jamie Morgan's Registered Nurse credential expires in 30 days, on ${expirationDate}.\n\nPlease follow up with Jamie to confirm their renewal before the expiration date.\n\nDemo notification: Jamie Morgan is a fictional sample employee and does not represent a real employee license status.`,
          html: `<h1>Jamie Morgan expires in 30 days!</h1><p>Jamie Morgan's Registered Nurse credential expires on <strong>${expirationDate}</strong>.</p><p>Please follow up with Jamie to confirm their renewal before the expiration date.</p><hr><p><strong>Demo notification:</strong> This expiration date is simulated for the Beacon demo and does not represent a real employee license status.</p>`,
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
