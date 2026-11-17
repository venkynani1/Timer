import type { MissionClock } from "@/lib/timer/types";

export const T0 = Date.UTC(2026, 10, 21, 9, 0, 0); // official start (server time)
export const TWELVE_H = 43_200_000;

export function runningClock(overrides: Partial<MissionClock> = {}): MissionClock {
  return {
    eventId: "e1",
    state: "RUNNING",
    durationSeconds: 43_200,
    startedAt: T0,
    endsAt: T0 + TWELVE_H,
    completedAt: null,
    heldAt: null,
    heldRemainingMs: null,
    overrideEnabled: false,
    displayMode: "cinematic",
    soundEnabled: false,
    closingMessage: "12 HOURS. COUNTLESS IDEAS. ONE INCREDIBLE MISSION.",
    version: 2,
    updatedAt: T0,
    ...overrides,
  };
}

