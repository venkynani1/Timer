"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Snapshot } from "@/lib/timer/engine";
import { sound } from "@/lib/sound";

/**
 * Last 60 seconds: the ring steps aside, the seconds take the whole screen.
 * Last 10 seconds: giant animated numerals (scale-in, no flashing) + optional ticks.
 */
export function FinalMinute({ snapshot }: { snapshot: Snapshot }) {
  const reduce = useReducedMotion();
  const secs = snapshot.remainingSeconds;
  const lastTick = useRef<number | null>(null);
  const finalSeconds = snapshot.stage === "final-seconds";

  useEffect(() => {
    if (!finalSeconds || lastTick.current === secs || secs <= 0) return;
    lastTick.current = secs;
    sound.tick(secs <= 3);
  }, [secs, finalSeconds]);

  const frac = Math.max(0, Math.min(1, snapshot.remainingMs / 60_000));

  return (
    <main className="relative z-10 flex flex-col items-center justify-center" role="timer" aria-label={`${secs} seconds remaining`}>
      <div className="eyebrow mb-[2vh] text-[clamp(0.8rem,1.2vw,1.4rem)] text-red-200/80">
        {finalSeconds ? "Final seconds" : "Final minute"}
      </div>
      <div className="relative flex h-[58vh] items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={finalSeconds ? secs : "final-minute"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: finalSeconds ? 1.35 : 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: finalSeconds ? 0.82 : 0.98 }}
            transition={{ duration: finalSeconds ? 0.55 : 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            className="font-display font-bold leading-none tabular text-white"
            style={{
              fontSize: finalSeconds ? "min(58vh, 46vw)" : "min(44vh, 40vw)",
              textShadow: "0 0 80px hsl(0 100% 62% / 0.55), 0 0 4px hsl(0 100% 80% / 0.9)",
            }}
          >
            {finalSeconds ? secs : `00:${String(secs).padStart(2, "0")}`}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-[3vh] h-[4px] w-[min(70vw,1100px)] overflow-hidden rounded-full bg-red-300/10">
        <div
          className="h-full origin-left rounded-full bg-gradient-to-r from-red-500 to-orange-400 shadow-[0_0_18px_rgba(248,113,113,.8)] transition-transform duration-1000 ease-linear"
          style={{ transform: `scaleX(${frac})` }}
        />
      </div>
    </main>
  );
}
