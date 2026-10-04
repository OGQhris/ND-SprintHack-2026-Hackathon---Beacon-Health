import type { Metadata } from "next";
import { AskPageView } from "@/components/ask-beacon/ask-page-view";

export const metadata: Metadata = { title: "Ask Beacon" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AskPage({ searchParams }: Props) {
  const sp = await searchParams;
  const t = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  return <AskPageView threadId={t} />;
}
