"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { adminFetch, Feedback, useAction } from "./api-client";

interface Entry { id: number; actor_id: string | null; action: string; reason: string | null; details: Record<string, unknown>; created_at: string }

export function AuditPanel({ slug, version }: { slug: string; version: number }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const action = useAction();
  const { run } = action;
  useEffect(() => {
    void run(async () => setEntries((await adminFetch<{ entries: Entry[] }>(`/api/admin/timer/audit?event=${slug}`, "GET")).entries));
  }, [slug, version, run]);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Timer activity log</CardTitle>
          <CardDescription>Append-only. Entries cannot be edited or deleted, even by administrators.</CardDescription>
        </div>
        <Button variant="outline" size="sm" disabled={action.busy} onClick={() => run(async () => setEntries((await adminFetch<{ entries: Entry[] }>(`/api/admin/timer/audit?event=${slug}`, "GET")).entries))}>
          <RefreshCw className={action.busy ? "animate-spin" : ""} /> Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <Feedback error={action.error} ok={null} />
        <div className="max-h-[560px] overflow-y-auto rounded-lg border border-white/5">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-midnight-900/95 font-tech text-[0.65rem] uppercase tracking-[0.2em] text-sky-100/50">
              <tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Details</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-white/5 align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-tech text-xs text-sky-100/70 tabular">{formatDateTime(new Date(e.created_at).getTime())}</td>
                  <td className="px-3 py-2">
                    <Badge variant={e.action.startsWith("EMERGENCY") || e.action.startsWith("OVERRIDE") ? "danger" : e.action === "MISSION_STARTED" ? "default" : e.action === "MISSION_COMPLETED" ? "success" : "muted"}>
                      {e.action.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-sky-100/50">{e.actor_id ? e.actor_id.slice(0, 8) : "system"}</td>
                  <td className="px-3 py-2 text-xs text-sky-100/70">
                    {e.reason && <div className="mb-1 text-amber-200">Reason: {e.reason}</div>}
                    <code className="break-all text-[0.7rem] text-sky-100/50">{JSON.stringify(e.details)}</code>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && !action.busy && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-sky-100/50">No activity yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
