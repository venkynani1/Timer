"use client";

import { motion } from "framer-motion";
import type { MissionView } from "@/hooks/use-mission";
import type { StageAlert } from "./stage-alerts";
import { StageBanner } from "./stage-alerts";
import { Backdrop } from "./backdrop";
import { BrandLockup } from "./brand";
import { Countdown } from "./countdown";
import { EnergyRing } from "./energy-ring";
import { LiveStatus, ConnectionDot } from "./status";
import { PhasePanel, NextMilestonePanel, ProgressStats, MilestoneTrack, StatBlock } from "./panels";
import { AnnouncementBar } from "./announcement-bar";
import { FinalMinute } from "./final-minute";
import { formatClockTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CinematicView({ m, alert }: { m: MissionView; alert: StageAlert | null }) {
  const { bundle, snapshot } = m;
  if (!bundle || !snapshot) return null;
  const { clock, event } = bundle;
  const stage = snapshot.stage;
  const finalCountdown = stage === "final-countdown";
  const finalMinute = stage === "final-minute" || stage === "final-seconds";

  return (
    <div
      className="relative grid h-[100dvh] w-full grid-rows-[auto_1fr_auto] overflow-hidden px-[3vw] pb-[2.2vh] pt-[2.6vh]"
      style={{ ["--ring" as string]: finalCountdown ? "min(80vh, 56vw)" : "min(74vh, 50vw)" }}
    >
      <Backdrop intensity={finalMinute ? "calm" : "full"} />

      {/* Header */}
      <header className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-start gap-6">
        <div>
          <BrandLockup name={event.name} subtitle={event.subtitle} />
        </div>
        <StageBanner alert={alert} className="min-w-[30vw]" />
        <div className="flex flex-col items-end gap-2">
          <LiveStatus snapshot={snapshot} />
          <div className="flex items-center gap-4">
            <span className="font-tech text-xs tracking-[0.25em] text-sky-100/50">
              FINISH <span className="text-sky-50 tabular">{formatClockTime(clock.endsAt ?? null)}</span>
            </span>
            <ConnectionDot status={m.status} />
          </div>
        </div>
      </header>

      {/* Main */}
      {finalMinute ? (
        <FinalMinute snapshot={snapshot} />
      ) : (
        <main className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-[2.5vw]">
          <motion.div
            className={cn("flex flex-col gap-[5vh] transition-opacity duration-1000", finalCountdown && "opacity-60")}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.1, delay: 0.2 }}
          >
            <PhasePanel snapshot={snapshot} />
            <div className="hairline w-3/4 opacity-50" />
            <ProgressStats snapshot={snapshot} />
          </motion.div>

          <div className="relative aspect-square transition-[width] duration-1000" style={{ width: "var(--ring)" }}>
            <EnergyRing
              progress={snapshot.state === "NOT_STARTED" ? 0 : snapshot.progress}
              milestones={bundle.milestones}
              durationSeconds={clock.durationSeconds}
              pulse={finalCountdown}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="eyebrow mb-[2.5%] text-[calc(var(--ring)*0.018)]">
                {snapshot.state === "NOT_STARTED" ? "Mission duration" : snapshot.state === "EMERGENCY_OVERRIDE" ? "Clock on hold" : "Time remaining"}
              </div>
              <Countdown
                seconds={snapshot.remainingSeconds}
                className={cn("glow-text text-white transition-[font-size] duration-1000", finalCountdown && "text-[hsl(0_100%_92%)]")}
                dimLeadingZeros={finalCountdown}
                // Font size scales with the ring, so the countdown is always the hero.
                style={{ fontSize: `calc(var(--ring) * ${finalCountdown ? 0.185 : 0.165})` }}
              />
              <div className="mt-[3%] flex items-center gap-3 font-tech text-[calc(var(--ring)*0.02)] font-semibold tracking-[0.3em] text-sky-100/60">
                <span className="text-energy">{formatPercent(snapshot.progress)}%</span>
                <span className="h-1 w-1 rounded-full bg-sky-200/40" />
                <span>{snapshot.state === "NOT_STARTED" ? "STANDING BY" : snapshot.state === "EMERGENCY_OVERRIDE" ? "ON HOLD" : "COMPLETE"}</span>
              </div>
            </div>
          </div>

          <motion.div
            className={cn("flex flex-col items-end gap-[5vh] text-right transition-opacity duration-1000", finalCountdown && "opacity-60")}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.1, delay: 0.3 }}
          >
            <NextMilestonePanel snapshot={snapshot} clock={clock} className="items-end" />
            <div className="hairline w-3/4 opacity-50" />
            <StatBlock label="Official finish" value={formatClockTime(clock.endsAt, { seconds: true })} className="items-end" />
          </motion.div>
        </main>
      )}

      {/* Footer */}
      <footer className="relative z-10 flex flex-col gap-[1.6vh]">
        {!finalMinute && <MilestoneTrack milestones={bundle.milestones} snapshot={snapshot} />}
        <AnnouncementBar items={m.announcements} />
      </footer>
    </div>
  );
}
