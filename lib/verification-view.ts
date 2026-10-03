export type VerificationStep = {
  index: number;
  label: string;
  kind: "navigate" | "type" | "click" | "read" | "result";
  timestamp: string;
  frameUrl?: string;
  target?: { x: number; y: number; width: number; height: number };
};
export type VerificationRun = {
  id: string;
  employeeId: string;
  origin?: "single" | "batch";
  employeeName: string;
  startedAt: string;
  finishedAt?: string;
  state: string;
  steps: VerificationStep[];
  result?: {
    licenseNumber: string | null;
    status: string | null;
    expirationDate: string | null;
  };
  error?: string | null;
};
