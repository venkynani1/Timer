import { Wifi, WifiOff } from "lucide-react";
import type { ConnectionStatus } from "@/lib/timer/store";
import type { Snapshot } from "@/lib/timer/engine";
import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  standby: "AWAITING LAUNCH",
  mission: "MISSION LIVE",
  "final-hour": "FINAL PUSH",
  "final-countdown": "FINAL COUNTDOWN",
  "final-minute": "FINAL MINUTE",
  "final-seconds": "FINAL SECONDS",
  complete: "MISSION COMPLETE",
  hold: "EMERGENCY HOLD",
};

export function stageLabel(s: Snapshot | null) {
  return s ? LABEL[s.stage] : "CONNECTING";
}

/** Live status with a shape cue as well as colour (non-colour indicator). */
export function LiveStatus({ snapshot, className }: { snapshot: Snapshot | null; className?: string }) {
  const stage = snapshot?.stage ?? "standby";
  const live = stage !== "standby" && stage !== "complete" && stage !== "hold";
  return (
    <div className={cn("flex items-center gap-2.5 font-tech text-xs font-bold uppercase tracking-[0.3em]", className)}>
      <span className="relative flex h-3 w-3 items-center justify-center" aria-hidden>
        {live ? (
          <>
            <span className="pulse-soft absolute h-3 w-3 rounded-full bg-[hsl(var(--e1)/0.5)]" />
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--e1))]" />
          </>
        ) : stage === "complete" ? (
          <span className="h-2.5 w-2.5 rotate-45 bg-emerald-300" />
        ) : stage === "hold" ? (
          <span className="flex gap-[2px]"><span className="h-2.5 w-[3px] bg-amber-300" /><span className="h-2.5 w-[3px] bg-amber-300" /></span>
        ) : (
          <span className="h-2.5 w-2.5 rounded-full border-2 border-sky-300/70" />
        )}
      </span>
      <span className="text-sky-50">{stageLabel(snapshot)}</span>
    </div>
  );
}

export function ConnectionDot({ status, className }: { status: ConnectionStatus; className?: string }) {
  const ok = status === "live";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 font-tech text-[0.65rem] uppercase tracking-[0.25em]", ok ? "text-emerald-300/80" : "text-amber-300", className)}
      title={ok ? "Realtime connected" : "Realtime reconnecting — clock continues from last synchronised state"}
    >
      {ok ? <Wifi className="h-3.5 w-3.5" aria-hidden /> : <WifiOff className="h-3.5 w-3.5" aria-hidden />}
      {ok ? "SYNCED" : status === "connecting" ? "CONNECTING" : "RECONNECTING"}
    </span>
  );
}
