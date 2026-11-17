import type { NextRequest } from "next/server";
import { json, fromDbError } from "@/lib/api";
import { createAnonSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured, resolveSlug } from "@/lib/env";
import { loadMission, NotFoundError } from "@/lib/mission-data";

export const dynamic = "force-dynamic";

/** Public, read-only authoritative mission state. */
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return json({ error: "Mission control is not configured yet (missing Supabase environment)." }, 503);
  try {
    const bundle = await loadMission(createAnonSupabase(), resolveSlug(req.nextUrl.searchParams.get("event")));
    return json(bundle);
  } catch (e) {
    if (e instanceof NotFoundError) return json({ error: e.message }, 404);
    return fromDbError(e as { code?: string; message?: string });
  }
}
