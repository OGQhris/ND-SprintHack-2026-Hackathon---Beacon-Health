"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRingIcon, LayoutDashboardIcon, MessageSquareTextIcon, UsersIcon } from "lucide-react";
import { useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getOpenAlertCount } from "@/lib/data/selectors";
import { useStoreState } from "@/lib/store/credential-store";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/employees", label: "Employees", icon: UsersIcon },
  { href: "/alerts", label: "Alerts", icon: BellRingIcon },
  { href: "/ask", label: "Ask Beacon", icon: MessageSquareTextIcon },
] as const;

const ITEM = "h-9 rounded-md px-3 data-active:shadow-[inset_2px_0_0_var(--seal)]";

export function AppSidebar() {
  const pathname = usePathname();
  const state = useStoreState();
  const openAlerts = useMemo(() => getOpenAlertCount(state), [state]);

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-rule">
      <SidebarHeader className="px-4 pt-5 pb-3">
        <Link
          href="/dashboard"
          aria-label="Beacon Health System credential monitoring"
          className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src="/branding/beacon-health-system.png"
            alt="Beacon Health System"
            width={290}
            height={200}
            priority
            className="h-11 w-auto shrink-0"
          />
          <span className="text-xs leading-tight font-medium text-ink-faint">Credential Monitoring</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} className={ITEM}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.href === "/alerts" && openAlerts > 0 ? (
                      <SidebarMenuBadge className="numeric rounded-md bg-status-expiring-bg px-1.5 text-[11px] font-semibold text-status-expiring-fg">
                        {openAlerts}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-1 border-t border-rule px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="h-12 rounded-md px-2" asChild>
              <div>
                <Avatar size="default">
                  <AvatarFallback className="bg-seal-tint text-xs font-semibold text-seal-strong">BM</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm font-medium text-ink">Beacon Manager</span>
                  <span className="truncate text-xs text-ink-faint">Nursing and Imaging</span>
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
