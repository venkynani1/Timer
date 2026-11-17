"use client";

import type { MissionView } from "@/hooks/use-mission";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export function HealthPanel({ m }: { m: MissionView }) {
  const h = m.health;
  const rows: Array<[string, string, boolean]> = [
    ["Realtime channel", m.status === "live" ? "Connected" : m.status, m.status === "live"],
    ["Server time sync", h?.synced ? "Synchronised" : "Pending", !!h?.synced],
    ["Round-trip latency", h?.rtt != null ? `${Math.round(h.rtt)} ms` : "—", (h?.rtt ?? 999) < 500],
    ["This device's clock error", h?.deviceSkew != null ? `${(h.deviceSkew / 1000).toFixed(2)} s (ignored)` : "—", true],
    ["Authoritative server time", m.serverNow ? formatDateTime(m.serverNow) : "—", true],
    ["Clock state version", String(m.bundle?.clock.version ?? "—"), true],
  ];
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Connection health</CardTitle>
          <CardDescription>
            Screens compute time from the committed deadline and server time, so a dropped connection never stops or resets the clock — it only delays
            announcements until reconnection.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={m.refresh}>Resync now</Button>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(([k, v, ok]) => (
            <div key={k} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <dt className="eyebrow text-[0.6rem]">{k}</dt>
              <dd className="mt-2 flex items-center gap-2 font-tech text-sm text-sky-50">
                <span className={ok ? "h-2 w-2 rounded-full bg-emerald-400" : "h-2 w-2 rotate-45 bg-amber-400"} aria-hidden />
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
