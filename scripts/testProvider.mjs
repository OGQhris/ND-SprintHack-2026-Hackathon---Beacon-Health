import assert from "node:assert/strict";
import { verifyMichiganRN } from "../services/credentialProviders/michiganRnPlaywrightProvider.ts";
const missing = await verifyMichiganRN({
  firstName: "BeaconNoSuchPersonXYZ",
  lastName: "NoSuchRNXYZ",
});
console.log("Live no-result test:", missing.state);
assert.equal(missing.state, "NOT_FOUND");
const ambiguous = await verifyMichiganRN({
  firstName: "John",
  lastName: "Smith",
});
console.log("Live paginated ambiguous-result test:", ambiguous.state);
assert.equal(ambiguous.state, "NEEDS_REVIEW");
