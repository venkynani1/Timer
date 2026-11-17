import { describe, it, expect } from "vitest";
import { ServerClock, type TimeSource } from "@/lib/timer/server-clock";
import { computeSnapshot, formatDuration } from "@/lib/timer/engine";
import { runningClock, T0, TWELVE_H } from "./helpers";

/**
 * Simulated world: one true server clock; each device has its own monotonic
 * clock, a wrong wall clock and network latency.
 */
function makeWorld(start: number) {
  let serverTime = start;
  const devices: Array<{ mono: number }> = [];
  return {
    serverNow: () => serverTime,
    /** Real time passes for everyone. */
    tick(ms: number) {
      serverTime += ms;
      devices.forEach((d) => (d.mono += ms));
    },
    device(opts: { skewMs: number; latencyMs: number; uplinkShare?: number }): TimeSource & { sleep: (ms: number) => void } {
      const d = { mono: 50 + Math.random() * 1000 };
      devices.push(d);
      const tick = this.tick.bind(this);
      return {
        monotonic: () => d.mono,
        wall: () => serverTime + opts.skewMs,
        fetchServerTime: async () => {
          const up = opts.latencyMs * (opts.uplinkShare ?? 0.5);
          tick(up);
          const stamp = serverTime;
          tick(opts.latencyMs - up);
          return stamp;
        },
        /** Device sleeps: wall clock moves, monotonic clock does not. */
        sleep(ms: number) {
          serverTime += ms;
          devices.forEach((x) => x !== d && (x.mono += ms));
        },
      };
    },
  };
}

describe("server time synchronisation", () => {
  it("6. a wildly wrong device clock does not change the official remaining time", async () => {
    const w = makeWorld(T0 + 3_600_000);
    const liar = new ServerClock(w.device({ skewMs: 3 * 3_600_000 + 17_000, latencyMs: 80 })); // 3h ahead
    const past = new ServerClock(w.device({ skewMs: -86_400_000, latencyMs: 40 })); // a day behind
    await liar.sync();
    await past.sync();
    for (const c of [liar, past]) {
      expect(Math.abs(c.now() - w.serverNow())).toBeLessThan(5);
      expect(formatDuration(computeSnapshot(runningClock(), c.now()).remainingMs)).toBe(
        formatDuration(computeSnapshot(runningClock(), w.serverNow()).remainingMs),
      );
    }
    expect(Math.round((liar.health().deviceSkew ?? 0) / 1000)).toBe(3 * 3600 + 17);
  });

  it("3. multiple screens on different networks display consistent remaining time", async () => {
    const w = makeWorld(T0 + 5 * 3_600_000);
    const screens = [
      { skewMs: 0, latencyMs: 20 },
      { skewMs: 120_000, latencyMs: 350 },
      { skewMs: -45_000, latencyMs: 900, uplinkShare: 0.5 },
      { skewMs: 7_200_000, latencyMs: 120 },
    ].map((o) => new ServerClock(w.device(o)));
    // Each screen syncs over its own network (sequentially here: the fake world is single-threaded).
    for (const s of screens) await s.sync(5);
    w.tick(123_456);
    const remaining = screens.map((s) => computeSnapshot(runningClock(), s.now()).remainingMs);
    const spread = Math.max(...remaining) - Math.min(...remaining);
    expect(spread).toBeLessThan(10);
  });

  it("prefers low-latency samples when the network is jittery and asymmetric", async () => {
    const w = makeWorld(T0);
    let call = 0;
    const base = w.device({ skewMs: 0, latencyMs: 0 });
    const jittery: TimeSource = {
      ...base,
      fetchServerTime: async () => {
        const lat = [30, 1500, 40, 2200, 35, 900, 30, 30][call++ % 8];
        const up = lat * 0.9; // very asymmetric on the slow ones
        w.tick(up);
        const s = w.serverNow();
        w.tick(lat - up);
        return s;
      },
    };
    const clock = new ServerClock(jittery);
    await clock.sync(8);
    expect(Math.abs(clock.now() - w.serverNow())).toBeLessThan(20);
  });

  it("detects a sleeping device and resynchronises without accumulating drift", async () => {
    const w = makeWorld(T0);
    const dev = w.device({ skewMs: 0, latencyMs: 60 });
    const clock = new ServerClock(dev);
    await clock.sync();
    expect(clock.isStale()).toBe(false);
    dev.sleep(40 * 60_000); // laptop lid closed for 40 minutes
    expect(clock.isStale()).toBe(true);
    await clock.sync();
    expect(clock.isStale()).toBe(false);
    expect(Math.abs(clock.now() - w.serverNow())).toBeLessThan(5);
  });

  it("no accumulating drift over a full 12-hour run with periodic resync", async () => {
    const w = makeWorld(T0);
    const clock = new ServerClock(w.device({ skewMs: 4_000, latencyMs: 75 }));
    await clock.sync();
    let worst = 0;
    for (let i = 0; i < 12 * 12; i++) {
      w.tick(5 * 60_000);
      worst = Math.max(worst, Math.abs(clock.now() - w.serverNow()));
      if (i % 6 === 0) await clock.sync(2);
    }
    expect(worst).toBeLessThan(5);
    expect(computeSnapshot(runningClock(), clock.now()).remainingMs).toBeLessThanOrEqual(TWELVE_H);
  });

  it("keeps the previous estimate if the network fails", async () => {
    const w = makeWorld(T0);
    const dev = w.device({ skewMs: 0, latencyMs: 50 });
    const clock = new ServerClock(dev);
    await clock.sync();
    const failing = { ...dev, fetchServerTime: () => Promise.reject(new Error("offline")) };
    const clock2 = new ServerClock(failing);
    await clock2.sync();
    expect(clock2.isSynced()).toBe(false);
    w.tick(10_000);
    expect(Math.abs(clock.now() - w.serverNow())).toBeLessThan(5);
  });
});
