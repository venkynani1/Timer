"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { computeSnapshot, msUntilNextSecond, activeAnnouncements, type Snapshot } from "@/lib/timer/engine";
import { ServerClock, browserTimeSource, type ClockHealth } from "@/lib/timer/server-clock";
import { MissionStore, type ConnectionStatus } from "@/lib/timer/store";
import { supabaseTransport } from "@/lib/timer/transport";
import { SimulatedClock, type SimulationConfig } from "@/lib/timer/simulation";
import type { Announcement, MissionBundle } from "@/lib/timer/types";

const RESYNC_INTERVAL = 5 * 60_000;
const POLL_WHEN_LIVE = 5 * 60_000;
const POLL_WHEN_DOWN = 20_000;
const LAUNCH_SEQUENCE_MS = 10_000;

export interface MissionView {
  bundle: MissionBundle | null;
  snapshot: Snapshot | null;
  /** Active (visible) announcements at the current server time. */
  announcements: Announcement[];
  serverNow: number;
  status: ConnectionStatus;
  health: ClockHealth | null;
  error: string | null;
  /** True while the cinematic launch should play (only when the launch was observed live). */
  launchActive: boolean;
  /** ms since official start, used to drive the launch sequence in lock-step on every screen. */
  launchElapsedMs: number;
  /** True when the completion was observed live (to play celebration once). */
  completedLive: boolean;
  simulated: boolean;
  refresh: () => void;
  now: () => number;
}

interface Tick {
  snapshot: Snapshot | null;
  serverNow: number;
  announcementKey: string;
}

/**
 * Single source of truth for every timer screen.
 * Rendering is driven by setTimeout aligned to whole-second boundaries of the
 * *server* clock — one state update per second, no accumulating drift.
 */
