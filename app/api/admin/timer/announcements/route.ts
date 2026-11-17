import { adminRoute, fromDbError, json } from "@/lib/api";
import { announcementSchema, deleteSchema } from "@/lib/validation";
import { mapAnnouncement } from "@/lib/timer/mappers";

export const POST = adminRoute(announcementSchema, async ({ supabase, eventId, body }) => {
  const { data, error } = await supabase
    .rpc("publish_announcement", {
      p_event_id: eventId,
      p_message: body.message,
      p_priority: body.priority,
      p_display_seconds: body.displaySeconds,
      p_publish_at: body.publishAt,
      p_expires_at: body.expiresAt,
    })
    .single();
  if (error) return fromDbError(error);
  return json({ announcement: mapAnnouncement(data) });
});

export const DELETE = adminRoute(deleteSchema, async ({ supabase, eventId, body }) => {
  const { error } = await supabase.rpc("cancel_announcement", { p_event_id: eventId, p_id: body.id });
  if (error) return fromDbError(error);
  return json({ ok: true });
});
