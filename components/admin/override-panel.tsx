"use client";

import { useState } from "react";
import { ShieldAlert, Loader2, RotateCcw } from "lucide-react";
import type { MissionView } from "@/hooks/use-mission";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminFetch, Feedback, useAction } from "./api-client";
import { Field } from "./setup-panel";
import type { StaffRole } from "./dashboard";

type Pending =
  | { kind: "override"; action: "HOLD" | "RESUME" | "ADJUST"; delta?: number }
  | { kind: "arm"; enabled: boolean }
  | { kind: "reset" };

/**
 * Emergency override — disabled by default. Every action requires password
 * re-entry, a written reason and explicit confirmation, and is audited.
 */
export function OverridePanel({ m, slug, role }: { m: MissionView; slug: string; role: StaffRole }) {
  const clock = m.bundle!.clock;
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [delta, setDelta] = useState(10);
  const [confirmText, setConfirmText] = useState("");
  const action = useAction();
  const state = clock.state;

  const submit = async () => {
    if (!pending) return;
    const r = await action.run(async () => {
      if (pending.kind === "arm") {
        await adminFetch("/api/admin/timer/arm", "POST", { event: slug, enabled: pending.enabled, reason, password });
      } else if (pending.kind === "reset") {
        await adminFetch("/api/admin/timer/reset", "POST", { event: slug, confirm: "RESET", reason, password });
      } else {
        await adminFetch("/api/admin/timer/override", "POST", { event: slug, action: pending.action, deltaSeconds: pending.delta ?? null, reason, password });
      }
      return true;
    }, pending.kind === "reset" ? "Mission reset to a fresh clock. Recorded in the audit log." : "Override applied and recorded in the audit log.");
    setPassword("");
    if (r) {
      setPending(null);
      setReason("");
      setConfirmText("");
      m.refresh();
    }
  };

  return (
    <Card className="border-red-400/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-100"><ShieldAlert className="h-4 w-4" /> Emergency override</CardTitle>
        <CardDescription>
          For genuine emergencies only (evacuation, venue power loss). Requires re-authentication, a reason and confirmation. Every action is permanently audited and
          visible to all staff.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="eyebrow">Status</span>
          {clock.overrideEnabled ? <Badge variant="danger">Armed</Badge> : <Badge variant="muted">Disarmed (default)</Badge>}
          {role === "owner" && (
            <Button variant="outline" size="sm" onClick={() => setPending({ kind: "arm", enabled: !clock.overrideEnabled })}>
              {clock.overrideEnabled ? "Disarm" : "Arm override"}
            </Button>
          )}
        </div>
        {!clock.overrideEnabled && role !== "owner" && <p className="text-sm text-sky-100/60">An event owner must arm the override before it can be used.</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Button variant="destructive" disabled={!clock.overrideEnabled || state !== "RUNNING"} onClick={() => setPending({ kind: "override", action: "HOLD" })}>
            Hold clock
          </Button>
          <Button variant="outline" disabled={!clock.overrideEnabled || state !== "EMERGENCY_OVERRIDE"} onClick={() => setPending({ kind: "override", action: "RESUME" })}>
            Resume clock
          </Button>
          <div className="flex gap-2">
            <Input type="number" min={-60} max={120} value={delta} onChange={(e) => setDelta(Number(e.target.value))} aria-label="Minutes to adjust" className="w-24" />
            <Button
              variant="outline"
              className="flex-1"
              disabled={!clock.overrideEnabled || !(state === "RUNNING" || state === "EMERGENCY_OVERRIDE") || !delta || delta < -60 || delta > 120}
              onClick={() => setPending({ kind: "override", action: "ADJUST", delta: delta * 60 })}
            >
              Adjust (min)
            </Button>
          </div>
        </div>
        {role === "owner" && (
          <div className="flex flex-col gap-3 rounded-xl border border-red-400/20 bg-red-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-display text-xs font-semibold tracking-[0.2em] text-red-100">Reset mission</div>
              <div className="mt-1 text-xs text-sky-100/60">
                Returns the clock to a fresh, un-launched {Math.round(clock.durationSeconds / 360) / 10}-hour mission. Milestones, announcements and settings
                are kept. For rehearsals or a mistaken launch only. Requires the override to be armed, and disarms it afterwards.
              </div>
            </div>
            <Button
              variant="destructive"
              className="shrink-0"
              disabled={!clock.overrideEnabled || state === "NOT_STARTED"}
              onClick={() => setPending({ kind: "reset" })}
            >
              <RotateCcw /> Reset mission
            </Button>
          </div>
        )}
        <Feedback error={pending ? null : action.error} ok={action.ok} />
      </CardContent>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="border-red-400/30">
          <DialogHeader>
            <DialogTitle className="text-red-100">
              {pending?.kind === "arm"
                ? pending.enabled
                  ? "Arm emergency override"
                  : "Disarm emergency override"
                : pending?.kind === "reset"
                  ? "Reset the mission clock"
                  : `Emergency ${pending?.action}`}
              {pending?.kind === "override" && pending.action === "ADJUST" && ` ${pending.delta! > 0 ? "+" : ""}${pending.delta! / 60} min`}
            </DialogTitle>
            <DialogDescription>
              {pending?.kind === "reset"
                ? "Every screen returns to AWAITING LAUNCH and the official start and deadline are erased. This cannot be undone."
                : "This changes official mission state. Confirm your identity and record why."}
            </DialogDescription>
          </DialogHeader>
          {pending?.kind === "reset" && (
            <Field label="Type RESET to confirm">
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value.toUpperCase())} autoComplete="off" />
            </Field>
          )}
          <Field label="Reason (min. 10 characters)">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
          <Field label="Re-enter your password">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Feedback error={action.error} ok={null} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button variant="destructive" disabled={reason.trim().length < 10 || !password || action.busy || (pending?.kind === "reset" && confirmText !== "RESET")} onClick={submit}>
              {action.busy && <Loader2 className="animate-spin" />} Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
