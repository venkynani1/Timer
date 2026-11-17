"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useMission } from "@/hooks/use-mission";
import type { SimulationConfig } from "@/lib/timer/simulation";
import type { DisplayMode } from "@/lib/timer/types";
import { CinematicView } from "./cinematic-view";
import { MinimalView } from "./minimal-view";
import { CommandView } from "./command-view";
import { CompleteView } from "./complete-view";
import { LaunchSequence } from "./launch-sequence";
import { useStageAlerts } from "./stage-alerts";
import { ScreenControls, useFullscreen, useIdle } from "./screen-controls";
import { SystemScreen } from "./system-screen";
import { cn } from "@/lib/utils";

export function MissionScreen({
  slug,
  forcedMode,
  simulation,
  embedded = false,
}: {
  slug: string;
  forcedMode: DisplayMode | null;
  simulation: SimulationConfig | null;
  embedded?: boolean;
}) {
  const m = useMission(slug, simulation);
  const alert = useStageAlerts(m.snapshot);
  const idle = useIdle();
  const fullscreen = useFullscreen();
  const [localMode, setLocalMode] = useState<DisplayMode | null>(forcedMode);
  useEffect(() => setLocalMode(forcedMode), [forcedMode]);

  // The host chooses the default layout; a screen can pin its own with ?mode=.
  const mode: DisplayMode = localMode ?? m.bundle?.clock.displayMode ?? "cinematic";

  if (!m.bundle || !m.snapshot) {
    return <SystemScreen title={m.error ? "Mission link unavailable" : "Establishing mission link"} detail={m.error ?? "Synchronising with mission control…"} pending={!m.error} />;
  }

  const phase = m.snapshot.phase;
  const complete = m.snapshot.state === "COMPLETED";

  return (
    <div
      data-phase={phase}
      className={cn("relative min-h-[100dvh] w-full bg-[#020611]", idle && !embedded && "cursor-none", fullscreen.fallback && "fixed inset-0 z-[60]")}
    >
      {complete && mode !== "minimal" ? (
        <CompleteView m={m} compact={mode === "command"} />
      ) : mode === "minimal" ? (
        <MinimalView m={m} />
      ) : mode === "command" ? (
        <CommandView m={m} />
      ) : (
        <CinematicView m={m} alert={alert} />
      )}

      <AnimatePresence>{m.launchActive && <LaunchSequence key="launch" elapsedMs={m.launchElapsedMs} eventName={m.bundle.event.name} />}</AnimatePresence>

      {m.simulated && (
        <div className="fixed left-1/2 top-2 z-[70] -translate-x-1/2 rounded-full border border-amber-300/40 bg-amber-500/15 px-4 py-1 font-tech text-[0.65rem] font-bold uppercase tracking-[0.3em] text-amber-200">
          Developer simulation · {simulation?.speed}× · not the official clock
        </div>
      )}

      {!embedded && (
        <ScreenControls hidden={idle} soundAllowed={m.bundle.clock.soundEnabled} mode={mode} onMode={setLocalMode} fullscreen={fullscreen} />
      )}
    </div>
  );
}
