import type { Metadata } from "next";
import { AlertsView, type AlertTab } from "@/components/alerts/alerts-view";

export const metadata: Metadata = { title: "Alerts" };

const TABS: AlertTab[] = ["all", "expired", "7", "14", "30", "issues"];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AlertsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = TABS.includes(raw as AlertTab) ? (raw as AlertTab) : "all";
  return <AlertsView initialTab={tab} />;
}
