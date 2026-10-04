import assert from "node:assert/strict";
import test from "node:test";
import { askBeacon } from "../lib/assistant/client";
import type { ChatActivity } from "../lib/assistant/types";

test("chat streaming retains verification identity and recording across tool updates", async () => {
  const originalFetch = globalThis.fetch;
  const snapshots: ChatActivity[][] = [];
  const encoder = new TextEncoder();
  const events = [
    {
      type: "tool_call_start",
      name: "get_employee_by_name",
      callId: "lookup",
      label: "Finding employee",
    },
    {
      type: "tool_call_complete",
      name: "get_employee_by_name",
      callId: "lookup",
      ok: true,
    },
    {
      type: "tool_call_start",
      name: "verify_employee_credential",
      callId: "verify",
      label: "Verifying credential",
      employeeId: "employee-1",
      startedAt: "2026-10-04T12:00:00Z",
    },
    {
      type: "tool_call_complete",
      name: "verify_employee_credential",
      callId: "verify",
      ok: false,
      recordingId: "recording-1",
    },
    { type: "text_delta", text: "The check needs review." },
    { type: "assistant_complete" },
  ];
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          const data = events
            .map((event) => `data: ${JSON.stringify(event)}\n\n`)
            .join("");
          // Split mid-frame to exercise the streaming parser rather than a single JSON payload.
          controller.enqueue(encoder.encode(data.slice(0, 101)));
          controller.enqueue(encoder.encode(data.slice(101)));
          controller.close();
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  try {
    const result = await askBeacon({
      question: "Verify this employee",
      history: [],
      threadId: "fixture",
      onDelta: () => {},
      onActivity: (activities) => snapshots.push(activities),
    });
    assert.equal(snapshots[2][1].done, false);
    assert.equal(snapshots[2][1].employeeId, "employee-1");
    assert.equal(result.activities[1].name, "verify_employee_credential");
    assert.equal(result.activities[1].recordingId, "recording-1");
    assert.equal(result.activities[1].startedAt, "2026-10-04T12:00:00Z");
    assert.equal(result.activities[1].ok, false);
    assert.equal(result.activities[0].done, true);
    assert.equal(result.reply, "The check needs review.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
