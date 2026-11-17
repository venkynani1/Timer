import { adminRoute, fromDbError, json } from "@/lib/api";
import { deleteSchema, milestoneSchema } from "@/lib/validation";
import { mapMilestone } from "@/lib/timer/mappers";

export const POST = adminRoute(milestoneSchema, async ({ supabase, eventId, body }) => {
  const { data, error } = await supabase
    .rpc("upsert_milestone", {
      p_event_id: eventId,
      p_id: body.id,
      p_offset_seconds: body.offsetSeconds,
      p_title: body.title,
      p_description: body.description,
      p_icon: body.icon,
      p_theme: body.theme,
      p_announcement: body.announcement,
      p_enabled: body.enabled,
    })
    .single();
  if (error) return fromDbError(error);
  return json({ milestone: mapMilestone(data) });
});

export const DELETE = adminRoute(deleteSchema, async ({ supabase, eventId, body }) => {
  const { error } = await supabase.rpc("delete_milestone", { p_event_id: eventId, p_id: body.id });
  if (error) return fromDbError(error);
  return json({ ok: true });
});
