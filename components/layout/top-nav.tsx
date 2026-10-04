"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellIcon, MessageSquareTextIcon } from "lucide-react";
import { useMemo } from "react";
import { useAskBeacon } from "@/components/ask-beacon/use-ask-beacon";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getOpenAlertCount } from "@/lib/data/selectors";
import { useStoreState } from "@/lib/store/credential-store";

const TITLES: { prefix: string; title: string }[] = [
  { prefix: "/dashboard", title: "Dashboard" },
  { prefix: "/employees/", title: "Employee" },
  { prefix: "/employees", title: "Employees" },
  { prefix: "/alerts", title: "Alerts" },
  { prefix: "/ask", title: "Ask Beacon" },
];

export function TopNav() {
  const pathname = usePathname();
  const state = useStoreState();
  const openAlerts = useMemo(() => getOpenAlertCount(state), [state]);
  const { dockOpen, setDockOpen } = useAskBeacon();

  const title = TITLES.find((t) => pathname.startsWith(t.prefix))?.title ?? "Credential Monitoring";

  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-rule bg-paper px-4 md:gap-4 md:px-6">
      <SidebarTrigger className="md:hidden" />
      <h2 className="text-sm font-medium text-ink">{title}</h2>

      <Button variant="outline" size="sm" className="ml-auto hidden bg-paper sm:inline-flex" onClick={() => setDockOpen(!dockOpen)} aria-pressed={dockOpen}>
        <MessageSquareTextIcon data-icon="inline-start" />
        Ask Beacon
      </Button>
      <Button asChild variant="outline" size="icon" className="ml-auto bg-paper sm:hidden" aria-label="Ask Beacon">
        <Link href="/ask">
          <MessageSquareTextIcon />
        </Link>
      </Button>


      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="relative text-ink-soft"
            aria-label={`${openAlerts} open alerts`}
          >
            <Link href="/alerts">
              <BellIcon />
              {openAlerts > 0 ? (
                <span className="numeric absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-expired-dot px-1 text-[10px] font-semibold text-white">
                  {openAlerts}
                </span>
              ) : null}
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{openAlerts === 0 ? "No open alerts" : `${openAlerts} open alerts`}</TooltipContent>
      </Tooltip>

      <ProfileMenu />
    </div>
  );
}
