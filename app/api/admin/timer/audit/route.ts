import { z } from "zod";
import { adminRoute, fromDbError, json } from "@/lib/api";
import { slugSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// RLS limits the audit log to staff of the event.
export const GET = adminRoute(z.object({ event: slugSchema }), async ({ supabase, eventId }) => {
  const { data, error } = await supabase
    .from("timer_audit_log")
    .select("id, actor_id, action, reason, details, created_at")
    .eq("event_id", eventId)
    .order("id", { ascending: false })
    .limit(200);
  if (error) return fromDbError(error);
  return json({ entries: data });
});
