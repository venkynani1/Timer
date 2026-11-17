"use client";

import { useMission } from "@/hooks/use-mission";
import type { SimulationConfig } from "@/lib/timer/simulation";
import { Backdrop } from "./backdrop";
import { BrandLockup } from "./brand";
import { Countdown } from "./countdown";
import { EnergyRing } from "./energy-ring";
import { LiveStatus, ConnectionDot } from "./status";
import { MilestoneIcon } from "./milestone-icon";
import { AnnouncementBar } from "./announcement-bar";
import { useStageAlerts, StageBanner } from "./stage-alerts";
import { SystemScreen } from "./system-screen";
import { formatClockTime, formatCompact, formatDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Public, read-only, mobile-first timer for participants (QR code target). */
export function ParticipantView({ slug, simulation }: { slug: string; simulation: SimulationConfig | null }) {
  const m = useMission(slug, simulation);
  const alert = useStageAlerts(m.snapshot);
  const { bundle, snapshot } = m;
  if (!bundle || !snapshot) {
    return <SystemScreen title={m.error ? "Timer unavailable" : "Connecting"} detail={m.error ?? "Synchronising with mission control…"} pending={!m.error} />;
  }
  const { clock, event } = bundle;
  const complete = snapshot.state === "COMPLETED";
  const urgent = ["final-countdown", "final-minute", "final-seconds"].includes(snapshot.stage);
  const latest = m.announcements[0] ?? null;

  return (
    <div data-phase={snapshot.phase} className="relative min-h-[100dvh] bg-[#020611]">
      <Backdrop intensity="calm" />
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col gap-5 px-5 pb-8 pt-6 sm:max-w-2xl">
        <header className="flex items-center justify-between">
          <BrandLockup name={event.name} subtitle={event.subtitle} compact />
          <ConnectionDot status={m.status} />
        </header>

        <StageBanner alert={alert} />

        <section className="glass relative overflow-hidden rounded-3xl px-4 pb-6 pt-5">
          <div className="flex items-center justify-between">
            <LiveStatus snapshot={snapshot} className="text-[0.65rem]" />
            <span className="font-tech text-[0.65rem] tracking-[0.25em] text-sky-100/60">{formatPercent(snapshot.progress)}%</span>
          </div>
          <div className="relative mx-auto mt-4 aspect-square w-[min(78vw,340px)]">
            <EnergyRing progress={snapshot.state === "NOT_STARTED" ? 0 : snapshot.progress} milestones={bundle.milestones} durationSeconds={clock.durationSeconds} showTicks={false} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {complete ? (
                <div className="text-center font-display text-xl font-bold tracking-[0.2em] text-white">MISSION<br />COMPLETE</div>
              ) : (
                <MilestoneIcon name={snapshot.currentMilestone?.icon ?? "orbit"} className="h-7 w-7 text-energy" />
              )}
            </div>
          </div>
          <Countdown
            seconds={snapshot.remainingSeconds}
            className={cn("glow-text mt-4 text-white", urgent && "text-red-100")}
            style={{ fontSize: "min(15vw, 4.75rem)" }}
          />
          <div className="mt-2 text-center font-tech text-[0.7rem] uppercase tracking-[0.3em] text-sky-100/50">
            {snapshot.state === "NOT_STARTED" ? "Awaiting launch" : complete ? "Time is up" : snapshot.state === "EMERGENCY_OVERRIDE" ? "Clock on hold" : "Time remaining"}
          </div>
        </section>

        {latest && <AnnouncementBar items={[latest]} size="sm" className="[&>div]:w-full" />}

        <section className="grid grid-cols-2 gap-3">
          <div className="glass rounded-2xl p-4">
            <div className="eyebrow text-[0.6rem]">Current phase</div>
            <div className="mt-2 font-display text-sm font-bold tracking-[0.12em] text-white">{snapshot.currentMilestone?.title ?? "PRE-LAUNCH"}</div>
            <p className="mt-1 text-xs leading-relaxed text-sky-100/60">{snapshot.currentMilestone?.description ?? "Standing by for launch."}</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="eyebrow text-[0.6rem]">Next milestone</div>
            <div className="mt-2 font-display text-sm font-bold tracking-[0.12em] text-white">{snapshot.nextMilestone?.title ?? "—"}</div>
            {snapshot.msToNextMilestone !== null && (
              <p className="mt-1 font-tech text-xs tracking-[0.1em] text-energy tabular">in {formatCompact(snapshot.msToNextMilestone)}</p>
            )}
          </div>
        </section>

        <section className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-[0.6rem]">Overall progress</span>
            <span className="font-tech text-xs text-sky-100/70 tabular">{formatPercent(snapshot.progress)}%</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sky-300/10">
            <div className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--e1))] to-[hsl(var(--e2))] transition-[width] duration-1000 ease-linear" style={{ width: `${snapshot.progress * 100}%` }} />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="eyebrow text-[0.6rem]">Official finish</span>
            <span className="font-tech tracking-[0.1em] text-sky-50 tabular">{clock.endsAt ? formatDateTime(clock.endsAt) : `${formatClockTime(null)} · set at launch`}</span>
          </div>
        </section>

        {complete && (
          <p className="text-center font-display text-sm font-semibold leading-relaxed tracking-[0.14em] text-sky-50">{clock.closingMessage}</p>
        )}
        {m.simulated && <p className="text-center font-tech text-[0.65rem] uppercase tracking-[0.3em] text-amber-300">Developer simulation — not the official clock</p>}
        <footer className="mt-auto text-center font-tech text-[0.6rem] uppercase tracking-[0.3em] text-sky-100/35">{event.tagline}</footer>
      </div>
    </div>
  );
}
