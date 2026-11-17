"use client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { mapAnnouncement, mapClock } from "./mappers";
import type { Transport } from "./store";
import type { MissionBundle } from "./types";

/**
 * Supabase-backed transport: authoritative loads go through /api/timer/state
 * (which also persists completion), realtime changes come from Postgres
 * changes on the mission tables, filtered to this event.
 */
export function supabaseTransport(slug: string): Transport {
  let eventId: string | null = null;
  return {
    load: async () => {
      const res = await fetch(`/api/timer/state?event=${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to load mission (${res.status})`);
      }
      const bundle = (await res.json()) as MissionBundle;
      eventId = bundle.event.id;
      return bundle;
    },
    subscribe: (h) => {
      if (!eventId) return () => {};
      const supabase = getBrowserSupabase();
      const filter = `event_id=eq.${eventId}`;
      const channel: RealtimeChannel = supabase
        .channel(`mission:${eventId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "event_timers", filter }, (p) => {
          if (p.new && "state" in p.new) h.onClock(mapClock(p.new));
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "timer_milestones", filter }, () => h.onMilestones())
        .on("postgres_changes", { event: "*", schema: "public", table: "timer_announcements", filter }, (p) => {
          if (p.new && "message" in p.new) h.onAnnouncement(mapAnnouncement(p.new));
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${eventId}` }, () => h.onEvent())
        .subscribe((status) => {
          if (status === "SUBSCRIBED") h.onStatus("live");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") h.onStatus("down");
        });
      return () => {
        void supabase.removeChannel(channel);
      };
    },
  };
}
