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
    days: 7,
  },
  { id: "sample-casey-reed", firstName: "Casey", lastName: "Reed", days: -3 },
  {
    id: "sample-sam-patel",
    firstName: "Sam",
    lastName: "Patel",
    days: 30,
    group: "US_TECHS",
  },
  {
    id: "sample-riley-chen",
    firstName: "Riley",
    lastName: "Chen",
    days: 14,
    group: "US_TECHS",
  },
  {
    id: "sample-jordan-lee",
    firstName: "Jordan",
    lastName: "Lee",
    days: 30,
    group: "RAD_TECHS",
  },
  {
    id: "sample-morgan-davis",
    firstName: "Morgan",
    lastName: "Davis",
    days: 14,
    group: "RAD_TECHS",
  },
] as const;

/** Explicitly seed/reset fictional records; normal reads never move their dates. */
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
        credentialType:
          "group" in sample
            ? sample.group === "US_TECHS"
              ? "Registered Diagnostic Medical Sonographer"
              : "Registered Technologist (R)"
            : "Registered Nurse",
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

/** Real source dates and audit history stay intact; successful verification removes the overlay. */
export async function resetDemoEmployees(today = todayDate()) {
  const samples = await seedSampleEmployees(today);
  await db.$transaction(async (tx) => {
    for (const target of [
      { firstName: "Kathryn", lastName: "Cell", days: 5 },
      { firstName: "Alexandria", lastName: "Truax", days: 6 },
    ]) {
      const matches = await tx.employee.findMany({
        where: {
          firstName: target.firstName,
          lastName: target.lastName,
          sourceSheet: "RNS",
        },
      });
      if (matches.length !== 1) continue;
      if (matches[0].verificationState === "VERIFYING")
        throw new Error(
          "Wait for the current verification to finish before resetting the demo.",
        );
      await tx.employee.update({
        where: { id: matches[0].id },
        data: {
          demoExpirationDate: addDaysISO(today, target.days),
          verificationState: "UNVERIFIED",
          verificationError: null,
        },
      });
    }
    // Reset manager actions so the reset demo warnings are visible again.
    const ids = [
      ...samples.map((e) => e.id),
      ...(
        await tx.employee.findMany({
          where: { demoExpirationDate: { not: null } },
          select: { id: true },
        })
      ).map((e) => e.id),
    ];
    await tx.alertAction.deleteMany({ where: { employeeId: { in: ids } } });
  });
  return samples;
}
