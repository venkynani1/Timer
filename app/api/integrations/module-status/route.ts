import type { NextRequest } from "next/server";
import { json, fromDbError } from "@/lib/api";
import { createAnonSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured, resolveSlug } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Integration hook for other Designathon X modules (Problem Statement Arena,
 * Goodies Selection Arena, dashboards). Answers "is module X still open?"
 * from the database clock. Modules that must hard-close should ALSO call
 * public.is_module_open() inside their own RLS policies / functions.
 */
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return json({ error: "Not configured" }, 503);
  const moduleKey = req.nextUrl.searchParams.get("module") ?? "";
  if (!/^[a-z0-9_]{2,60}$/.test(moduleKey)) return json({ error: "Invalid module" }, 400);
  const supabase = createAnonSupabase();
  const { data: ev } = await supabase.from("events").select("id").eq("slug", resolveSlug(req.nextUrl.searchParams.get("event"))).maybeSingle();
  if (!ev) return json({ error: "Unknown event" }, 404);
  const [{ data: open, error }, { data: clock }] = await Promise.all([
    supabase.rpc("is_module_open", { p_event_id: ev.id, p_module_key: moduleKey }),
    supabase.from("mission_clock").select("state, ends_at, server_now").eq("event_id", ev.id).maybeSingle(),
  ]);
  if (error) return fromDbError(error);
  return json({ module: moduleKey, open, state: clock?.state ?? null, endsAt: clock?.ends_at ?? null, serverNow: clock?.server_now ?? null });
}
