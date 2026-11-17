import type { Metadata } from "next";
import { MissionScreen } from "@/components/mission/mission-screen";
import { NotConfigured } from "@/components/mission/not-configured";
import { readScreenParams, type SearchParams } from "@/lib/page-params";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Projector" };

export default async function ProjectorPage({ searchParams }: { searchParams: SearchParams }) {
  const { slug, simulation, mode } = await readScreenParams(searchParams);
  const embedded = (await searchParams).embed === "1";
  if (!simulation && !isSupabaseConfigured()) return <NotConfigured />;
  return <MissionScreen slug={slug} forcedMode={mode} simulation={simulation} embedded={embedded} />;
}
