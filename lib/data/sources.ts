import type { CredentialSource, CredentialStatus, EmployeeGroup } from "@/lib/types";

export type SourceMeta = {
  label: string;
  shortLabel: string;
  live: boolean;
};

export type GroupMeta = {
  label: string;
  /** Beacon's own sheet names, for dense table cells. */
  shortLabel: string;
  role: string;
  credentialType: string;
  defaultSource: CredentialSource;
};

export const SOURCE_META: Record<CredentialSource, SourceMeta> = {
  RNS: { label: "Michigan RN License Lookup", shortLabel: "RNS", live: true },
  ARRT: { label: "ARRT Registry", shortLabel: "ARRT", live: false },
  ARDMS: { label: "ARDMS Verification", shortLabel: "ARDMS", live: false },
  NMTCB: { label: "NMTCB Verification", shortLabel: "NMTCB", live: false },
};

export const GROUP_META: Record<EmployeeGroup, GroupMeta> = {
  RNS: {
    label: "Registered Nurses",
    shortLabel: "RNs",
    role: "Registered Nurse",
    credentialType: "Registered Nurse",
    defaultSource: "RNS",
  },
  RAD_TECHS: {
    label: "Radiologic Technologists",
    shortLabel: "Rad techs",
    role: "Radiologic Technologist",
    credentialType: "Registered Technologist (R)",
    defaultSource: "ARRT",
  },
  US_TECHS: {
    label: "Ultrasound Technologists",
    shortLabel: "US techs",
    role: "Sonographer",
    credentialType: "Registered Diagnostic Medical Sonographer",
    defaultSource: "ARDMS",
  },
  NUC_MED_TECHS: {
    label: "Nuclear Medicine Technologists",
    shortLabel: "Nuc med techs",
    role: "Nuclear Medicine Technologist",
    credentialType: "Certified Nuclear Medicine Technologist",
    defaultSource: "NMTCB",
  },
};

export const GROUP_ORDER: EmployeeGroup[] = ["RNS", "RAD_TECHS", "US_TECHS", "NUC_MED_TECHS"];
export const SOURCE_ORDER: CredentialSource[] = ["RNS", "ARRT", "ARDMS", "NMTCB"];
export const STATUS_ORDER: CredentialStatus[] = [
  "expired",
  "expiring",
  "verification_failed",
  "needs_review",
  "active",
];
