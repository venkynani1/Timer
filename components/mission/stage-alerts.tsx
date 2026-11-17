"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Snapshot } from "@/lib/timer/engine";
import { sound } from "@/lib/sound";
import { cn } from "@/lib/utils";

export interface StageAlert {
  id: string;
  title: string;
  detail?: string;
  tone: "info" | "major" | "critical";
}

const THRESHOLDS: Array<{ s: number; title: string; detail?: string; tone: StageAlert["tone"] }> = [
  { s: 3600, title: "THE FINAL HOUR HAS BEGUN", detail: "Final push mode engaged", tone: "major" },
  { s: 1800, title: "30 MINUTES REMAINING", tone: "info" },
  { s: 600, title: "FINAL COUNTDOWN", detail: "Ten minutes to mission end", tone: "critical" },
  { s: 300, title: "FIVE MINUTES TO GO", tone: "critical" },
];

/**
 * Raises one-off alerts when a threshold or milestone is *crossed live*.
 * Opening the page mid-way never replays past alerts.
 */
export function useStageAlerts(snapshot: Snapshot | null) {
  const [alert, setAlert] = useState<StageAlert | null>(null);
  const prev = useRef<{ secs: number; milestone: string | null } | null>(null);

  useEffect(() => {
    if (!snapshot || snapshot.state !== "RUNNING") {
      prev.current = snapshot ? { secs: snapshot.remainingSeconds, milestone: snapshot.currentMilestone?.id ?? null } : null;
      return;
    }
    const cur = { secs: snapshot.remainingSeconds, milestone: snapshot.currentMilestone?.id ?? null };
    const p = prev.current;
    prev.current = cur;
    if (!p || p.secs - cur.secs > 30 || p.secs < cur.secs) return; // first sample, or a jump

    const crossed = THRESHOLDS.find((t) => p.secs > t.s && cur.secs <= t.s);
    if (crossed) {
      setAlert({ id: `t${crossed.s}`, title: crossed.title, detail: crossed.detail, tone: crossed.tone });
      sound.chime();
      return;
    }
    if (p.milestone !== cur.milestone && snapshot.currentMilestone && snapshot.currentMilestone.offsetSeconds > 0) {
      const m = snapshot.currentMilestone;
      if (m.offsetSeconds * 1000 >= snapshot.durationMs) return; // completion handled elsewhere
      setAlert({ id: `m${m.id}`, title: m.title, detail: m.announcement ?? m.description, tone: "info" });
      sound.chime();
    }
  }, [snapshot]);

  useEffect(() => {
    if (!alert) return;
    const t = window.setTimeout(() => setAlert(null), alert.tone === "info" ? 9000 : 12000);
    return () => window.clearTimeout(t);
  }, [alert]);

  return alert;
}

export function StageBanner({ alert, className }: { alert: StageAlert | null; className?: string }) {
  return (
    <div className={cn("pointer-events-none flex justify-center", className)} aria-live="polite">
      <AnimatePresence>
        {alert && (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
            className={cn(
              "glass flex items-center gap-4 rounded-full px-6 py-2.5",
              alert.tone === "critical" && "border-red-400/40 bg-red-950/40",
              alert.tone === "major" && "border-orange-300/40 bg-orange-950/30",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                alert.tone === "critical" ? "bg-red-400 shadow-[0_0_12px_#f87171]" : alert.tone === "major" ? "bg-orange-300 shadow-[0_0_12px_#fdba74]" : "bg-cyan-300 shadow-[0_0_12px_#22e4ff]",
              )}
            />
            <span className="font-display text-[clamp(0.8rem,1.15vw,1.3rem)] font-semibold tracking-[0.28em] text-white">{alert.title}</span>
            {alert.detail && <span className="hidden font-sans text-[clamp(0.75rem,0.95vw,1.05rem)] text-sky-100/70 md:inline">{alert.detail}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
