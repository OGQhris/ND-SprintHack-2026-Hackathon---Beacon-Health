import { dateOrdinal } from "@/lib/expiration";
import {
  MICHIGAN_URL,
  type CredentialVerificationResult,
  type LicenseCandidate,
} from "./types";
export function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const date = match
    ? `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`
    : value.trim();
  return dateOrdinal(date) === null ? null : date;
}
export function candidateFromFields(
  fields: Record<string, string>,
  sourceUrl = MICHIGAN_URL,
): LicenseCandidate {
  const values = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [
      k.toLowerCase().replace(/[^a-z]/g, ""),
      v.trim(),
    ]),
  );
  const read = (...keys: string[]) =>
    keys.map((k) => values[k]).find(Boolean) || null;
  return {
    employeeName: read("name", "fullname", "licenseename") || "",
    credentialType: read("licensetype", "credentialtype") || "",
    licenseNumber: read("licensenumber", "licenseno"),
    issueDate: normalizeDate(read("licenseissuedate", "issuedate")),
    expirationDate: normalizeDate(
      read("licenseexpirationdate", "expirationdate"),
    ),
    status: read("licensestatus", "status"),
    county: read("county"),
    sourceUrl,
  };
}
const normalized = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, "")
    .trim()
    .split(/\s+/);
export function nameMatches(
  candidate: string,
  firstName: string,
  lastName: string,
) {
  const tokens = normalized(candidate),
    first = normalized(firstName),
    last = normalized(lastName);
  return (
    tokens.slice(0, first.length).join(" ") === first.join(" ") &&
    tokens.slice(-last.length).join(" ") === last.join(" ")
  );
}
export function classifyCandidates(
  candidates: LicenseCandidate[],
  employee: { firstName: string; lastName: string },
  rawFields: unknown,
  complete = true,
): CredentialVerificationResult {
  const result: CredentialVerificationResult = {
    state: "NEEDS_REVIEW",
    source: "Michigan MILARA",
    sourceUrl: MICHIGAN_URL,
    checkedAt: new Date().toISOString(),
    credential: null,
    candidates,
    rawFields,
    error: null,
  };
  const rns = candidates.filter(
    (c) => c.credentialType.trim().toLowerCase() === "registered nurse",
  );
  const matches = rns.filter((c) =>
    nameMatches(c.employeeName, employee.firstName, employee.lastName),
  );
  if (!candidates.length && complete)
    return {
      ...result,
      state: "NOT_FOUND",
      error: "No license results were returned by Michigan MILARA.",
    };
  if (!complete)
    return {
      ...result,
      error: "Results may span additional pages. Human review is required.",
    };
  if (!matches.length)
    return {
      ...result,
      error:
        "No exact Registered Nurse name match. Review the source results and workbook spelling.",
    };
  if (matches.length > 1)
    return {
      ...result,
      candidates: matches,
      error:
        "Multiple Registered Nurse licenses match this name. Human review is required.",
    };
  const c = matches[0];
  if (!c.licenseNumber || !c.status || !c.expirationDate)
    return {
      ...result,
      error:
        "The matching result is missing license number, status, or a valid expiration date.",
    };
  return {
    ...result,
    state: "VERIFIED",
    credential: c,
    sourceUrl: c.sourceUrl,
    candidates: matches,
  };
}
