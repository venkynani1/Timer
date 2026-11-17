import { describe, it, expect } from "vitest";
import { SimulatedClock, isSimulationAllowed, parseSimulation } from "@/lib/timer/simulation";
import { computeSnapshot, formatDuration } from "@/lib/timer/engine";

describe("developer accelerated mode", () => {
  it("is refused in production unless explicitly allowed", () => {
    expect(isSimulationAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(isSimulationAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(isSimulationAllowed({ NODE_ENV: "production", NEXT_PUBLIC_ALLOW_SIMULATION: "true" })).toBe(true);
    expect(parseSimulation(new URLSearchParams("sim=600"), false)).toBeNull();
  });

  it("parses speed and start offsets", () => {
    const c = parseSimulation(new URLSearchParams("sim=60&at=11:59:30"), true)!;
    expect(c.speed).toBe(60);
    expect(c.startAtSeconds).toBe(11 * 3600 + 59 * 60 + 30);
    expect(parseSimulation(new URLSearchParams("sim=999999"), true)!.speed).toBe(3600);
  });

  it("15. a simulated 12-hour run produces the correct completion time", () => {
    let real = 0;
    const config = parseSimulation(new URLSearchParams("sim=3600"), true)!; // 1 real second = 1 hour
    const sim = new SimulatedClock(config, () => real);
    const start = sim.bundle().clock.startedAt!;
    let last = Infinity;
    let completedAtReal: number | null = null;
    // Step in 1 ms real increments (= 3.6 simulated seconds), the way a 60 fps renderer would sample.
    for (real = 0; real <= 13_000; real += 1) {
      const b = sim.bundle();
      const s = computeSnapshot(b.clock, sim.now(), b.milestones);
      expect(s.remainingMs).toBeGreaterThanOrEqual(0);
      expect(s.remainingMs).toBeLessThanOrEqual(last);
      last = s.remainingMs;
      if (s.state === "COMPLETED" && completedAtReal === null) {
        completedAtReal = real;
        expect(b.clock.completedAt).toBe(start + 43_200_000);
        expect(formatDuration(s.remainingMs)).toBe("00:00:00");
        expect(s.currentMilestone?.title).toBe("MISSION COMPLETE");
      }
    }
    expect(completedAtReal).toBe(12_000); // exactly 12 h of simulated time
  });

  it("never touches the official clock (pure, synthetic event id)", () => {
    const sim = new SimulatedClock(parseSimulation(new URLSearchParams("sim=1"), true)!, () => 0);
    expect(sim.bundle().event.id).toBe("simulation");
  });
});
