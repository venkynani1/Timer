import { z } from "zod";
import { adminRoute, fromDbError, json } from "@/lib/api";
import { integrationSchema, slugSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = adminRoute(z.object({ event: slugSchema }), async ({ supabase, eventId }) => {
  const { data, error } = await supabase.from("timer_module_integrations").select("module_key, close_on_deadline").eq("event_id", eventId);
  if (error) return fromDbError(error);
  return json({ integrations: data });
});

export const POST = adminRoute(integrationSchema, async ({ supabase, eventId, body }) => {
  const { error } = await supabase.rpc("set_module_integration", {
    p_event_id: eventId,
    p_module_key: body.moduleKey,
    p_close_on_deadline: body.closeOnDeadline,
  });
  if (error) return fromDbError(error);
  return json({ ok: true });
});
