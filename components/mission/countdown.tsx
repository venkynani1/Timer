"use client";
import type React from "react";

import { memo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { splitTime } from "@/lib/timer/engine";
import { cn } from "@/lib/utils";

/**
 * HH : MM : SS with fixed-width digit cells, so nothing shifts as numbers
 * change regardless of the font's glyph widths.
 */
export function Countdown({
  seconds,
  className,
  animate = true,
  dimLeadingZeros = false,
  label = true,
  style,
}: {
  seconds: number;
  className?: string;
  animate?: boolean;
  dimLeadingZeros?: boolean;
  label?: boolean;
  style?: React.CSSProperties;
}) {
  const [h, m, s] = splitTime(seconds);
  const groups = [
    { v: h, l: "HRS" },
    { v: m, l: "MIN" },
    { v: s, l: "SEC" },
  ];
  const leadingZero = (i: number) => dimLeadingZeros && groups.slice(0, i + 1).every((g) => g.v === "00") && i < 2;
  return (
    <div
      className={cn("flex items-start justify-center font-display font-semibold leading-none tabular", className)}
      style={style}
      role="timer"
      aria-live="off"
      aria-label={`${Number(h)} hours ${Number(m)} minutes ${Number(s)} seconds remaining`}
    >
      {groups.map((g, i) => (
        <div key={g.l} className="flex items-start">
          {i > 0 && <Colon />}
          <div className={cn("flex flex-col items-center transition-opacity duration-700", leadingZero(i) && "opacity-30")}>
            <div className="flex">
              {g.v.split("").map((d, j) => (
                <Digit key={j} value={d} animate={animate} />
              ))}
            </div>
            {label && (
              <span className="mt-[0.14em] font-tech text-[0.11em] font-semibold tracking-[0.5em] text-sky-100/50">{g.l}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Colon() {
  return (
    <span aria-hidden className="mx-[0.04em] flex h-[1em] w-[0.34em] flex-col items-center justify-center gap-[0.2em] opacity-70">
      <span className="h-[0.09em] w-[0.09em] rounded-[1px] bg-current" />
      <span className="h-[0.09em] w-[0.09em] rounded-[1px] bg-current" />
    </span>
  );
}

const Digit = memo(function Digit({ value, animate }: { value: string; animate: boolean }) {
  const reduce = useReducedMotion();
  const still = !animate || reduce;
  return (
    <span className="relative inline-flex h-[1em] w-[0.72em] justify-center">
      {still ? (
        <span className="absolute inset-0 flex justify-center">{value}</span>
      ) : (
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: "-14%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "14%", opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
            className="absolute inset-0 flex justify-center"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      )}
    </span>
  );
});
