"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Snapshot } from "@/lib/timer/engine";
import { formatOffset, sortedMilestones } from "@/lib/timer/engine";
import type { Milestone, MissionClock } from "@/lib/timer/types";
import { formatClockTime, formatCompact, formatPercent } from "@/lib/format";
import { MilestoneIcon } from "./milestone-icon";
import { cn } from "@/lib/utils";

export function PhasePanel({ snapshot, className }: { snapshot: Snapshot; className?: string }) {
  const m = snapshot.currentMilestone;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="eyebrow">Current phase</div>
      <AnimatePresence mode="wait">
        <motion.div
          key={m?.id ?? "standby"}
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 14 }}
          transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[hsl(var(--e1)/0.35)] bg-[hsl(var(--e1)/0.08)]">
              <MilestoneIcon name={m?.icon ?? "orbit"} className="h-6 w-6 text-energy" />
            </span>
            <div className="font-display text-[clamp(1.1rem,1.9vw,2.2rem)] font-bold tracking-[0.12em] text-white">
              {m?.title ?? "PRE-LAUNCH"}
            </div>
          </div>
          <p className="max-w-[26ch] text-[clamp(0.85rem,1.05vw,1.2rem)] leading-relaxed text-sky-100/65">
            {m?.description ?? "All systems standing by for mission launch."}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function NextMilestonePanel({ snapshot, clock, className }: { snapshot: Snapshot; clock: MissionClock; className?: string }) {
  const n = snapshot.nextMilestone;
  const at = n && clock.endsAt !== null ? clock.endsAt - (snapshot.durationMs - n.offsetSeconds * 1000) : null;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="eyebrow">Next milestone</div>
      {n ? (
        <AnimatePresence mode="wait">
          <motion.div key={n.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }}>
            <div className="flex items-center gap-3">
              <MilestoneIcon name={n.icon} className="h-5 w-5 text-sky-200/70" />
              <span className="font-display text-[clamp(1rem,1.5vw,1.75rem)] font-semibold tracking-[0.12em] text-sky-50">{n.title}</span>
            </div>
            <div className="mt-2 font-tech text-[clamp(0.85rem,1.05vw,1.2rem)] tracking-[0.12em] text-sky-100/60">
              {snapshot.msToNextMilestone !== null ? (
                <>IN <span className="text-energy tabular">{formatCompact(snapshot.msToNextMilestone)}</span> · {formatClockTime(at)}</>
              ) : (
                <>AT T+{formatOffset(n.offsetSeconds)}</>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="font-display text-lg tracking-[0.12em] text-sky-100/60">—</div>
      )}
    </div>
  );
}

export function StatBlock({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="eyebrow">{label}</div>
      <div className="font-display text-[clamp(1rem,1.6vw,1.9rem)] font-semibold tracking-[0.08em] text-sky-50 tabular">{value}</div>
    </div>
  );
}

export function ProgressStats({ snapshot, className }: { snapshot: Snapshot; className?: string }) {
  const e = Math.floor(snapshot.elapsedMs / 1000);
  const eh = String(Math.floor(e / 3600)).padStart(2, "0");
  const em = String(Math.floor((e % 3600) / 60)).padStart(2, "0");
  const es = String(e % 60).padStart(2, "0");
  return (
    <div className={cn("flex gap-10", className)}>
      <StatBlock label="Elapsed" value={`${eh}:${em}:${es}`} />
      <StatBlock label="Complete" value={<>{formatPercent(snapshot.progress)}<span className="text-[0.6em] text-sky-200/60">%</span></>} />
    </div>
  );
}

/** Horizontal mission timeline with phase markers. */
export function MilestoneTrack({ milestones, snapshot, className }: { milestones: Milestone[]; snapshot: Snapshot; className?: string }) {
  const list = sortedMilestones(milestones);
  const p = snapshot.progress;
  // Stagger labels onto a second line when neighbours are too close to fit side by side.
  const rows: number[] = [];
  list.forEach((m, i) => {
    const gap = i === 0 ? 1 : (m.offsetSeconds - list[i - 1].offsetSeconds) * 1000 / snapshot.durationMs;
    rows.push(i > 0 && gap < 0.1 && rows[i - 1] === 0 ? 1 : 0);
  });
  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative h-[3px] w-full rounded-full bg-sky-300/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[hsl(var(--e1))] to-[hsl(var(--e2))] shadow-[0_0_12px_hsl(var(--e-glow)/0.7)] transition-[width] duration-1000 ease-linear"
          style={{ width: `${p * 100}%` }}
        />
      </div>
      <div className="relative mt-0 h-[3.6rem]">
        {list.map((m, i) => {
          const t = Math.min(1, m.offsetSeconds * 1000 / snapshot.durationMs);
          const lowered = rows[i] === 1;
          const edge = i === 0 && t < 0.04 ? "start" : i === list.length - 1 && t > 0.96 ? "end" : null;
          const passed = snapshot.state !== "NOT_STARTED" && t <= p;
          const current = snapshot.currentMilestone?.id === m.id;
          return (
            <div
              key={m.id}
              className={cn(
                "absolute top-0 flex flex-col",
                edge === "start" ? "items-start" : edge === "end" ? "-translate-x-full items-end" : "-translate-x-1/2 items-center",
              )}
              style={{ left: `${t * 100}%` }}
            >
              <span
                className={cn(
                  edge === "start" ? "-ml-[5px]" : edge === "end" ? "-mr-[5px]" : "",
                  "-mt-[7px] h-[11px] w-[11px] rotate-45 border-2 transition-colors duration-700",
                  current ? "border-white bg-[hsl(var(--e1))] shadow-[0_0_14px_hsl(var(--e-glow))]" : passed ? "border-sky-300/40 bg-sky-300/40" : "border-sky-300/40 bg-midnight-950",
                )}
              />
              <span
                className={cn(
                  lowered ? "mt-7" : "mt-2",
                  "whitespace-nowrap font-tech text-[clamp(0.55rem,0.68vw,0.8rem)] font-semibold uppercase tracking-[0.2em]",
                  current ? "text-white" : passed ? "text-sky-200/40" : "text-sky-200/65",
                )}
              >
                {m.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
