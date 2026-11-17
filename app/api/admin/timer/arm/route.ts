import { adminRoute, fromDbError, json, reauthenticate } from "@/lib/api";
import { armSchema } from "@/lib/validation";
import { mapClock } from "@/lib/timer/mappers";

/** Owner-only: arm or disarm the emergency override. */
export const POST = adminRoute(armSchema, async ({ user, eventId, body }) => {
  const fresh = await reauthenticate(user, body.password);
  if (!fresh) return json({ error: "Re-authentication failed" }, 401);
  const { data, error } = await fresh
    .rpc("set_override_enabled", { p_event_id: eventId, p_enabled: body.enabled, p_reason: body.reason })
    .single();
  await fresh.auth.signOut({ scope: "local" });
  if (error) return fromDbError(error);
  return json({ clock: mapClock(data) });
});