export function useMission(slug: string, simulation: SimulationConfig | null): MissionView {
  const simulated = simulation !== null;

  const clockRef = useRef<ServerClock | null>(null);
  const simRef = useRef<SimulatedClock | null>(null);
  const storeRef = useRef<MissionStore | null>(null);

  if (typeof window !== "undefined") {
    if (simulated && !simRef.current) simRef.current = new SimulatedClock(simulation, () => performance.now());
    if (!simulated && !clockRef.current) clockRef.current = new ServerClock(browserTimeSource());
    if (!simulated && !storeRef.current) storeRef.current = new MissionStore(supabaseTransport(slug));
  }

  const now = useCallback(() => {
    if (simRef.current) return simRef.current.now();
    return clockRef.current?.now() ?? Date.now();
  }, []);

  const store = storeRef.current;
  const storeState = useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getState ?? nullState,
    nullState,
  );

  const [simBundle, setSimBundle] = useState<MissionBundle | null>(null);
  const bundle = simulated ? simBundle : storeState.bundle;

  const [health, setHealth] = useState<ClockHealth | null>(null);

  // --- Boot: time sync + store + resync triggers -------------------------------------------
  useEffect(() => {
    if (simulated) return;
    const clock = clockRef.current!;
    const st = storeRef.current!;
    let disposed = false;

    const resync = () => {
      void clock.sync(3).then(() => !disposed && setHealth(clock.health()));
    };
    const refreshAll = () => {
      resync();
      void st.refresh();
    };

    resync();
    void st.start().then(() => {
      const b = st.getState().bundle;
      if (b && !clock.isSynced()) clock.seed(b.serverNow);
    });

    const onVisible = () => document.visibilityState === "visible" && refreshAll();
    window.addEventListener("focus", refreshAll);
    window.addEventListener("online", refreshAll);
    document.addEventListener("visibilitychange", onVisible);

    const resyncTimer = window.setInterval(resync, RESYNC_INTERVAL);
    // Watchdog: catches sleep/wake and clock jumps the browser didn't announce.
    const watchdog = window.setInterval(() => clock.isStale() && refreshAll(), 15_000);

    let pollTimer: number;
    const schedulePoll = () => {
      const live = st.getState().status === "live";
      pollTimer = window.setTimeout(() => {
        void st.refresh();
        schedulePoll();
      }, live ? POLL_WHEN_LIVE : POLL_WHEN_DOWN);
    };
    schedulePoll();

    return () => {
      disposed = true;
      st.stop();
      window.removeEventListener("focus", refreshAll);
      window.removeEventListener("online", refreshAll);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(resyncTimer);
      window.clearInterval(watchdog);
      window.clearTimeout(pollTimer);
    };
  }, [simulated]);

  // A realtime state change is also a resync trigger for the clock.
  const version = bundle?.clock.version;
  useEffect(() => {
    if (!simulated && version !== undefined) void clockRef.current?.sync(2).then(() => setHealth(clockRef.current!.health()));
  }, [version, simulated]);

  // --- Tick ----------------------------------------------------------------------------------
  const [tick, setTick] = useState<Tick>({ snapshot: null, serverNow: 0, announcementKey: "" });
  const bundleRef = useRef(bundle);
  bundleRef.current = bundle;

  const lastSimState = useRef("");
  useEffect(() => {
    let timer: number;
    const loop = () => {
      let b = bundleRef.current;
      if (simRef.current) {
        const sb = simRef.current.bundle();
        if (sb.clock.state !== lastSimState.current) {
          lastSimState.current = sb.clock.state;
          setSimBundle(sb);
        }
        b = sb;
      }
      const t = now();
      if (b) {
        const snap = computeSnapshot(b.clock, t, b.milestones);
        const active = activeAnnouncements(b.announcements, t);
        const key = active.map((a) => a.id).join(",");
        setTick((prev) =>
          prev.snapshot &&
          prev.snapshot.remainingSeconds === snap.remainingSeconds &&
          prev.snapshot.state === snap.state &&
          prev.snapshot.currentMilestone?.id === snap.currentMilestone?.id &&
          prev.announcementKey === key &&
          prev.snapshot.durationMs === snap.durationMs &&
          prev.serverNow !== 0 &&
          Math.floor(prev.serverNow / 1000) === Math.floor(t / 1000)
            ? prev
            : { snapshot: snap, serverNow: t, announcementKey: key },
        );
        const ahead = snap.stage === "final-seconds" ? 0 : 8;
        const speed = simRef.current ? simulation!.speed : 1;
        timer = window.setTimeout(loop, Math.max(16, (msUntilNextSecond(snap.remainingMs) + ahead) / speed));
      } else {
        timer = window.setTimeout(loop, 250);
      }
    };
    loop();
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, bundle]);

  // --- Live transitions (launch + completion) -------------------------------------------------
  const prevStateRef = useRef<string | null>(null);
  const [launchObserved, setLaunchObserved] = useState(false);
  const [completedLive, setCompletedLive] = useState(false);
  const state = tick.snapshot?.state;
  useEffect(() => {
    if (!state) return;
    const prev = prevStateRef.current;
    if (prev === "NOT_STARTED" && state === "RUNNING") setLaunchObserved(true);
    if (prev && prev !== "COMPLETED" && state === "COMPLETED") setCompletedLive(true);
    prevStateRef.current = state;
  }, [state]);

  const startedAt = bundle?.clock.startedAt ?? null;
  const launchElapsedMs = startedAt === null ? 0 : tick.serverNow - startedAt;
  const launchActive = launchObserved && startedAt !== null && launchElapsedMs < LAUNCH_SEQUENCE_MS;

  const announcements = useMemo(
    () => (bundle ? activeAnnouncements(bundle.announcements, tick.serverNow) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle?.announcements, tick.announcementKey],
  );

  const refresh = useCallback(() => {
    void storeRef.current?.refresh();
    void clockRef.current?.sync(2).then(() => setHealth(clockRef.current!.health()));
  }, []);

  return {
    bundle,
    snapshot: tick.snapshot,
    announcements,
    serverNow: tick.serverNow,
    status: simulated ? "live" : storeState.status,
    health: simulated ? { synced: true, rtt: 0, deviceSkew: 0, lastSyncAt: 0, samples: 0 } : health,
    error: simulated ? null : storeState.error,
    launchActive,
    launchElapsedMs,
    completedLive,
    simulated,
    refresh,
    now,
  };
}

const noopSubscribe = () => () => {};
const NULL_STATE = { bundle: null, status: "connecting" as ConnectionStatus, lastLoadedAt: null, error: null };
const nullState = () => NULL_STATE;
