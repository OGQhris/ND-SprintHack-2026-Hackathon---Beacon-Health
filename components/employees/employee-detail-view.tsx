"use client";

import Link from "next/link";
import { UserXIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CredentialSummary } from "@/components/employees/credential-summary";
import { EmployeeHeader } from "@/components/employees/employee-header";
import { VerificationHistory } from "@/components/employees/verification-history";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { VerifyPanelControls } from "@/components/verify/verify-panel";
import {
  STAGES,
  useVerifyCredential,
} from "@/components/verify/use-verify-credential";
import {
  getRowForEmployee,
  getVerificationHistory,
} from "@/lib/data/selectors";
import { useStoreState } from "@/lib/store/credential-store";

type Props = { id: string; autoVerify?: boolean };

export function EmployeeDetailView({ id, autoVerify }: Props) {
  const state = useStoreState();
  const row = useMemo(() => getRowForEmployee(state, id), [state, id]);
  const history = useMemo(() => getVerificationHistory(state, id), [state, id]);
  const [highlightId, setHighlightId] = useState<string | undefined>();
  const verify = useVerifyCredential(id);
  const verificationProgress =
    verify.phase === "running"
      ? {
          stage: verify.stage,
          totalStages: STAGES.length,
          holding: verify.holding,
        }
      : null;
  const onRecord = useCallback(
    (recordId: string) => setHighlightId(recordId),
    [],
  );

  if (!row) {
    return (
      <EmptyState
        icon={UserXIcon}
        title="Employee not found"
        description="This person is not in the current credentialing list."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/employees">Back to employees</Link>
          </Button>
        }
      />
    );
  }

  const { employee, credential, derived } = row;

  return (
    <>
      <EmployeeHeader employee={employee} />
      <CredentialSummary
        credential={credential}
        derived={derived}
        today={state.today}
        verificationProgress={verificationProgress}
        verifySlot={
          <VerifyPanelControls
            verify={verify}
            cardEdgeProgress
            employeeId={employee.id}
            source={credential.source}
            sourceLink={credential.sourceUrl ?? state.sourceLinks[credential.source]}
            autoStart={autoVerify}
            onRecord={onRecord}
          />
        }
      />
      <VerificationHistory records={history} highlightId={highlightId} />
    </>
  );
}
