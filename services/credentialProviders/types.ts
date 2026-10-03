import type { VerificationRecorder } from "../verificationRecorder";
export const MICHIGAN_URL =
  "https://aca-prod.accela.com/MILARA/GeneralProperty/PropertyLookUp.aspx?isLicensee=Y&TabName=APO";
export type LicenseCandidate = {
  employeeName: string;
  credentialType: string;
  licenseNumber: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  status: string | null;
  county: string | null;
  sourceUrl: string;
};
export type CredentialVerificationResult = {
  state: "VERIFIED" | "NOT_FOUND" | "NEEDS_REVIEW" | "ERROR";
  source: "Michigan MILARA";
  sourceUrl: string;
  checkedAt: string;
  credential: LicenseCandidate | null;
  candidates: LicenseCandidate[];
  rawFields: unknown;
  error: string | null;
  screenshotPath?: string;
  recordingId?: string;
};
export interface CredentialProvider {
  verify(
    employee: {
      firstName: string;
      lastName: string;
      id?: string;
    },
    recorder?: VerificationRecorder,
  ): Promise<CredentialVerificationResult>;
}
