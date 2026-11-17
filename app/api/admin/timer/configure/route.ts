import { adminRoute, fromDbError, json } from "@/lib/api";
import { configureSchema } from "@/lib/validation";
import { mapClock } from "@/lib/timer/mappers";

export const POST = adminRoute(configureSchema, async ({ supabase, eventId, body }) => {
  const { data, error } = await supabase
    .rpc("configure_mission", {
      p_event_id: eventId,
      p_name: body.name ?? null,
      p_subtitle: body.subtitle ?? null,
      p_tagline: body.tagline ?? null,
      p_duration_seconds: body.durationSeconds ?? null,
      p_closing_message: body.closingMessage ?? null,
      p_sound_enabled: body.soundEnabled ?? null,
      p_display_mode: body.displayMode ?? null,
    })
    .single();
  if (error) return fromDbError(error);
  return json({ clock: mapClock(data) });
});
