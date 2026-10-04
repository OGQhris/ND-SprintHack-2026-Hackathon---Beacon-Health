import type { ReactNode } from "react";
import { LastChecked } from "@/components/shared/last-checked";
import { DemoTag, LiveTag } from "@/components/shared/source-label";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/data/format";
import { SOURCE_META } from "@/lib/data/sources";
import type { Credential } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = { credential: Credential; today: string };

export function verificationStateLabel(credential: Credential): string {
  switch (credential.verificationState) {
    case "verified":
      return "Verified against source";
    case "needs_review":
      return "Awaiting manager review";
    case "verification_failed":
      return "Last check failed";
    default:
      return "Not yet verified";
  }
}

/**
 * The facts grid of the credential card. Every value is what the server holds: a fresh import shows
 * "Not on file" and "Never" rather than a guess, and a demo-seeded expiration is labelled as such.
 */
export function CredentialFacts({ credential, today }: Props) {
  const source = SOURCE_META[credential.source];
  const lastAttemptDiffers = !!credential.lastChecked && credential.lastChecked !== credential.lastVerifiedAt;
  const demoNote = credential.demoExpiration
    ? `Demo clock: the source's own expiration is ${
        credential.sourceExpirationDate ? formatDate(credential.sourceExpirationDate) : "not on file"
      }`
    : undefined;

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
      <Fact label="Credential type" value={credential.credentialType} />
      <Fact label="Credential number" value={credential.credentialNumber ?? "Not on file"} numeric />
      <Fact
        label="Source"
        value={
          <span className="inline-flex items-center gap-1.5">
            {source.label}
            {source.live ? <LiveTag /> : null}
          </span>
        }
        note={credential.sourceStatus ? `Source status: ${credential.sourceStatus}` : undefined}
      />
      <Fact
        label="Expiration date"
        numeric
        value={
          <span className="inline-flex items-center gap-1.5">
            {credential.expirationDate ? formatDate(credential.expirationDate) : "Not on file"}
            {credential.demoExpiration ? <DemoTag /> : null}
          </span>
        }
        note={demoNote}
      />
      {credential.issueDate ? <Fact label="Issue date" value={formatDate(credential.issueDate)} numeric /> : null}
      {credential.county ? <Fact label="County" value={credential.county} /> : null}
      <Fact label="Last verified" value={<LastChecked iso={credential.lastVerifiedAt} today={today} />} />
      {lastAttemptDiffers ? (
        <Fact label="Last attempt" value={<LastChecked iso={credential.lastChecked} today={today} />} />
      ) : null}
      <Fact
        label="Verification state"
        value={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {verificationStateLabel(credential)}
            {credential.inFlight ? (
              <span className="inline-flex items-center gap-1 text-seal-strong">
                <Spinner className="size-3.5 text-seal" />
                Checking now
              </span>
            ) : null}
          </span>
        }
      />
    </dl>
  );
}

function Fact({ label, value, note, numeric }: { label: string; value: ReactNode; note?: string; numeric?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className={cn("text-sm font-medium text-ink", numeric && "numeric")}>
        {value}
        {note ? <span className="mt-0.5 block text-xs font-normal text-ink-faint">{note}</span> : null}
      </dd>
    </div>
  );
}
