"use client";

import type { MissionView } from "@/hooks/use-mission";
import { Backdrop } from "./backdrop";
import { BrandLockup } from "./brand";
import { Countdown } from "./countdown";
import { EnergyRing } from "./energy-ring";
import { LiveStatus, ConnectionDot } from "./status";
import { MilestoneIcon } from "./milestone-icon";
import { AnnouncementBar } from "./announcement-bar";
import { formatClockTime, formatDateTime, formatPercent, formatCompact } from "@/lib/format";
import { formatDuration, sortedMilestones, upcomingAnnouncements } from "@/lib/timer/engine";
import { cn } from "@/lib/utils";

/** Host-facing operations layout: timer + schedule + broadcast queue + health. */
export function CommandView({ m }: { m: MissionView }) {
  const { bundle, snapshot } = m;
  if (!bundle || !snapshot) return null;
  const { clock, event } = bundle;
  const ms = sortedMilestones(bundle.milestones);
  const upcoming = upcomingAnnouncements(bundle.announcements, m.serverNow).slice(0, 4);
  const at = (offset: number) => (clock.endsAt !== null ? clock.endsAt - (snapshot.durationMs - offset * 1000) : null);

  return (
    <div className="relative grid min-h-[100dvh] grid-rows-[auto_1fr_auto] gap-[2.5vh] px-[2.5vw] py-[2.5vh]">
      <Backdrop intensity="calm" />
      <header className="relative z-10 flex items-center justify-between">
        <BrandLockup name={event.name} subtitle={`${event.subtitle} · COMMAND`} />
        <div className="flex items-center gap-6">
          <ConnectionDot status={m.status} />
          <LiveStatus snapshot={snapshot} />
        </div>
      </header>

      <main className="relative z-10 grid grid-cols-[1.35fr_1fr] gap-[2vw]">
        <section className="glass flex flex-col justify-between rounded-2xl p-[2.2vw]">
          <div className="flex flex-1 items-center gap-[2.5vw]">
            <div className="relative aspect-square w-[min(24vw,46vh)] shrink-0">
              <EnergyRing progress={snapshot.state === "NOT_STARTED" ? 0 : snapshot.progress} milestones={bundle.milestones} durationSeconds={clock.durationSeconds} showTicks={false} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-display text-[min(3vw,5.5vh)] font-bold tabular text-white">{formatPercent(snapshot.progress)}%</div>
                <div className="eyebrow mt-1 text-[0.6rem]">complete</div>
              </div>
            </div>
            <div className="min-w-0">
              <div className="eyebrow">Time remaining</div>
              <Countdown seconds={snapshot.remainingSeconds} className="glow-text mt-3 justify-start text-white" style={{ fontSize: "min(6.6vw, 13vh)" }} />
              <div className="mt-6 flex items-center gap-3">
                <MilestoneIcon name={snapshot.currentMilestone?.icon ?? "orbit"} className="h-5 w-5 text-energy" />
                <span className="font-display text-[clamp(0.9rem,1.4vw,1.6rem)] font-semibold tracking-[0.14em] text-sky-50">{snapshot.currentMilestone?.title ?? "PRE-LAUNCH"}</span>
                <span className="text-sm text-sky-100/55">{snapshot.currentMilestone?.description}</span>
              </div>
            </div>
          </div>
          <div className="mt-[3vh] grid grid-cols-4 gap-4">
            {[
              ["Official start", formatClockTime(clock.startedAt, { seconds: true })],
              ["Official finish", formatClockTime(clock.endsAt, { seconds: true })],
              ["Elapsed", formatDuration(snapshot.elapsedMs)],
              ["Complete", `${formatPercent(snapshot.progress)}%`],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="eyebrow text-[0.6rem]">{l}</div>
                <div className="mt-1 font-display text-[clamp(0.9rem,1.4vw,1.6rem)] font-semibold tabular text-sky-50">{v}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-[2vh]">
          <div className="glass flex-1 rounded-2xl p-[1.6vw]">
            <div className="eyebrow mb-3">Mission schedule</div>
            <ol className="flex flex-col gap-1.5">
              {ms.map((x) => {
                const current = snapshot.currentMilestone?.id === x.id;
                const passed = snapshot.state !== "NOT_STARTED" && x.offsetSeconds * 1000 <= snapshot.elapsedMs && !current;
                return (
                  <li
                    key={x.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                      current ? "bg-[hsl(var(--e1)/0.12)] ring-1 ring-[hsl(var(--e1)/0.4)]" : passed ? "opacity-45" : "",
                    )}
                  >
                    <MilestoneIcon name={x.icon} className="h-4 w-4 text-energy" />
                    <span className="w-16 font-tech text-sm tabular text-sky-100/60">{formatClockTime(at(x.offsetSeconds))}</span>
                    <span className="flex-1 font-display text-sm font-semibold tracking-[0.14em] text-sky-50">{x.title}</span>
                    {current && <span className="font-tech text-[0.6rem] tracking-[0.25em] text-energy">NOW</span>}
                    {snapshot.nextMilestone?.id === x.id && snapshot.msToNextMilestone !== null && (
                      <span className="font-tech text-xs tabular text-sky-100/70">in {formatCompact(snapshot.msToNextMilestone)}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="glass rounded-2xl p-[1.6vw]">
            <div className="eyebrow mb-3">Broadcast queue</div>
            {upcoming.length === 0 ? (
              <div className="text-sm text-sky-100/50">No scheduled announcements.</div>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="font-tech tabular text-sky-100/60">{formatClockTime(a.publishAt)}</span>
                    <span className="truncate text-sky-50">{a.message}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-tech text-[0.65rem] uppercase tracking-[0.2em] text-sky-100/45">
              <span>Clock sync rtt {m.health?.rtt !== null && m.health?.rtt !== undefined ? `${Math.round(m.health.rtt)}ms` : "—"}</span>
              <span>Device skew {m.health?.deviceSkew !== null && m.health?.deviceSkew !== undefined ? `${(m.health.deviceSkew / 1000).toFixed(1)}s` : "—"}</span>
              <span>State v{clock.version}</span>
              {clock.endsAt && <span>Deadline {formatDateTime(clock.endsAt)}</span>}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10">
        <AnnouncementBar items={m.announcements} />
      </footer>
    </div>
  );
}
