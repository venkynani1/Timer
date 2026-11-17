"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize, Minimize, Volume2, VolumeX, MonitorPlay, Gauge, LayoutDashboard } from "lucide-react";
import { sound } from "@/lib/sound";
import type { DisplayMode } from "@/lib/timer/types";
import { cn } from "@/lib/utils";

export function useFullscreen() {
  const [active, setActive] = useState(false);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const on = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      else setFallback((f) => !f);
    } catch {
      // Fullscreen API refused (iOS Safari, iframes): use the in-page fallback.
      setFallback((f) => !f);
    }
  }, []);
  return { active: active || fallback, fallback, toggle };
}

/** Hide cursor + controls after inactivity, for a clean projector image. */
export function useIdle(ms = 3500) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t = window.setTimeout(() => setIdle(true), ms);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), ms);
    };
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    window.addEventListener("touchstart", wake);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("touchstart", wake);
    };
  }, [ms]);
  return idle;
}

export function ScreenControls({
  hidden,
  soundAllowed,
  mode,
  onMode,
  fullscreen,
}: {
  hidden: boolean;
  soundAllowed: boolean;
  mode: DisplayMode;
  onMode: (m: DisplayMode | null) => void;
  fullscreen: ReturnType<typeof useFullscreen>;
}) {
  const [muted, setMuted] = useState(true);
  const toggleSound = () => {
    if (muted) sound.unlock();
    else sound.muted = true;
    setMuted(!muted);
  };
  useEffect(() => {
    if (!soundAllowed) sound.muted = true;
    else if (!muted) sound.unlock();
  }, [soundAllowed, muted]);

  const btn = "flex h-10 items-center gap-2 rounded-full border border-white/10 bg-midnight-900/70 px-3 font-tech text-[0.65rem] uppercase tracking-[0.2em] text-sky-100/80 backdrop-blur hover:border-cyan-300/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className={cn("fixed bottom-4 right-4 z-50 flex items-center gap-2 transition-opacity duration-700", hidden && "pointer-events-none opacity-0")}>
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-midnight-900/70 p-1 backdrop-blur">
        {(
          [
            ["cinematic", MonitorPlay],
            ["minimal", Gauge],
            ["command", LayoutDashboard],
          ] as const
        ).map(([m, Icon]) => (
          <button
            key={m}
            onClick={() => onMode(m)}
            className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 font-tech text-[0.6rem] uppercase tracking-[0.2em]", mode === m ? "bg-cyan-300/15 text-cyan-100" : "text-sky-100/60 hover:text-white")}
            aria-pressed={mode === m}
            title={`${m} mode (this screen only)`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden /> {m}
          </button>
        ))}
      </div>
      {soundAllowed && (
        <button onClick={toggleSound} className={btn} aria-pressed={!muted} aria-label={muted ? "Enable sound" : "Mute"}>
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          {muted ? "Sound off" : "Sound on"}
        </button>
      )}
      <button onClick={fullscreen.toggle} className={btn} aria-label="Toggle fullscreen">
        {fullscreen.active ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        {fullscreen.active ? "Exit" : "Fullscreen"}
      </button>
    </div>
  );
}
