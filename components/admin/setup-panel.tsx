"use client";

import { useEffect, useState } from "react";
import { Lock, Save } from "lucide-react";
import type { MissionView } from "@/hooks/use-mission";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminFetch, Feedback, useAction } from "./api-client";

export function SetupPanel({ m, slug }: { m: MissionView; slug: string }) {
  const b = m.bundle!;
  const locked = b.clock.state !== "NOT_STARTED";
  const [name, setName] = useState(b.event.name);
  const [subtitle, setSubtitle] = useState(b.event.subtitle);
  const [tagline, setTagline] = useState(b.event.tagline);
  const [hours, setHours] = useState(Math.floor(b.clock.durationSeconds / 3600));
  const [minutes, setMinutes] = useState(Math.floor((b.clock.durationSeconds % 3600) / 60));
  const [closing, setClosing] = useState(b.clock.closingMessage);
  const action = useAction();

  useEffect(() => {
    setHours(Math.floor(b.clock.durationSeconds / 3600));
    setMinutes(Math.floor((b.clock.durationSeconds % 3600) / 60));
  }, [b.clock.durationSeconds]);

  const duration = hours * 3600 + minutes * 60;
  const save = () =>
    action.run(async () => {
      await adminFetch("/api/admin/timer/configure", "POST", {
        event: slug,
        name,
        subtitle,
        tagline,
        closingMessage: closing,
        ...(locked ? {} : { durationSeconds: duration }),
      });
      m.refresh();
    }, "Configuration saved.");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Event identity</CardTitle>
          <CardDescription>Shared Designathon X branding shown on every screen. Editable at any time.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Event name"><Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Title"><Input value={subtitle} maxLength={60} onChange={(e) => setSubtitle(e.target.value)} /></Field>
          <Field label="Tagline"><Input value={tagline} maxLength={140} onChange={(e) => setTagline(e.target.value)} /></Field>
          <Field label="Closing message"><Textarea value={closing} maxLength={200} onChange={(e) => setClosing(e.target.value)} /></Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Mission duration {locked && <Lock className="h-3.5 w-3.5 text-energy" />}</CardTitle>
          <CardDescription>
            {locked ? "Locked at launch. The official deadline can only change through an audited emergency override." : "Configure before launch. Default is exactly 12 hours (43,200 s)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Hours"><Input type="number" min={0} max={48} value={hours} disabled={locked} onChange={(e) => setHours(clamp(+e.target.value, 0, 48))} /></Field>
            <Field label="Minutes"><Input type="number" min={0} max={59} value={minutes} disabled={locked} onChange={(e) => setMinutes(clamp(+e.target.value, 0, 59))} /></Field>
          </div>
          <p className="font-tech text-xs tracking-[0.15em] text-sky-100/60">= {duration.toLocaleString()} seconds</p>
          {!locked && (
            <div className="flex gap-2">
              {[12, 6, 1].map((h) => (
                <Button key={h} variant="outline" size="sm" onClick={() => { setHours(h); setMinutes(0); }}>{h}h</Button>
              ))}
            </div>
          )}
          <div className="mt-auto flex items-center gap-4 pt-4">
            <Button onClick={save} disabled={action.busy || (!locked && (duration < 60 || duration > 172800))}>
              <Save /> Save configuration
            </Button>
            <Feedback error={action.error} ok={action.ok} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : lo);

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-sky-100/50">{hint}</p>}
    </div>
  );
}
