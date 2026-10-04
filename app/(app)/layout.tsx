import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorState } from "@/components/shared/error-state";
import { loadWorkspace } from "@/lib/data/repository";
import { CredentialStoreProvider } from "@/lib/store/credential-store";
import type { WorkspacePayload } from "@/lib/types";

// Read per request: the snapshot reflects the live database and any running roster check.
export const dynamic = "force-dynamic";

type Failure = { title: string; description: string; details?: string[] };
type LoadResult = { workspace: WorkspacePayload } | { failure: Failure };

async function load(): Promise<LoadResult> {
  try {
    return { workspace: await loadWorkspace() };
  } catch (error) {
    console.error("[Workspace]", error);
    return {
      failure: {
        title: "Employee data is unavailable",
        description: "The database is unavailable. Run npm run setup and reload.",
        details: [error instanceof Error ? error.message : String(error)],
      },
    };
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const result = await load();

  if ("failure" in result) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-2xl items-center px-6">
        <ErrorState {...result.failure} className="w-full" />
      </div>
    );
  }

  return (
    <CredentialStoreProvider workspace={result.workspace}>
      <AppShell>{children}</AppShell>
    </CredentialStoreProvider>
  );
}
