"use client";

import { Activity, Clock, Megaphone, ListChecks, MonitorPlay, History, ShieldAlert, Puzzle, LogOut } from "lucide-react";
import { useMission } from "@/hooks/use-mission";
import type { SimulationConfig } from "@/lib/timer/simulation";
import { Backdrop } from "@/components/mission/backdrop";
import { BrandLockup } from "@/components/mission/brand";
import { ConnectionDot } from "@/components/mission/status";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LaunchPanel } from "./launch-panel";
import { SetupPanel } from "./setup-panel";
import { DisplayPanel } from "./display-panel";
import { MilestonesPanel } from "./milestones-panel";
import { AnnouncementsPanel } from "./announcements-panel";
import { AuditPanel } from "./audit-panel";
import { OverridePanel } from "./override-panel";
import { IntegrationsPanel } from "./integrations-panel";
import { HealthPanel } from "./health-panel";

export type StaffRole = "host" | "override_admin" | "owner";

export function AdminDashboard({ slug, role, email, simulation = null }: { slug: string; role: StaffRole; email: string; simulation?: SimulationConfig | null }) {
  const m = useMission(slug, simulation);
  const state = m.snapshot?.state;
  const stateBadge =
    state === "RUNNING" ? <Badge>● Running</Badge> : state === "COMPLETED" ? <Badge variant="success">◆ Completed</Badge> : state === "EMERGENCY_OVERRIDE" ? <Badge variant="warning">❚❚ Emergency hold</Badge> : <Badge variant="muted">○ Ready</Badge>;

  return (
    <div data-phase={m.snapshot?.phase ?? "standby"} className="relative min-h-[100dvh]">
      <Backdrop intensity="calm" />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <BrandLockup name={m.bundle?.event.name ?? "DESIGNATHON X"} subtitle="MISSION CONTROL" />
          <div className="flex flex-wrap items-center gap-3">
            {stateBadge}
            <ConnectionDot status={m.status} />
            <Badge variant="violet">{role.replace("_", " ")}</Badge>
            <span className="hidden text-xs text-sky-100/50 sm:inline">{email}</span>
            <form action="/auth/signout" method="post">
              <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-sky-100/60 hover:text-white" aria-label="Sign out">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </form>
          </div>
        </header>

        {m.error && !m.bundle && <p className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{m.error}</p>}

        {m.bundle && m.snapshot && (
          <>
            <LaunchPanel m={m} slug={slug} />
            <Tabs defaultValue={state === "NOT_STARTED" ? "setup" : "broadcast"}>
              <TabsList className="flex w-full flex-wrap justify-start">
                <TabsTrigger value="setup"><Clock /> Setup</TabsTrigger>
                <TabsTrigger value="broadcast"><Megaphone /> Announcements</TabsTrigger>
                <TabsTrigger value="milestones"><ListChecks /> Milestones</TabsTrigger>
                <TabsTrigger value="display"><MonitorPlay /> Display</TabsTrigger>
                <TabsTrigger value="health"><Activity /> Health</TabsTrigger>
                <TabsTrigger value="integrations"><Puzzle /> Integrations</TabsTrigger>
                <TabsTrigger value="audit"><History /> Activity log</TabsTrigger>
                {role !== "host" && <TabsTrigger value="override"><ShieldAlert /> Override</TabsTrigger>}
              </TabsList>
              <TabsContent value="setup"><SetupPanel m={m} slug={slug} /></TabsContent>
              <TabsContent value="broadcast"><AnnouncementsPanel m={m} slug={slug} /></TabsContent>
              <TabsContent value="milestones"><MilestonesPanel m={m} slug={slug} /></TabsContent>
              <TabsContent value="display"><DisplayPanel m={m} slug={slug} /></TabsContent>
              <TabsContent value="health"><HealthPanel m={m} /></TabsContent>
              <TabsContent value="integrations"><IntegrationsPanel slug={slug} /></TabsContent>
              <TabsContent value="audit"><AuditPanel slug={slug} version={m.bundle.clock.version} /></TabsContent>
              {role !== "host" && <TabsContent value="override"><OverridePanel m={m} slug={slug} role={role} /></TabsContent>}
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
