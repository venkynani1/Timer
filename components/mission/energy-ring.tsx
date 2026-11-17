"use client";

import { memo, useId } from "react";
import type { Milestone } from "@/lib/timer/types";
import { cn } from "@/lib/utils";

const R = 440;
const TICKS = 144; // one every 5 minutes of a 12h mission
const tickAngles = Array.from({ length: TICKS }, (_, i) => i / TICKS);

/**
 * The 12-hour energy ring. The arc is the *remaining* energy: it starts fully
 * charged and drains clockwise from 12 o'clock like a clock hand sweeping.
 * Only stroke offsets change (once per second, CSS-transitioned), so it's cheap.
 */
export const EnergyRing = memo(function EnergyRing({
  progress,
  milestones,
  durationSeconds,
  className,
  pulse = false,
  showTicks = true,
}: {
  progress: number;
  milestones: Milestone[];
  durationSeconds: number;
  className?: string;
  pulse?: boolean;
  showTicks?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const p = Math.min(1, Math.max(0, progress));
  const remaining = 1 - p;
  const handAngle = p * 360 - 90;
  const hx = 500 + R * Math.cos((handAngle * Math.PI) / 180);
  const hy = 500 + R * Math.sin((handAngle * Math.PI) / 180);

  return (
    <svg viewBox="0 0 1000 1000" className={cn("h-full w-full overflow-visible", className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="hsl(var(--e1))" />
          <stop offset="1" stopColor="hsl(var(--e2))" />
        </linearGradient>
        <radialGradient id={`${id}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0.55" stopColor="hsl(var(--e-glow) / 0)" />
          <stop offset="0.86" stopColor="hsl(var(--e-glow) / 0.10)" />
          <stop offset="1" stopColor="hsl(var(--e-glow) / 0)" />
        </radialGradient>
        <filter id={`${id}-blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      {/* inner atmosphere */}
      <circle cx="500" cy="500" r="490" fill={`url(#${id}-core)`} />
      <circle cx="500" cy="500" r="372" fill="hsl(224 80% 4% / 0.55)" />

      {/* decorative orbit rings */}
      <g className="ring-spin" opacity="0.5">
        <circle cx="500" cy="500" r="486" fill="none" stroke="hsl(var(--e1) / 0.35)" strokeWidth="1.5" strokeDasharray="2 14" />
      </g>
      <g className="ring-spin-rev" opacity="0.6">
        <circle cx="500" cy="500" r="384" fill="none" stroke="hsl(var(--e2) / 0.35)" strokeWidth="1" strokeDasharray="60 22 4 22" />
      </g>

      {/* 5-minute ticks; major tick each hour */}
      {showTicks && (
        <g>
          {tickAngles.map((t, i) => {
            const major = i % 12 === 0;
            const a = (t * 360 - 90) * (Math.PI / 180);
            const r1 = major ? 404 : 410;
            const r2 = 418;
            const spent = t < p;
            return (
              <line
                key={i}
                x1={500 + r1 * Math.cos(a)}
                y1={500 + r1 * Math.sin(a)}
                x2={500 + r2 * Math.cos(a)}
                y2={500 + r2 * Math.sin(a)}
                stroke={spent ? "hsl(215 30% 40% / 0.35)" : major ? "hsl(var(--e1) / 0.95)" : "hsl(var(--e1) / 0.45)"}
                strokeWidth={major ? 3 : 1.5}
              />
            );
          })}
        </g>
      )}

      {/* track */}
      <circle cx="500" cy="500" r={R} fill="none" stroke="hsl(215 50% 30% / 0.28)" strokeWidth="22" />

      {/* glow + energy arc (remaining) */}
      <g transform="rotate(-90 500 500)">
        <circle
          cx="500" cy="500" r={R} fill="none"
          stroke={`url(#${id}-g)`} strokeWidth="26" strokeLinecap="round"
          pathLength={1} strokeDasharray={`${remaining} 1`} strokeDashoffset={-p}
          filter={`url(#${id}-blur)`} opacity={0.75}
          className={cn("transition-[stroke-dasharray,stroke-dashoffset] duration-1000 ease-linear", pulse && "pulse-soft")}
        />
        <circle
          cx="500" cy="500" r={R} fill="none"
          stroke={`url(#${id}-g)`} strokeWidth="16" strokeLinecap="round"
          pathLength={1} strokeDasharray={`${remaining} 1`} strokeDashoffset={-p}
          className="transition-[stroke-dasharray,stroke-dashoffset] duration-1000 ease-linear"
        />
        {/* bright inner filament */}
        <circle
          cx="500" cy="500" r={R} fill="none"
          stroke="hsl(190 100% 92% / 0.55)" strokeWidth="2.5"
          pathLength={1} strokeDasharray={`${remaining} 1`} strokeDashoffset={-p}
          className="transition-[stroke-dasharray,stroke-dashoffset] duration-1000 ease-linear"
        />
      </g>

      {/* milestone markers */}
      {milestones.map((m) => {
        const t = Math.min(1, m.offsetSeconds / durationSeconds);
        if (t <= 0 || t >= 1) return null;
        const a = (t * 360 - 90) * (Math.PI / 180);
        const x = 500 + 470 * Math.cos(a);
        const y = 500 + 470 * Math.sin(a);
        const passed = t <= p;
        return (
          <g key={m.id} transform={`translate(${x} ${y}) rotate(${t * 360})`}>
            <rect
              x="-7" y="-7" width="14" height="14" transform="rotate(45)"
              fill={passed ? "hsl(215 30% 35%)" : "hsl(var(--e1))"}
              stroke="hsl(222 80% 5%)" strokeWidth="3"
            />
          </g>
        );
      })}

      {/* leading edge */}
      {p > 0 && p < 1 && (
        <g className="transition-transform duration-1000 ease-linear">
          <circle cx={hx} cy={hy} r="22" fill="hsl(var(--e-glow) / 0.25)" filter={`url(#${id}-blur)`} />
          <circle cx={hx} cy={hy} r="9" fill="hsl(190 100% 95%)" />
        </g>
      )}
    </svg>
  );
});
