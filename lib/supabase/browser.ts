"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { MissionDb } from "@/lib/supabase/schema";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { DB_SCHEMA } from "./schema";

let client: MissionDb | null = null;

/** Browser client (anon key only). Sessions live in cookies managed by @supabase/ssr. */
export function getBrowserSupabase(): MissionDb {
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: DB_SCHEMA } });
  return client;
}
