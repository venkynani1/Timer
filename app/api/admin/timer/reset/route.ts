import { adminRoute, fromDbError, json, reauthenticate } from "@/lib/api";
import { resetSchema } from "@/lib/validation";
import { mapClock } from "@/lib/timer/mappers";

/**
 * Owner-only MISSION RESET. Requires password re-entry, a reason, typed
 * confirmation and an armed override; Postgres enforces all of it and audits.
 */
export const POST = adminRoute(resetSchema, async ({ user, eventId, body }) => {
  const fresh = await reauthenticate(user, body.password);
  if (!fresh) return json({ error: "Re-authentication failed" }, 401);
  const { data, error } = await fresh.rpc("reset_mission", { p_event_id: eventId, p_reason: body.reason }).single();
  await fresh.auth.signOut({ scope: "local" });
  if (error) return fromDbError(error);
  return json({ clock: mapClock(data) });
});
