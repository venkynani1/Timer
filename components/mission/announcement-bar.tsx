"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Megaphone } from "lucide-react";
import type { Announcement } from "@/lib/timer/types";
import { cn } from "@/lib/utils";

const TONE: Record<Announcement["priority"], string> = {
  info: "text-sky-200 border-sky-300/20",
  normal: "text-cyan-200 border-cyan-300/25",
  high: "text-amber-200 border-amber-300/40",
  critical: "text-red-200 border-red-400/50",
};

/**
 * Elegant announcement band. Rotates through active announcements (highest
 * priority first). Lives in its own layout row, so it never covers the clock.
 */
export function AnnouncementBar({ items, className, size = "lg" }: { items: Announcement[]; className?: string; size?: "lg" | "sm" }) {
  const [i, setI] = useState(0);
  const key = items.map((a) => a.id).join(",");
  const count = items.length;
  useEffect(() => {
    setI(0);
    if (count < 2) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % count), 8000);
    return () => window.clearInterval(t);
  }, [key, count]);
  const a = items[i % Math.max(1, items.length)];

  return (
    <div className={cn("flex min-h-[3.25rem] items-center justify-center", className)} aria-live="polite">
      <AnimatePresence mode="wait">
        {a && (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            className={cn(
              "glass flex max-w-[min(92vw,1400px)] items-center gap-4 rounded-2xl border px-5",
              size === "lg" ? "py-3" : "py-2.5",
              TONE[a.priority],
              a.priority === "critical" && "bg-red-950/40",
            )}
          >
            <span className="flex shrink-0 items-center gap-2 font-tech text-[0.7rem] font-bold uppercase tracking-[0.3em]">
              <Megaphone className="h-4 w-4" aria-hidden /> {a.priority === "critical" ? "Priority" : "Announcement"}
            </span>
            <span className="h-5 w-px bg-white/15" />
            <span className={cn("font-sans font-medium text-white", size === "lg" ? "text-[clamp(1rem,1.45vw,1.65rem)]" : "text-sm")}>{a.message}</span>
            {items.length > 1 && <span className="ml-1 shrink-0 font-tech text-xs text-white/40">{(i % items.length) + 1}/{items.length}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
