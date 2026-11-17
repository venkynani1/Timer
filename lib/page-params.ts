import { isSimulationAllowed, parseSimulation, type SimulationConfig } from "@/lib/timer/simulation";
import { resolveSlug } from "@/lib/env";
import type { DisplayMode } from "@/lib/timer/types";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function readScreenParams(searchParams: SearchParams) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") params.set(k, v);
  const allowed = isSimulationAllowed({ NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_ALLOW_SIMULATION: process.env.NEXT_PUBLIC_ALLOW_SIMULATION });
  const simulation: SimulationConfig | null = parseSimulation(params, allowed);
  const modeRaw = params.get("mode");
  const mode: DisplayMode | null = modeRaw === "cinematic" || modeRaw === "minimal" || modeRaw === "command" ? modeRaw : null;
  return { slug: resolveSlug(params.get("event")), simulation, mode };
}
