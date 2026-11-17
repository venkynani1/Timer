import { describe, it, expect } from "vitest";
import {
  computeSnapshot,
  splitTime,
  formatDuration,
  activeAnnouncements,
  msUntilNextSecond,
  energyPhase,
  HOUR,
  MINUTE,
} from "@/lib/timer/engine";
import { DEFAULT_MILESTONES } from "@/lib/timer/defaults";
import { runningClock, T0, TWELVE_H } from "./helpers";
import type { Announcement } from "@/lib/timer/types";

describe("timer engine", () => {
  it("1. shows exactly 12:00:00 at launch and the ring is fully charged", () => {
    const s = computeSnapshot(runningClock(), T0, DEFAULT_MILESTONES);
    expect(s.remainingMs).toBe(TWELVE_H);
    expect(splitTime(s.remainingSeconds)).toEqual(["12", "00", "00"]);
    expect(s.progress).toBe(0);
    expect(s.phase).toBe("charged");
  });

  it("shows 11:59:59 one second after launch (ceil rounding, no early tick)", () => {
    expect(formatDuration(computeSnapshot(runningClock(), T0 + 1).remainingMs)).toBe("12:00:00");
    expect(formatDuration(computeSnapshot(runningClock(), T0 + 1000).remainingMs)).toBe("11:59:59");
  });

  it("7. reaches 00:00:00 exactly at 12 elapsed hours and reports completion", () => {
    const before = computeSnapshot(runningClock(), T0 + TWELVE_H - 1);
    expect(formatDuration(before.remainingMs)).toBe("00:00:01");
    expect(before.state).toBe("RUNNING");
    const at = computeSnapshot(runningClock(), T0 + TWELVE_H);
    expect(formatDuration(at.remainingMs)).toBe("00:00:00");
    expect(at.state).toBe("COMPLETED");
    expect(at.progress).toBe(1);
    expect(at.stage).toBe("complete");
  });

  it("8. never becomes negative, however far past the deadline", () => {
    for (const late of [1, 999, 1000, 60_000, HOUR, 10 * 24 * HOUR]) {
      const s = computeSnapshot(runningClock(), T0 + TWELVE_H + late);
      expect(s.remainingMs).toBe(0);
      expect(s.remainingSeconds).toBe(0);
      expect(splitTime(s.remainingSeconds)).toEqual(["00", "00", "00"]);
    }
  });

  it("is not affected by a stored COMPLETED clock or a NOT_STARTED clock", () => {
    const c = computeSnapshot(runningClock({ state: "COMPLETED" }), T0 + 5);
    expect(c.remainingMs).toBe(0);
    const n = computeSnapshot(runningClock({ state: "NOT_STARTED", startedAt: null, endsAt: null }), T0, DEFAULT_MILESTONES);
    expect(n.remainingMs).toBe(TWELVE_H);
    expect(n.stage).toBe("standby");
    expect(n.currentMilestone).toBeNull();
    expect(n.nextMilestone?.title).toBe("IGNITION");
  });

  it("freezes during an emergency hold", () => {
    const c = runningClock({ state: "EMERGENCY_OVERRIDE", heldRemainingMs: 3 * HOUR });
    expect(computeSnapshot(c, T0 + 5 * HOUR).remainingMs).toBe(3 * HOUR);
    expect(computeSnapshot(c, T0 + 9 * HOUR).remainingMs).toBe(3 * HOUR);
    expect(computeSnapshot(c, T0).phase).toBe("hold");
  });

  it("11. milestone transitions happen at the configured offsets", () => {
    const expectations: Array<[number, string, string | null]> = [
      [0, "IGNITION", "DISCOVERY"],
      [HOUR - 1, "IGNITION", "DISCOVERY"],
      [HOUR, "DISCOVERY", "IDEATION"],
      [3 * HOUR, "IDEATION", "BUILD MODE"],
      [5 * HOUR, "BUILD MODE", "REFINEMENT"],
      [9 * HOUR - 1, "BUILD MODE", "REFINEMENT"],
      [9 * HOUR, "REFINEMENT", "FINAL PUSH"],
      [11 * HOUR, "FINAL PUSH", "MISSION COMPLETE"],
      [12 * HOUR, "MISSION COMPLETE", null],
    ];
    for (const [elapsed, current, next] of expectations) {
      const s = computeSnapshot(runningClock(), T0 + elapsed, DEFAULT_MILESTONES);
      expect([elapsed, s.currentMilestone?.title]).toEqual([elapsed, current]);
      expect([elapsed, s.nextMilestone?.title ?? null]).toEqual([elapsed, next]);
    }
    const s = computeSnapshot(runningClock(), T0 + 30 * MINUTE, DEFAULT_MILESTONES);
    expect(s.msToNextMilestone).toBe(30 * MINUTE);
  });

  it("disabled milestones are skipped without touching the master clock", () => {
    const list = DEFAULT_MILESTONES.map((m) => (m.title === "DISCOVERY" ? { ...m, enabled: false } : m));
    const s = computeSnapshot(runningClock(), T0 + 2 * HOUR, list);
    expect(s.currentMilestone?.title).toBe("IGNITION");
    expect(s.remainingMs).toBe(10 * HOUR);
  });

  it("energy ring phases follow the spec thresholds", () => {
    expect(energyPhase("RUNNING", 12 * HOUR)).toBe("charged");
    expect(energyPhase("RUNNING", 6 * HOUR + 1)).toBe("charged");
    expect(energyPhase("RUNNING", 6 * HOUR)).toBe("flux");
    expect(energyPhase("RUNNING", 3 * HOUR)).toBe("amber");
    expect(energyPhase("RUNNING", HOUR)).toBe("ember");
    expect(energyPhase("RUNNING", 10 * MINUTE)).toBe("critical");
    expect(energyPhase("RUNNING", 0)).toBe("complete");
  });

  it("final-hour stages", () => {
    const at = (rem: number) => computeSnapshot(runningClock(), T0 + TWELVE_H - rem).stage;
    expect(at(HOUR + 1000)).toBe("mission");
    expect(at(HOUR)).toBe("final-hour");
    expect(at(10 * MINUTE)).toBe("final-countdown");
    expect(at(MINUTE)).toBe("final-minute");
    expect(at(10_000)).toBe("final-seconds");
  });

  it("aligns ticks to whole-second boundaries", () => {
    expect(msUntilNextSecond(5_250)).toBe(250);
    expect(msUntilNextSecond(5_000)).toBe(1000);
  });

  it("selects active announcements by publish/expiry/priority", () => {
    const base: Announcement = { id: "a", message: "m", priority: "normal", displaySeconds: 20, publishAt: T0, expiresAt: null, cancelledAt: null, createdAt: T0 };
    const list: Announcement[] = [
      base,
      { ...base, id: "b", priority: "critical", publishAt: T0 + 1000 },
      { ...base, id: "c", publishAt: T0 + 60_000 }, // scheduled
      { ...base, id: "d", cancelledAt: T0 },
      { ...base, id: "e", expiresAt: T0 + 500 },
    ];
    expect(activeAnnouncements(list, T0 + 2000).map((a) => a.id)).toEqual(["b", "a"]);
    expect(activeAnnouncements(list, T0 + 25_000).map((a) => a.id)).toEqual([]);
    expect(activeAnnouncements(list, T0 + 61_000).map((a) => a.id)).toEqual(["c"]);
  });
});
