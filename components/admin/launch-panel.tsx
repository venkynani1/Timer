"use client";

import { useState } from "react";
import { Lock, Rocket, Loader2 } from "lucide-react";
import type { MissionView } from "@/hooks/use-mission";
import { Countdown } from "@/components/mission/countdown";
import { EnergyRing } from "@/components/mission/energy-ring";
import { stageLabel } from "@/components/mission/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDateTime, formatPercent } from "@/lib/format";
import { formatDuration } from "@/lib/timer/engine";
import { adminFetch, Feedback, useAction } from "./api-client";

export function LaunchPanel({ m, slug }: { m: MissionView; slug: string }) {
  const { bundle, snapshot } = m;
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const action = useAction();
  if (!bundle || !snapshot) return null;
  const { clock } = bundle;
  const ready = snapshot.state === "NOT_STARTED";

  const launch = async () => {
    const r = await action.run(() => adminFetch("/api/admin/timer/start", "POST", { event: slug, confirm: "LAUNCH" }), "Mission launched. All screens synchronised.");
    if (r) {
      setOpen(false);
      setPhrase("");
      m.refresh();
    }
  };

  return (
    <section className="glass grid gap-6 rounded-2xl p-5 md:grid-cols-[auto_1fr_auto] md:items-center md:p-6">
      <div className="mx-auto aspect-square w-40 md:w-44">
        <EnergyRing progress={ready ? 0 : snapshot.progress} milestones={bundle.milestones} durationSeconds={clock.durationSeconds} showTicks={false} />
      </div>
      <div className="min-w-0">
        <div className="eyebrow">{stageLabel(snapshot)} · {snapshot.currentMilestone?.title ?? "PRE-LAUNCH"}</div>
        <Countdown seconds={snapshot.remainingSeconds} className="glow-text mt-3 justify-start text-white" style={{ fontSize: "clamp(2.4rem, 6vw, 4.5rem)" }} />
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
          {[
            ["Official start", formatDateTime(clock.startedAt)],
            ["Official end", formatDateTime(clock.endsAt)],
            ["Elapsed", formatDuration(snapshot.elapsedMs)],
            ["Completed", `${formatPercent(snapshot.progress)}%`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="eyebrow text-[0.6rem]">{k}</dt>
              <dd className="mt-1 font-tech tabular text-sky-50">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-col items-stretch gap-3 md:w-64">
        {ready ? (
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="launch" size="xl" className="w-full">
                <Rocket className="!size-5" /> START MISSION
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Launch the official clock?</AlertDialogTitle>
                <AlertDialogDescription>
                  Mission control will commit the start time from the database clock and set the deadline to exactly{" "}
                  <strong className="text-sky-50">{formatDuration(clock.durationSeconds * 1000)}</strong> later. This cannot be paused, reset or
                  undone. Every connected screen will begin the launch sequence.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-2">
                <label htmlFor="launch-phrase" className="font-tech text-xs uppercase tracking-[0.2em] text-sky-100/70">
                  Type <span className="text-cyan-300">LAUNCH</span> to confirm
                </label>
                <Input id="launch-phrase" value={phrase} onChange={(e) => setPhrase(e.target.value.toUpperCase())} autoComplete="off" />
              </div>
              <Feedback error={action.error} ok={null} />
              <AlertDialogFooter>
                <AlertDialogCancel>Abort</AlertDialogCancel>
                <Button variant="launch" disabled={phrase !== "LAUNCH" || action.busy} onClick={launch}>
                  {action.busy ? <Loader2 className="animate-spin" /> : <Rocket />} Launch
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-sky-100/70">
            <Lock className="h-4 w-4 shrink-0 text-energy" />
            Start time and duration are locked. The mission clock cannot be paused or reset.
          </div>
        )}
        <Feedback error={open ? null : action.error} ok={action.ok} />
      </div>
    </section>
  );
}
