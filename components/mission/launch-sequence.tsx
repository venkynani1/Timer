"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { sound } from "@/lib/sound";

/**
 * 10-second cinematic launch. The step shown is derived from the time elapsed
 * since the *server-confirmed* start, so every screen plays it in lock-step and
 * the official clock is already running underneath (never delayed by this).
 */
const STEPS: Array<{ at: number; text: string; kind: "line" | "count" | "final" }> = [
  { at: 0, text: "MISSION CONTROL ONLINE", kind: "line" },
  { at: 1500, text: "SYSTEMS READY", kind: "line" },
  { at: 3000, text: "INNOVATION PROTOCOL ACTIVATED", kind: "line" },
  { at: 5000, text: "3", kind: "count" },
  { at: 6000, text: "2", kind: "count" },
  { at: 7000, text: "1", kind: "count" },
  { at: 8000, text: "MISSION STARTED", kind: "final" },
];

export function LaunchSequence({ elapsedMs, eventName }: { elapsedMs: number; eventName: string }) {
  const reduce = useReducedMotion();
  let idx = 0;
  for (let i = 0; i < STEPS.length; i++) if (elapsedMs >= STEPS[i].at) idx = i;
  const step = STEPS[idx];
  const lastPlayed = useRef(-1);

  useEffect(() => {
    if (lastPlayed.current === idx) return;
    lastPlayed.current = idx;
    if (step.kind === "count") sound.tick(false);
    if (step.kind === "final") sound.launch();
  }, [idx, step.kind]);

  const lines = STEPS.filter((s) => s.kind === "line" && elapsedMs >= s.at);

  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#01040c]/[0.97] backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8 } }}
      role="status"
      aria-live="assertive"
      aria-label={step.kind === "final" ? `${eventName} mission started` : step.text}
    >
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      <AnimatePresence mode="wait">
        {step.kind === "line" && (
          <motion.div key="lines" className="flex flex-col items-center gap-6" exit={{ opacity: 0, y: -20 }}>
            {lines.map((l) => (
              <motion.div
                key={l.text}
                initial={reduce ? { opacity: 0 } : { opacity: 0, letterSpacing: "0.9em", filter: "blur(8px)" }}
                animate={{ opacity: 1, letterSpacing: "0.35em", filter: "blur(0px)" }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="flex items-center gap-4 font-display text-[clamp(1rem,2.6vw,2.6rem)] font-semibold text-cyan-100"
              >
                <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_#22e4ff]" />
                {l.text}
              </motion.div>
            ))}
          </motion.div>
        )}
        {step.kind === "count" && (
          <motion.div
            key={step.text}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
            className="font-display text-[clamp(8rem,38vh,30rem)] font-bold leading-none text-white"
            style={{ textShadow: "0 0 60px rgba(34,228,255,.6)" }}
          >
            {step.text}
          </motion.div>
        )}
        {step.kind === "final" && (
          <motion.div
            key="final"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
            className="text-center"
          >
            <div className="font-display text-[clamp(2rem,6vw,6.5rem)] font-bold tracking-[0.18em] text-white" style={{ textShadow: "0 0 50px rgba(34,228,255,.55)" }}>
              {eventName}
            </div>
            <div className="mt-4 font-display text-[clamp(1.1rem,2.8vw,3rem)] font-semibold tracking-[0.5em] text-cyan-300">MISSION STARTED</div>
          </motion.div>
        )}
      </AnimatePresence>
      {!reduce && (
        <motion.div
          className="absolute bottom-[12vh] left-[30vw] h-[3px] w-[40vw] origin-left rounded-full bg-gradient-to-r from-cyan-300 to-violet-500"
          initial={{ scaleX: Math.min(1, elapsedMs / 10_000) }}
          animate={{ scaleX: 1 }}
          transition={{ duration: Math.max(0, (10_000 - elapsedMs) / 1000), ease: "linear" }}
        />
      )}
    </motion.div>
  );
}
