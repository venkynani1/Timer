"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { adminFetch, Feedback, useAction } from "./api-client";

const MODULES = [
  { key: "problem_statement_arena", title: "Problem Statement Arena", body: "Close problem-statement selection at the mission deadline." },
  { key: "goodies_selection_arena", title: "Goodies Selection Arena", body: "Close goodies selection at the mission deadline." },
  { key: "submissions", title: "Submissions", body: "Close project submissions at the mission deadline." },
];

export function IntegrationsPanel({ slug }: { slug: string }) {
  const [state, setState] = useState<Record<string, boolean>>({});
  const action = useAction();
  const { run } = action;
  const load = useCallback(
    () => run(async () => {
      const r = await adminFetch<{ integrations: Array<{ module_key: string; close_on_deadline: boolean }> }>(`/api/admin/timer/integrations?event=${slug}`, "GET");
      setState(Object.fromEntries(r.integrations.map((i) => [i.module_key, i.close_on_deadline])));
    }),
    [run, slug],
  );
  useEffect(() => void load(), [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Module integrations</CardTitle>
        <CardDescription>
          Off by default: the timer never opens or closes other modules unless you enable it here. When enabled, the deadline is enforced in the database via{" "}
          <code className="text-cyan-200">public.is_module_open()</code>, not by a browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {MODULES.map((mod) => (
          <div key={mod.key} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div>
              <div className="font-display text-xs font-semibold tracking-[0.2em]">{mod.title}</div>
              <div className="mt-1 text-xs text-sky-100/60">{mod.body}</div>
              <code className="mt-1 block text-[0.7rem] text-sky-100/40">GET /api/integrations/module-status?module={mod.key}</code>
            </div>
            <Switch
              checked={!!state[mod.key]}
              disabled={action.busy}
              aria-label={`Close ${mod.title} at deadline`}
              onCheckedChange={(v) =>
                run(async () => {
                  await adminFetch("/api/admin/timer/integrations", "POST", { event: slug, moduleKey: mod.key, closeOnDeadline: v });
                  setState((s) => ({ ...s, [mod.key]: v }));
                }, "Integration updated.")
              }
            />
          </div>
        ))}
        <Feedback error={action.error} ok={action.ok} />
      </CardContent>
    </Card>
  );
}
