"use client";

import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";

function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
const SHARDS = Array.from({ length: 70 }, (_, i) => {
  const angle = rand(i) * Math.PI * 2;
  const dist = 25 + rand(i + 99) * 45;
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
    rot: rand(i + 7) * 540,
    hue: [189, 205, 262, 152, 45][i % 5],
    w: 4 + rand(i + 3) * 10,
    delay: rand(i + 5) * 0.35,
  };
});

/** One-shot celebration: expanding shockwave rings + energy shards. CSS/transform only. */
export const Celebration = memo(function Celebration() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {[0, 0.25, 0.5].map((d) => (
        <motion.div
          key={d}
          className="absolute left-1/2 top-1/2 h-[40vmin] w-[40vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-300/60"
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 2.4, delay: d, ease: "easeOut" }}
        />
      ))}
      {SHARDS.map((s, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 rounded-sm"
          style={{ width: s.w, height: s.w * 0.35, background: `hsl(${s.hue} 100% 65%)`, boxShadow: `0 0 10px hsl(${s.hue} 100% 60%)` }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: `${s.x}vw`, y: `${s.y}vh`, opacity: 0, rotate: s.rot }}
          transition={{ duration: 3.2, delay: s.delay, ease: [0.1, 0.6, 0.3, 1] }}
        />
      ))}
    </div>
  );
});
