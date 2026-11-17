"use client";

import { useState } from "react";
import { Lock, Plus, Save, Trash2 } from "lucide-react";
import type { MissionView } from "@/hooks/use-mission";
import type { Milestone, MilestoneTheme } from "@/lib/timer/types";
import { formatOffset } from "@/lib/timer/engine";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MilestoneIcon, MILESTONE_ICONS } from "@/components/mission/milestone-icon";
import { adminFetch, Feedback, useAction } from "./api-client";
import { Field } from "./setup-panel";

const THEMES: MilestoneTheme[] = ["cyan", "blue", "violet", "amber", "orange", "red", "green"];

export function MilestonesPanel({ m, slug }: { m: MissionView; slug: string }) {
  const b = m.bundle!;
  const locked = b.clock.state !== "NOT_STARTED";
  const list = [...b.milestones].sort((a, z) => a.offsetSeconds - z.offsetSeconds);
  const [adding, setAdding] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">Mission milestones {locked && <Lock className="h-3.5 w-3.5 text-energy" />}</CardTitle>
          <CardDescription>
            {locked
              ? "Timing is locked after launch. You can still update titles, descriptions and announcement copy — the official deadline is never affected."
              : "Offsets are measured from the official start. Milestones never reset or alter the master clock."}
          </CardDescription>
        </div>
        {!locked && !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus /> Add</Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {adding && (
          <MilestoneRow
            slug={slug}
            locked={false}
            milestone={{ id: "", offsetSeconds: 0, title: "", description: "", icon: "orbit", theme: "cyan", announcement: null, enabled: true }}
            onDone={() => {
              setAdding(false);
              m.refresh();
            }}
            isNew
          />
        )}
        {list.map((ms) => (
          <MilestoneRow key={ms.id} slug={slug} locked={locked} milestone={ms} onDone={m.refresh} />
        ))}
      </CardContent>
    </Card>
  );
}

function MilestoneRow({ milestone, slug, locked, onDone, isNew = false }: { milestone: Milestone; slug: string; locked: boolean; onDone: () => void; isNew?: boolean }) {
  const [d, setD] = useState(milestone);
  const [hh, setHh] = useState(formatOffset(milestone.offsetSeconds));
  const action = useAction();
  const offset = parseOffset(hh);
  const dirty = isNew || JSON.stringify(d) !== JSON.stringify(milestone) || offset !== milestone.offsetSeconds;

  const save = () =>
    action.run(async () => {
      await adminFetch("/api/admin/timer/milestones", "POST", {
        event: slug,
        id: isNew ? null : d.id,
        offsetSeconds: locked ? null : offset,
        title: d.title,
        description: d.description,
        icon: d.icon,
        theme: d.theme,
        announcement: d.announcement || null,
        enabled: locked ? null : d.enabled,
      });
      onDone();
    }, "Saved.");

  const remove = () =>
    action.run(async () => {
      await adminFetch("/api/admin/timer/milestones", "DELETE", { event: slug, id: d.id });
      onDone();
    });

  return (
    <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 md:grid-cols-[110px_1fr_1.4fr_auto] md:items-end">
      <Field label="T+ hh:mm">
        <Input value={hh} disabled={locked} onChange={(e) => setHh(e.target.value)} aria-invalid={offset === null} className="font-tech tabular" />
      </Field>
      <Field label="Title">
        <div className="flex items-center gap-2">
          <MilestoneIcon name={d.icon} className="h-4 w-4 shrink-0 text-energy" />
          <Input value={d.title} maxLength={60} onChange={(e) => setD({ ...d, title: e.target.value.toUpperCase() })} />
        </div>
      </Field>
      <Field label="Description">
        <Input value={d.description} maxLength={280} onChange={(e) => setD({ ...d, description: e.target.value })} />
      </Field>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={!dirty || action.busy || offset === null || !d.title.trim()}><Save /> Save</Button>
        {!locked && !isNew && (
          <Button size="sm" variant="ghost" onClick={remove} aria-label="Delete milestone"><Trash2 /></Button>
        )}
      </div>
      <div className="grid gap-3 md:col-span-4 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
        <Field label="Announcement (shown when the phase begins)">
          <Input value={d.announcement ?? ""} maxLength={280} onChange={(e) => setD({ ...d, announcement: e.target.value })} />
        </Field>
        <Field label="Icon">
          <select value={d.icon ?? "orbit"} onChange={(e) => setD({ ...d, icon: e.target.value })} className="h-10 rounded-md border border-input bg-midnight-950/60 px-2 text-sm">
            {Object.keys(MILESTONE_ICONS).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Theme">
          <select value={d.theme ?? "cyan"} onChange={(e) => setD({ ...d, theme: e.target.value as MilestoneTheme })} className="h-10 rounded-md border border-input bg-midnight-950/60 px-2 text-sm">
            {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Enabled">
          <div className="flex h-10 items-center"><Switch checked={d.enabled} disabled={locked} onCheckedChange={(v) => setD({ ...d, enabled: v })} /></div>
        </Field>
      </div>
      <div className="md:col-span-4"><Feedback error={action.error} ok={action.ok} /></div>
    </div>
  );
}

function parseOffset(v: string): number | null {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(v.trim());
  if (!m) return null;
  const s = Number(m[1]) * 3600 + Number(m[2]) * 60;
  return s <= 172_800 ? s : null;
}
