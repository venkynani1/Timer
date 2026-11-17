import type { Announcement, Milestone, MissionClock, TimerState } from "./types";

/**
 * Pure timing maths. Everything here derives from the authoritative row plus an
 * estimate of the *server's* current time. No local counters, so nothing drifts.
 */

export type EnergyPhase = "charged" | "flux" | "amber" | "ember" | "critical" | "complete" | "standby" | "hold";

/** Experience stage, used for final-hour presentation changes. */
export type Stage =
  | "standby" // not started
  | "mission" // > 60 min remaining
  | "final-hour" // <= 60 min
  | "final-countdown" // <= 10 min
  | "final-minute" // <= 60 s
  | "final-seconds" // <= 10 s
  | "complete"
  | "hold";

export interface Snapshot {
  state: TimerState;
  durationMs: number;
  remainingMs: number; // never negative
  elapsedMs: number; // never > duration
  /** 0..1 portion of the mission completed. */
  progress: number;
  /** Whole seconds remaining, ceiling-rounded so 00:00:00 appears exactly at the deadline. */
  remainingSeconds: number;
  phase: EnergyPhase;
  stage: Stage;
  currentMilestone: Milestone | null;
  nextMilestone: Milestone | null;
  /** ms until the next milestone fires (null if none). */
  msToNextMilestone: number | null;
}

export const HOUR = 3_600_000;
export const MINUTE = 60_000;

export function effectiveState(clock: MissionClock, serverNow: number): TimerState {
  if (clock.state === "RUNNING" && clock.endsAt !== null && serverNow >= clock.endsAt) return "COMPLETED";
  return clock.state;
}

export function remainingMs(clock: MissionClock, serverNow: number): number {
  const durationMs = clock.durationSeconds * 1000;
  switch (effectiveState(clock, serverNow)) {
    case "NOT_STARTED":
      return durationMs;
    case "COMPLETED":
      return 0;
    case "EMERGENCY_OVERRIDE":
      return Math.max(0, clock.heldRemainingMs ?? 0);
    case "RUNNING":
      return Math.max(0, Math.min(durationMs * 4, (clock.endsAt ?? serverNow) - serverNow));
  }
}

export function energyPhase(state: TimerState, remaining: number): EnergyPhase {
  if (state === "NOT_STARTED") return "standby";
  if (state === "COMPLETED" || remaining <= 0) return "complete";
  if (state === "EMERGENCY_OVERRIDE") return "hold";
  if (remaining <= 10 * MINUTE) return "critical";
  if (remaining <= 1 * HOUR) return "ember";
  if (remaining <= 3 * HOUR) return "amber";
  if (remaining <= 6 * HOUR) return "flux";
  return "charged";
}

export function stageFor(state: TimerState, remaining: number): Stage {
  if (state === "NOT_STARTED") return "standby";
  if (state === "COMPLETED" || remaining <= 0) return "complete";
  if (state === "EMERGENCY_OVERRIDE") return "hold";
  if (remaining <= 10_000) return "final-seconds";
  if (remaining <= MINUTE) return "final-minute";
  if (remaining <= 10 * MINUTE) return "final-countdown";
  if (remaining <= HOUR) return "final-hour";
  return "mission";
}

export function sortedMilestones(list: Milestone[]): Milestone[] {
  return list.filter((m) => m.enabled).sort((a, b) => a.offsetSeconds - b.offsetSeconds);
}

/**
 * Milestones are offsets from the official start. They never touch the master
 * clock; they're derived from elapsed time only.
 */
export function milestonePosition(milestones: Milestone[], elapsed: number, started: boolean) {
  const list = sortedMilestones(milestones);
  let current: Milestone | null = null;
  let next: Milestone | null = null;
  for (const m of list) {
    if (started && m.offsetSeconds * 1000 <= elapsed) current = m;
    else {
      next = m;
      break;
    }
  }
  return { current, next };
}

export function computeSnapshot(clock: MissionClock, serverNow: number, milestones: Milestone[] = []): Snapshot {
  const state = effectiveState(clock, serverNow);
  const durationMs = clock.durationSeconds * 1000;
  const remaining = remainingMs(clock, serverNow);
  // Elapsed is measured against the (possibly adjusted) deadline so milestones stay aligned with time-left.
  const elapsed = state === "NOT_STARTED" ? 0 : Math.min(durationMs, Math.max(0, durationMs - remaining));
  const started = state !== "NOT_STARTED";
  const { current, next } = milestonePosition(milestones, elapsed, started);
  return {
    state,
    durationMs,
    remainingMs: remaining,
    elapsedMs: elapsed,
    progress: durationMs === 0 ? 1 : elapsed / durationMs,
    remainingSeconds: Math.ceil(remaining / 1000),
    phase: energyPhase(state, remaining),
    stage: stageFor(state, remaining),
    currentMilestone: current,
    nextMilestone: next,
    msToNextMilestone: next && started ? Math.max(0, next.offsetSeconds * 1000 - elapsed) : null,
  };
}

/** HH, MM, SS strings (hours may exceed 2 digits for >99h configs, but are padded to 2). */
export function splitTime(totalSeconds: number): [string, string, string] {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [String(h).padStart(2, "0"), String(m).padStart(2, "0"), String(sec).padStart(2, "0")];
}

export function formatDuration(ms: number): string {
  return splitTime(Math.ceil(Math.max(0, ms) / 1000)).join(":");
}

export function formatOffset(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Announcements visible "now": published, not expired/cancelled, within display window. */
export function activeAnnouncements(list: Announcement[], serverNow: number): Announcement[] {
  return list
    .filter((a) => {
      if (a.cancelledAt !== null) return false;
      if (a.publishAt > serverNow) return false;
      const until = a.expiresAt ?? a.publishAt + a.displaySeconds * 1000;
      return serverNow < until;
    })
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || b.publishAt - a.publishAt);
}

export function upcomingAnnouncements(list: Announcement[], serverNow: number): Announcement[] {
  return list.filter((a) => a.cancelledAt === null && a.publishAt > serverNow).sort((a, b) => a.publishAt - b.publishAt);
}

function priorityRank(p: Announcement["priority"]): number {
  return { info: 0, normal: 1, high: 2, critical: 3 }[p];
}

/** Delay until the displayed whole-second value next changes. Used to align ticks. */
export function msUntilNextSecond(remaining: number): number {
  if (remaining <= 0) return 1000;
  const r = remaining % 1000;
  return r === 0 ? 1000 : r;
}
