"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AskBeaconDock } from "@/components/ask-beacon/ask-beacon-dock";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { VerificationViewer } from "@/components/verification/verification-viewer";
import { BatchBanner } from "@/components/workspace/batch-banner";

const SHELL_VARS = { "--sidebar-width": "15rem" } as CSSProperties;

export function AppShell({ children }: { children: ReactNode }) {
  const isAskPage = usePathname() === "/ask";
  return (
    <SidebarProvider style={{ ...SHELL_VARS, ...(isAskPage ? { height: "100dvh", minHeight: 0, overflow: "hidden" } : {}) }}>
      <AppSidebar />
      <SidebarInset className={cn("min-w-0 bg-folder", isAskPage && "min-h-0 overflow-hidden")}>
        <TopNav />
        <main className={cn("mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 md:px-6", isAskPage ? "min-h-0 max-w-none overflow-hidden" : "max-w-[1440px]")}>
          <BatchBanner className="shrink-0" />
          {children}
        </main>
      </SidebarInset>
      <AskBeaconDock />
      <VerificationViewer />
    </SidebarProvider>
  );
}
