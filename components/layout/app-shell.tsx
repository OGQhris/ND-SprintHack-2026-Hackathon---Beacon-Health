"use client";

import type { CSSProperties, ReactNode } from "react";
import { AskBeaconDock } from "@/components/ask-beacon/ask-beacon-dock";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { VerificationViewer } from "@/components/verification/verification-viewer";
import { BatchBanner } from "@/components/workspace/batch-banner";

const SHELL_VARS = { "--sidebar-width": "15rem" } as CSSProperties;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider style={SHELL_VARS}>
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-folder">
        <TopNav />
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 md:px-6">
          <BatchBanner />
          {children}
        </main>
      </SidebarInset>
      <AskBeaconDock />
      <VerificationViewer />
    </SidebarProvider>
  );
}
