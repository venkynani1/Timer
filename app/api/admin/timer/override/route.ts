import { adminRoute, fromDbError, json, reauthenticate } from "@/lib/api";
import { overrideSchema } from "@/lib/validation";
import { mapClock } from "@/lib/timer/mappers";

/**
 * EMERGENCY OVERRIDE. Requires: password re-entry (fresh session), a written
 * reason, the override_admin/owner role and an armed override. The database
 * enforces all of these and writes an immutable audit record.
 */
export const POST = adminRoute(overrideSchema, async ({ user, eventId, body }) => {
  const fresh = await reauthenticate(user, body.password);
  if (!fresh) return json({ error: "Re-authentication failed" }, 401);
  const { data, error } = await fresh
    .rpc("emergency_override", {
      p_event_id: eventId,
      p_action: body.action,
      p_reason: body.reason,
      p_delta_seconds: body.action === "ADJUST" ? body.deltaSeconds : null,
    })
    .single();
  await fresh.auth.signOut({ scope: "local" });
  if (error) return fromDbError(error);
  return json({ clock: mapClock(data) });
});
