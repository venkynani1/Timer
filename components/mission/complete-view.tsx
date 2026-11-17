"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { MissionView } from "@/hooks/use-mission";
import { Backdrop } from "./backdrop";
import { BrandLockup, BrandMark } from "./brand";
import { Countdown } from "./countdown";
import { Celebration } from "./celebration";
import { formatDateTime } from "@/lib/format";
import { sound } from "@/lib/sound";

/**
 * Mission Complete. Purely presentational and idempotent: re-opening the page
 * shows this state again, without replaying the celebration or touching the backend.
 */
export function CompleteView({ m, compact = false }: { m: MissionView; compact?: boolean }) {
  const reduce = useReducedMotion();
  const played = useRef(false);
  useEffect(() => {
    if (m.completedLive && !played.current) {
      played.current = true;
      sound.complete();
    }
  }, [m.completedLive]);
  if (!m.bundle) return null;
  const { clock, event } = m.bundle;
  const finishedAt = clock.completedAt ?? clock.endsAt;

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-6 text-center" data-phase="complete">
      <Backdrop intensity={compact ? "calm" : "full"} />
      {m.completedLive && <Celebration />}
      {!compact && <BrandLockup name={event.name} subtitle={event.subtitle} className="absolute left-[3vw] top-[2.6vh] z-10" />}
      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <BrandMark className="mb-[3vh] h-[clamp(3rem,8vh,6rem)] w-[clamp(3rem,8vh,6rem)]" />
        <div className="eyebrow mb-3 text-emerald-200/80">{event.name} · {event.subtitle}</div>
        <h1
          className="font-display text-[clamp(2.4rem,8vw,9rem)] font-bold leading-[0.95] tracking-[0.08em] text-white"
          style={{ textShadow: "0 0 60px hsl(152 80% 55% / 0.45)" }}
        >
          MISSION
          <br />
          COMPLETE
        </h1>
        <Countdown seconds={0} animate={false} label={false} className="mt-[3vh] text-[clamp(2rem,5vw,5.5rem)] text-emerald-100/90" />
        <div className="mt-[3vh] font-tech text-[clamp(0.75rem,1vw,1.1rem)] uppercase tracking-[0.3em] text-sky-100/60">
          Official finish · <span className="text-sky-50">{formatDateTime(finishedAt)}</span>
        </div>
        <div className="hairline mx-auto my-[4vh] w-[min(60vw,640px)]" />
        <p className="max-w-[48ch] text-balance font-display text-[clamp(1rem,2vw,2.2rem)] font-semibold leading-snug tracking-[0.14em] text-sky-50">
          {clock.closingMessage}
        </p>
      </motion.div>
    </div>
  );
}
