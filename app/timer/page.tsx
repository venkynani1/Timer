import type { Metadata } from "next";
import { ParticipantView } from "@/components/mission/participant-view";
import { NotConfigured } from "@/components/mission/not-configured";
import { readScreenParams, type SearchParams } from "@/lib/page-params";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Mission Timer" };

export default async function TimerPage({ searchParams }: { searchParams: SearchParams }) {
  const { slug, simulation } = await readScreenParams(searchParams);
  if (!simulation && !isSupabaseConfigured()) return <NotConfigured />;
  return <ParticipantView slug={slug} simulation={simulation} />;
}
