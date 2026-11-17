"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import type { MissionView } from "@/hooks/use-mission";
import type { AnnouncementPriority } from "@/lib/timer/types";
import { activeAnnouncements } from "@/lib/timer/engine";
import { formatClockTime } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { adminFetch, Feedback, useAction } from "./api-client";
import { Field } from "./setup-panel";

const TEMPLATES = ["Mentor review begins in 15 minutes.", "Refreshments are now available.", "Final submission instructions have been published."];
const PRIORITIES: AnnouncementPriority[] = ["info", "normal", "high", "critical"];

export function AnnouncementsPanel({ m, slug }: { m: MissionView; slug: string }) {
  const b = m.bundle!;
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("normal");
  const [display, setDisplay] = useState(30);
  const [scheduleAt, setScheduleAt] = useState(""); // datetime-local
  const [expiresIn, setExpiresIn] = useState(""); // minutes
  const action = useAction();
  const cancel = useAction();

  const now = m.serverNow;
  const active = new Set(activeAnnouncements(b.announcements, now).map((a) => a.id));
  const list = [...b.announcements].sort((a, z) => z.publishAt - a.publishAt);

  const publish = () =>
    action.run(async () => {
      // Scheduled times are entered in local time, converted to UTC ISO; the server re-validates.
      const publishAt = scheduleAt ? new Date(scheduleAt).toISOString() : null;
      const base = publishAt ? new Date(publishAt).getTime() : m.now();
      const expiresAt = expiresIn ? new Date(base + Number(expiresIn) * 60_000).toISOString() : null;
      await adminFetch("/api/admin/timer/announcements", "POST", { event: slug, message, priority, displaySeconds: display, publishAt, expiresAt });
      setMessage("");
      setScheduleAt("");
      setExpiresIn("");
      m.refresh();
    }, scheduleAt ? "Announcement scheduled." : "Broadcast to all screens.");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Broadcast</CardTitle>
          <CardDescription>Appears on every projector and phone instantly. Never covers the countdown.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Message" hint={`${message.length}/280 · plain text only`}>
            <Textarea value={message} maxLength={280} onChange={(e) => setMessage(e.target.value)} placeholder="Mentor review begins in 15 minutes." />
          </Field>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button key={t} onClick={() => setMessage(t)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-sky-100/70 hover:border-cyan-300/40 hover:text-white">{t}</button>
            ))}
          </div>
          <Field label="Priority">
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  aria-pressed={priority === p}
                  className={cn("flex-1 rounded-md border px-2 py-2 font-tech text-xs uppercase tracking-[0.15em]", priority === p ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100" : "border-white/10 text-sky-100/60")}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Display (s)"><Input type="number" min={5} max={3600} value={display} onChange={(e) => setDisplay(Math.min(3600, Math.max(5, Number(e.target.value) || 5)))} /></Field>
            <Field label="Schedule (opt.)"><Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} /></Field>
            <Field label="Expires in (min)"><Input type="number" min={1} placeholder="—" value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)} /></Field>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={publish} disabled={!message.trim() || action.busy}><Send /> {scheduleAt ? "Schedule" : "Broadcast now"}</Button>
            <Feedback error={action.error} ok={action.ok} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Announcement log</CardTitle>
          <CardDescription>Last 48 hours. Expired items stay here for reference.</CardDescription>
        </CardHeader>
        <CardContent className="flex max-h-[520px] flex-col gap-2 overflow-y-auto">
          {list.length === 0 && <p className="text-sm text-sky-100/50">Nothing broadcast yet.</p>}
          {list.map((a) => {
            const status = a.cancelledAt ? "cancelled" : active.has(a.id) ? "live" : a.publishAt > now ? "scheduled" : "expired";
            return (
              <div key={a.id} className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={status === "live" ? "default" : status === "scheduled" ? "violet" : "muted"}>{status}</Badge>
                    <Badge variant={a.priority === "critical" ? "danger" : a.priority === "high" ? "warning" : "muted"}>{a.priority}</Badge>
                    <span className="font-tech text-xs text-sky-100/50 tabular">{formatClockTime(a.publishAt, { seconds: true })}</span>
                  </div>
                  <p className={cn("mt-2 text-sm", a.cancelledAt ? "text-sky-100/40 line-through" : "text-sky-50")}>{a.message}</p>
                </div>
                {(status === "live" || status === "scheduled") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Withdraw announcement"
                    disabled={cancel.busy}
                    onClick={() => cancel.run(async () => { await adminFetch("/api/admin/timer/announcements", "DELETE", { event: slug, id: a.id }); m.refresh(); })}
                  >
                    <X /> Withdraw
                  </Button>
                )}
              </div>
            );
          })}
          <Feedback error={cancel.error} ok={null} />
        </CardContent>
      </Card>
    </div>
  );
}
