import { adminRoute, fromDbError, json } from "@/lib/api";
import { startSchema } from "@/lib/validation";
import { mapClock } from "@/lib/timer/mappers";

/** START MISSION — the start time is assigned by Postgres, never by the client. */
export const POST = adminRoute(startSchema, async ({ supabase, eventId }) => {
  const { data, error } = await supabase.rpc("start_mission", { p_event_id: eventId }).single();
  if (error) return fromDbError(error);
  return json({ clock: mapClock(data) });
});
