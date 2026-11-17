/**
 * Latency-aware server time estimation (NTP-style).
 *
 * Each sample measures round-trip time using the monotonic clock
 * (performance.now) and assumes the server stamped its reply halfway through.
 * We keep the lowest-RTT samples (most trustworthy) and anchor server time to
 * the monotonic clock, so the device's wall clock (Date.now) is never trusted
 * for the official countdown.
 *
 * Monotonic clocks can pause while a device sleeps, so we also watch the wall
 * clock: if wall-clock and monotonic deltas diverge, the anchor is stale and we
 * resynchronise.
 */

export interface TimeSource {
  /** Returns the server's epoch-ms timestamp. */
  fetchServerTime: () => Promise<number>;
  /** Monotonic ms (performance.now). */
  monotonic: () => number;
  /** Device wall clock (Date.now) — only used to detect sleep/jumps. */
  wall: () => number;
}

export interface SyncSample {
  rtt: number;
  /** server - local monotonic */
  offset: number;
}

export interface ClockHealth {
  synced: boolean;
  rtt: number | null;
  /** Estimated device wall-clock error vs. server (ms, + = device ahead). */
  deviceSkew: number | null;
  lastSyncAt: number | null; // monotonic
  samples: number;
}

export class ServerClock {
  private samples: SyncSample[] = [];
  private offset: number | null = null; // serverTime = monotonic + offset
  private anchorWall = 0;
  private anchorMono = 0;
  private lastSyncMono: number | null = null;
  private inflight: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  constructor(private readonly source: TimeSource, private readonly maxSamples = 8) {}

  /** Seed from a server timestamp embedded in a payload (single sample, unknown RTT). */
  seed(serverNow: number, rtt = 0) {
    if (this.offset !== null) return;
    const mono = this.source.monotonic();
    this.applyOffset(serverNow + rtt / 2 - mono, rtt);
  }

  async sync(rounds = 4): Promise<void> {
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      // Samples taken before a sleep/clock jump are anchored to a different
      // monotonic timeline, so they must not be mixed with fresh ones.
      if (this.offset !== null && this.isStale()) this.samples = [];
      for (let i = 0; i < rounds; i++) {
        try {
          const t0 = this.source.monotonic();
          const server = await this.source.fetchServerTime();
          const t1 = this.source.monotonic();
          const rtt = Math.max(0, t1 - t0);
          this.samples.push({ rtt, offset: server + rtt / 2 - t1 });
        } catch {
          // keep the previous estimate; the caller can retry later.
        }
      }
      if (this.samples.length > this.maxSamples * 2) this.samples = this.samples.slice(-this.maxSamples * 2);
      if (this.samples.length) {
        // Best (lowest RTT) third of recent samples, median offset.
        const best = [...this.samples].sort((a, b) => a.rtt - b.rtt).slice(0, Math.max(1, Math.ceil(this.samples.length / 3)));
        const offsets = best.map((s) => s.offset).sort((a, b) => a - b);
        const median = offsets[Math.floor(offsets.length / 2)];
        this.applyOffset(median, best[0].rtt);
      }
    })().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private rtt: number | null = null;

  private applyOffset(offset: number, rtt: number) {
    this.offset = offset;
    this.rtt = rtt;
    this.anchorMono = this.source.monotonic();
    this.anchorWall = this.source.wall();
    this.lastSyncMono = this.anchorMono;
    this.listeners.forEach((l) => l());
  }

  /** Estimated authoritative server time in epoch ms. */
  now(): number {
    const mono = this.source.monotonic();
    if (this.offset === null) return this.source.wall();
    return mono + this.offset;
  }

  isSynced() {
    return this.offset !== null;
  }

  /**
   * True when the monotonic clock appears to have stalled relative to the wall
   * clock (e.g. device slept) — meaning a resync is needed.
   */
  isStale(toleranceMs = 2000): boolean {
    if (this.offset === null) return true;
    const monoDelta = this.source.monotonic() - this.anchorMono;
    const wallDelta = this.source.wall() - this.anchorWall;
    return Math.abs(wallDelta - monoDelta) > toleranceMs;
  }

  health(): ClockHealth {
    return {
      synced: this.offset !== null,
      rtt: this.rtt,
      deviceSkew: this.offset === null ? null : this.source.wall() - this.now(),
      lastSyncAt: this.lastSyncMono,
      samples: this.samples.length,
    };
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export function browserTimeSource(endpoint = "/api/time"): TimeSource {
  return {
    fetchServerTime: async () => {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) throw new Error(`time sync failed: ${res.status}`);
      const body = (await res.json()) as { now: number };
      return body.now;
    },
    monotonic: () => performance.now(),
    wall: () => Date.now(),
  };
}
