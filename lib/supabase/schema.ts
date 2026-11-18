import type { SupabaseClient } from "@supabase/supabase-js";

/** Postgres schema that holds every mission-clock table, view and function. */
export const DB_SCHEMA = "mission_clock";

/** Untyped client bound to the mission_clock schema. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MissionDb = SupabaseClient<any, any, any, any, any>;
