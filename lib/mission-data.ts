import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapAnnouncement, mapClock, mapEvent, mapMilestone } from "@/lib/timer/mappers";
import type { MissionBundle } from "@/lib/timer/types";

export class NotFoundError extends Error {}

/**
 * Loads the full authoritative mission bundle. If the deadline has passed,
 * persists completion first (idempotent), so the DB record reflects reality
 * even when nobody was watching.
 */
export async function loadMission(supabase: SupabaseClient, slug: string): Promise<MissionBundle> {
  const { data: event, error: evErr } = await supabase
    .from("events")
    .select("id, slug, name, subtitle, tagline")
    .eq("slug", slug)
    .maybeSingle();
  if (evErr) throw evErr;
  if (!event) throw new NotFoundError(`Unknown event: ${slug}`);

  const [clockRes, msRes, anRes] = await Promise.all([
    supabase.from("mission_clock").select("*").eq("event_id", event.id).maybeSingle(),
    supabase.from("timer_milestones").select("*").eq("event_id", event.id).order("offset_seconds"),
    supabase
      .from("timer_announcements")
      .select("*")
      .eq("event_id", event.id)
      .gte("created_at", new Date(Date.now() - 48 * 3600_000).toISOString())
      .order("publish_at", { ascending: false })
      .limit(50),
  ]);
  if (clockRes.error) throw clockRes.error;
  if (!clockRes.data) throw new NotFoundError("Mission clock is not configured for this event");

  let clockRow = clockRes.data;
  // Effective state says COMPLETED but the stored row may still say RUNNING: persist it.
  if (clockRow.state === "COMPLETED" && clockRow.completed_at && !clockRow.held_at) {
    const raw = await supabase.from("event_timers").select("state").eq("event_id", event.id).maybeSingle();
    if (raw.data?.state === "RUNNING") {
      const fin = await supabase.rpc("finalize_mission", { p_event_id: event.id }).maybeSingle();
      if (!fin.error && fin.data) clockRow = fin.data;
    }
  }
  if (msRes.error) throw msRes.error;
  if (anRes.error) throw anRes.error;

  return {
    event: mapEvent(event),
    clock: mapClock(clockRow),
    milestones: (msRes.data ?? []).map(mapMilestone),
    announcements: (anRes.data ?? []).map(mapAnnouncement),
    serverNow: new Date(clockRow.server_now).getTime(),
  };
}
