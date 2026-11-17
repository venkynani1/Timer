"use client";

/**
 * Tiny synthesized sound kit (WebAudio, no assets). Audio only starts after a
 * user gesture calls `unlock()`, which keeps us within autoplay rules.
 */
class SoundKit {
  private ctx: AudioContext | null = null;
  muted = true;

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    void this.ctx.resume();
    this.muted = false;
  }

  get ready() {
    return !!this.ctx && this.ctx.state === "running" && !this.muted;
  }

  private tone(freq: number, start: number, dur: number, gain = 0.15, type: OscillatorType = "sine") {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  tick(final = false) {
    if (!this.ready) return;
    this.tone(final ? 880 : 660, 0, 0.18, 0.18, "triangle");
  }

  launch() {
    if (!this.ready) return;
    [220, 330, 440, 660].forEach((f, i) => this.tone(f, i * 0.12, 0.8, 0.08, "sawtooth"));
  }

  chime() {
    if (!this.ready) return;
    this.tone(784, 0, 0.6, 0.08);
    this.tone(1046, 0.15, 0.8, 0.07);
  }

  complete() {
    if (!this.ready) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, i * 0.18, 2.2, 0.08, "triangle"));
  }
}

export const sound = new SoundKit();
