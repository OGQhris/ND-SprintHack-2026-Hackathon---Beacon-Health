import { NextResponse } from "next/server";
export function safeError(
  error: unknown,
  message = "This request could not be completed. Please try again.",
  status = 500,
) {
  console.error("[API]", error);
  return NextResponse.json({ error: message }, { status });
}
// Local demo writes are same-origin. Do not allow another website to trigger browser actions.
export function guardOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  const expectedOrigin = `${url.protocol}//${host}`;
  if (origin && origin !== expectedOrigin)
    return NextResponse.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 },
    );
  return null;
}
