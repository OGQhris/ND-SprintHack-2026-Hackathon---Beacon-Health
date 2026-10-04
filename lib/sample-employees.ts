import { db } from "./db";
import { todayDate } from "./expiration";
import { addDaysISO } from "./data/clock";

export const SAMPLE_SHEET = "Sample employees";
export const SAMPLE_EMPLOYEES = [
  {
    id: "sample-jamie-morgan",
    firstName: "Jamie",
    lastName: "Morgan",
    days: 30,
  },
  { id: "sample-alex-rivera", firstName: "Alex", lastName: "Rivera", days: 14 },
  {
    id: "sample-taylor-brooks",
    firstName: "Taylor",
    lastName: "Brooks",
    days: 17,
  },
  { id: "sample-casey-reed", firstName: "Casey", lastName: "Reed", days: -3 },
] as const;

/** Explicitly seed/reset only the four fictional records; normal reads never move their dates. */
export async function seedSampleEmployees(today = todayDate()) {
  return db.$transaction(
    SAMPLE_EMPLOYEES.map((sample, index) => {
      const data = {
        firstName: sample.firstName,
        lastName: sample.lastName,
        sourceSheet: SAMPLE_SHEET,
        sourceRow: index + 1,
        manager: "Sample Manager",
        credentialSource: "Sample data",
        credentialType: "Registered Nurse",
        credentialStatus: sample.days < 0 ? "Expired" : "Active",
        expirationDate: addDaysISO(today, sample.days),
        verificationState: "UNVERIFIED",
        verificationError: null,
        licenseNumber: null,
        lastVerifiedAt: null,
        lastAttemptAt: null,
      };
      return db.employee.upsert({
        where: { id: sample.id },
        create: { id: sample.id, ...data },
        update: data,
      });
    }),
  );
}
