"use client";

import type { MissionView } from "@/hooks/use-mission";
import { Countdown } from "./countdown";
import { LiveStatus } from "./status";
import { AnnouncementBar } from "./announcement-bar";
import { formatClockTime, formatPercent } from "@/lib/format";

/** High-contrast, animation-free layout for small screens and low-power devices. */
export function MinimalView({ m }: { m: MissionView }) {
  const { bundle, snapshot } = m;
  if (!bundle || !snapshot) return null;
  const urgent = snapshot.stage === "final-countdown" || snapshot.stage === "final-minute" || snapshot.stage === "final-seconds";
  return (
    <div className="flex min-h-[100dvh] flex-col bg-black px-[4vw] py-[4vh] text-white" data-motion="off">
      <div className="flex items-center justify-between font-tech text-[clamp(0.8rem,1.4vw,1.4rem)] uppercase tracking-[0.3em]">
        <span className="font-display font-bold">{bundle.event.name} · {bundle.event.subtitle}</span>
        <LiveStatus snapshot={snapshot} />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="mb-[2vh] font-tech text-[clamp(1rem,2vw,2rem)] uppercase tracking-[0.4em] text-white/70">
          {snapshot.currentMilestone?.title ?? "Awaiting launch"}
        </div>
        <Countdown
          seconds={snapshot.remainingSeconds}
          animate={false}
          className={urgent ? "text-[#ff6b6b]" : "text-white"}
          style={{ fontSize: "min(17vw, 34vh)" }}
        />
      </div>
      <div className="flex flex-col gap-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
          <div className="h-full bg-white" style={{ width: `${snapshot.progress * 100}%` }} />
        </div>
        <div className="flex justify-between font-tech text-[clamp(0.8rem,1.3vw,1.3rem)] uppercase tracking-[0.25em] text-white/80">
          <span>{formatPercent(snapshot.progress)}% complete</span>
          <span>Next: {snapshot.nextMilestone?.title ?? "—"}</span>
          <span>Finish {formatClockTime(bundle.clock.endsAt)}</span>
        </div>
        <AnnouncementBar items={m.announcements} size="sm" />
      </div>
    </div>
  );
}
