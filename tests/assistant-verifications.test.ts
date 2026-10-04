import assert from "node:assert/strict";
import test from "node:test";
import { finishAssistantVerification, isAssistantVerification, trackAssistantVerification } from "../lib/store/assistant-verifications";

test("AI checks suppress their polling toast while later manual checks still announce", (t) => {
  const start = Date.parse("2026-10-04T12:00:00Z");
  let now = start;
  t.mock.method(Date, "now", () => now);
  trackAssistantVerification("chat:verify", "employee", new Date(start).toISOString());
  now += 5_000;
  const checkedAt = new Date(now).toISOString();
  assert.equal(isAssistantVerification("employee", checkedAt), true, "polling can finish before the tool stream completes");
  assert.equal(isAssistantVerification("another-employee", checkedAt), false);
  assert.equal(isAssistantVerification("employee", new Date(start - 1).toISOString()), false);
  finishAssistantVerification("chat:verify");
  now += 5_000;
  assert.equal(isAssistantVerification("employee", checkedAt), true, "a delayed poll still suppresses the AI result");
  assert.equal(isAssistantVerification("employee", new Date(now).toISOString()), false, "later manual verification retains its toast");
  now += 15 * 60_000;
  assert.equal(isAssistantVerification("employee", checkedAt), false, "tracking expires");
});
