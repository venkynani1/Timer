import { describe, it, expect } from "vitest";
import { MissionStore, type Transport } from "@/lib/timer/store";
import { DEFAULT_MILESTONES } from "@/lib/timer/defaults";
import { computeSnapshot, activeAnnouncements } from "@/lib/timer/engine";
import type { Announcement, MissionBundle, MissionClock } from "@/lib/timer/types";
import { runningClock, T0 } from "./helpers";

/** In-memory "Supabase": one database + a realtime bus fanning out to N clients. */
function fakeBackend() {
  let clock: MissionClock = runningClock({ state: "NOT_STARTED", startedAt: null, endsAt: null, version: 1 });
  let announcements: Announcement[] = [];
  let serverNow = T0 - 60_000;
  const subscribers = new Set<Parameters<Transport["subscribe"]>[0]>();
  let up = true;

  const bundle = (): MissionBundle => ({
    event: { id: "e1", slug: "designathon-x", name: "DESIGNATHON X", subtitle: "THE FINAL 12", tagline: "" },
    clock: { ...clock },
    milestones: DEFAULT_MILESTONES,
    announcements: [...announcements],
    serverNow,
  });

  return {
    setNow: (t: number) => (serverNow = t),
    start() {
      if (clock.state !== "NOT_STARTED") return;
      clock = { ...clock, state: "RUNNING", startedAt: serverNow, endsAt: serverNow + 43_200_000, version: clock.version + 1 };
      if (up) subscribers.forEach((s) => s.onClock({ ...clock }));
    },
    announce(a: Announcement) {
      announcements = [a, ...announcements];
      if (up) subscribers.forEach((s) => s.onAnnouncement(a));
    },
    dropRealtime() {
      up = false;
      subscribers.forEach((s) => s.onStatus("down"));
    },
    restoreRealtime() {
      up = true;
      subscribers.forEach((s) => s.onStatus("live"));
    },
    transport(): Transport {
      return {
        load: async () => bundle(),
        subscribe: (h) => {
          subscribers.add(h);
          queueMicrotask(() => h.onStatus("live"));
          return () => subscribers.delete(h);
        },
      };
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("realtime state store", () => {
  it("12. announcements synchronise across clients", async () => {
    const be = fakeBackend();
    const projector = new MissionStore(be.transport());
    const phone = new MissionStore(be.transport());
    await Promise.all([projector.start(), phone.start()]);
    be.setNow(T0);
    be.announce({ id: "a1", message: "Refreshments are now available.", priority: "normal", displaySeconds: 30, publishAt: T0, expiresAt: null, cancelledAt: null, createdAt: T0 });
    for (const s of [projector, phone]) {
      const active = activeAnnouncements(s.getState().bundle!.announcements, T0 + 1000);
      expect(active.map((a) => a.message)).toEqual(["Refreshments are now available."]);
    }
  });

  it("starting the mission propagates the same deadline to every screen", async () => {
    const be = fakeBackend();
    const screens = [0, 1, 2].map(() => new MissionStore(be.transport()));
    await Promise.all(screens.map((s) => s.start()));
    be.setNow(T0);
    be.start();
    const deadlines = screens.map((s) => s.getState().bundle!.clock.endsAt);
    expect(new Set(deadlines).size).toBe(1);
    expect(deadlines[0]).toBe(T0 + 43_200_000);
  });

  it("2. a refresh (new store instance) shows the same remaining time, not a reset", async () => {
    const be = fakeBackend();
    be.setNow(T0);
    be.start();
    be.setNow(T0 + 4 * 3_600_000);
    const fresh = new MissionStore(be.transport());
    await fresh.start();
    const snap = computeSnapshot(fresh.getState().bundle!.clock, T0 + 4 * 3_600_000);
    expect(snap.remainingMs).toBe(8 * 3_600_000);
  });

  it("13. reconnection restores authoritative state missed while offline", async () => {
    const be = fakeBackend();
    const screen = new MissionStore(be.transport());
    await screen.start();
    await flush();
    expect(screen.getState().status).toBe("live");
    be.dropRealtime();
    expect(screen.getState().status).toBe("degraded");
    be.setNow(T0);
    be.start(); // missed: realtime is down
    expect(screen.getState().bundle!.clock.state).toBe("NOT_STARTED");
    be.restoreRealtime();
    await flush();
    expect(screen.getState().status).toBe("live");
    expect(screen.getState().bundle!.clock.state).toBe("RUNNING");
    expect(screen.getState().bundle!.clock.endsAt).toBe(T0 + 43_200_000);
  });

  it("ignores out-of-order (older) clock versions", async () => {
    const be = fakeBackend();
    be.setNow(T0);
    be.start();
    const s = new MissionStore(be.transport());
    await s.start();
    const current = s.getState().bundle!.clock;
    s.applyClock({ ...current, state: "NOT_STARTED", version: current.version - 1 });
    expect(s.getState().bundle!.clock.state).toBe("RUNNING");
  });
});
