import { DEFAULT_CLOSING_MESSAGE, DEFAULT_DURATION_SECONDS, DEFAULT_MILESTONES } from "./defaults";
import type { MissionBundle } from "./types";

/**
 * Developer-only accelerated simulation.
 *
 * The simulation runs entirely in the browser against a synthetic, fake event.
 * It never reads or writes the official clock, never calls admin APIs, and is
 * refused in production builds unless explicitly allowed via
 * NEXT_PUBLIC_ALLOW_SIMULATION=true (e.g. on a staging deployment).
 */

export interface SimulationConfig {
  speed: number; // 1..3600x
  /** Elapsed seconds into the mission at which the simulation begins. */
  startAtSeconds: number;
  durationSeconds: number;
  /** Start in NOT_STARTED and launch after N real seconds (to preview the launch sequence). */
  launchAfterSeconds: number | null;
}

export function isSimulationAllowed(env: { NODE_ENV?: string; NEXT_PUBLIC_ALLOW_SIMULATION?: string }): boolean {
  if (env.NEXT_PUBLIC_ALLOW_SIMULATION === "true") return true;
  return env.NODE_ENV !== "production";
}

export function parseSimulation(params: URLSearchParams, allowed: boolean): SimulationConfig | null {
  if (!allowed) return null;
  const raw = params.get("sim");
  if (raw === null) return null;
  const speed = clamp(Number(raw) || 1, 1, 3600);
  const at = parseHms(params.get("at") ?? "0");
  const duration = clamp(Number(params.get("duration")) || DEFAULT_DURATION_SECONDS, 60, 172_800);
  const launch = params.get("launch");
  return {
    speed,
    startAtSeconds: clamp(at, 0, duration),
    durationSeconds: duration,
    launchAfterSeconds: launch === null ? null : clamp(Number(launch) || 0, 0, 120),
  };
}

function parseHms(v: string): number {
  if (/^\d+$/.test(v)) return Number(v);
  const parts = v.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * A virtual clock: simulated time = origin + (real elapsed * speed).
 * `realNow` must be monotonic.
 */
export class SimulatedClock {
  private readonly realOrigin: number;
  constructor(private readonly config: SimulationConfig, private readonly realNow: () => number, private readonly simOrigin = Date.UTC(2026, 0, 1, 9)) {
    this.realOrigin = realNow();
  }
  now(): number {
    return this.simOrigin + (this.realNow() - this.realOrigin) * this.config.speed;
  }
  /** Official start time in simulated time. */
  startedAt(): number | null {
    if (this.config.launchAfterSeconds !== null) {
      const launchAt = this.simOrigin + this.config.launchAfterSeconds * 1000 * this.config.speed;
      return this.now() >= launchAt ? launchAt : null;
    }
    return this.simOrigin - this.config.startAtSeconds * 1000;
  }
  bundle(): MissionBundle {
    const startedAt = this.startedAt();
    const endsAt = startedAt === null ? null : startedAt + this.config.durationSeconds * 1000;
    const now = this.now();
    const done = endsAt !== null && now >= endsAt;
    return {
      event: { id: "simulation", slug: "simulation", name: "DESIGNATHON X", subtitle: "THE FINAL 12", tagline: "12 Hours. One Mission. Infinite Possibilities." },
      clock: {
        eventId: "simulation",
        state: startedAt === null ? "NOT_STARTED" : done ? "COMPLETED" : "RUNNING",
        durationSeconds: this.config.durationSeconds,
        startedAt,
        endsAt,
        completedAt: done ? endsAt : null,
        heldAt: null,
        heldRemainingMs: null,
        overrideEnabled: false,
        displayMode: "cinematic",
        soundEnabled: true,
        closingMessage: DEFAULT_CLOSING_MESSAGE,
        version: startedAt === null ? 1 : done ? 3 : 2,
        updatedAt: now,
      },
      milestones: DEFAULT_MILESTONES.map((m) => ({ ...m, offsetSeconds: Math.round((m.offsetSeconds / DEFAULT_DURATION_SECONDS) * this.config.durationSeconds) })),
      announcements: [],
      serverNow: now,
    };
  }
}
