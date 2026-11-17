import type { Announcement, MissionBundle, MissionClock, Milestone } from "./types";

/**
 * Framework-agnostic mission state store.
 *
 * - The authoritative snapshot always comes from the server (`load`).
 * - Realtime pushes are treated as hints: clock updates are applied only if
 *   their version is newer; otherwise we refetch. Older versions are ignored,
 *   so out-of-order messages can't roll the clock back.
 * - On reconnect we always refetch, restoring authoritative state.
 */

export type ConnectionStatus = "connecting" | "live" | "degraded" | "offline";

export interface Transport {
  load: () => Promise<MissionBundle>;
  /** Subscribe to realtime changes. Returns an unsubscribe fn. */
  subscribe: (handlers: {
    onClock: (c: MissionClock) => void;
    onMilestones: () => void;
    onAnnouncement: (a: Announcement) => void;
    onEvent: () => void;
    onStatus: (s: "live" | "down") => void;
  }) => () => void;
}

export interface StoreState {
  bundle: MissionBundle | null;
  status: ConnectionStatus;
  lastLoadedAt: number | null;
  error: string | null;
}

export class MissionStore {
  private state: StoreState = { bundle: null, status: "connecting", lastLoadedAt: null, error: null };
  private listeners = new Set<() => void>();
  private unsubscribe: (() => void) | null = null;
  private loading: Promise<void> | null = null;
  private wasDown = false;

  constructor(private readonly transport: Transport, private readonly now: () => number = () => Date.now()) {}

  getState = () => this.state;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private set(patch: Partial<StoreState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  async refresh(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const bundle = await this.transport.load();
        const current = this.state.bundle;
        // Never regress to an older clock version (e.g. a stale cached response).
        if (current && bundle.clock.version < current.clock.version) {
          bundle.clock = current.clock;
        }
        this.set({ bundle, lastLoadedAt: this.now(), error: null });
      } catch (e) {
        this.set({ error: e instanceof Error ? e.message : String(e) });
      }
    })().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  async start() {
    await this.refresh();
    this.unsubscribe = this.transport.subscribe({
      onClock: (c) => this.applyClock(c),
      onMilestones: () => void this.refresh(),
      onEvent: () => void this.refresh(),
      onAnnouncement: (a) => this.applyAnnouncement(a),
      onStatus: (s) => {
        if (s === "live") {
          this.set({ status: "live" });
          if (this.wasDown) void this.refresh(); // reconnection restores authoritative state
          this.wasDown = false;
        } else {
          this.wasDown = true;
          this.set({ status: this.state.bundle ? "degraded" : "offline" });
        }
      },
    });
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  applyClock(c: MissionClock) {
    const b = this.state.bundle;
    if (!b) return void this.refresh();
    if (c.version <= b.clock.version) return;
    this.set({ bundle: { ...b, clock: c } });
  }

  applyAnnouncement(a: Announcement) {
    const b = this.state.bundle;
    if (!b) return void this.refresh();
    const others = b.announcements.filter((x) => x.id !== a.id);
    this.set({ bundle: { ...b, announcements: [a, ...others].slice(0, 50) } });
  }

  setMilestones(m: Milestone[]) {
    const b = this.state.bundle;
    if (b) this.set({ bundle: { ...b, milestones: m } });
  }
}
