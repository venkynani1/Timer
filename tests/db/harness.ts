import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

export const HOST = "11111111-1111-1111-1111-111111111111";
export const OVERRIDER = "22222222-2222-2222-2222-222222222222";
export const OWNER = "33333333-3333-3333-3333-333333333333";
export const STRANGER = "44444444-4444-4444-4444-444444444444";

/** Boots an embedded Postgres, applies a Supabase shim and every real migration. */
export async function bootDatabase() {
  const db = new PGlite();
  const root = path.resolve(__dirname, "../..");
  await db.exec(fs.readFileSync(path.join(root, "tests/db/supabase-shim.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const file of fs.readdirSync(dir).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, file), "utf8"));
  }
  await db.exec(`
    insert into auth.users (id, email) values
      ('${HOST}', 'host@example.test'), ('${OVERRIDER}', 'ops@example.test'),
      ('${OWNER}', 'owner@example.test'), ('${STRANGER}', 'stranger@example.test');
    insert into public.event_staff (event_id, user_id, role)
      select id, '${HOST}', 'host' from public.events where slug = 'designathon-x';
    insert into public.event_staff (event_id, user_id, role)
      select id, '${OVERRIDER}', 'override_admin' from public.events where slug = 'designathon-x';
    insert into public.event_staff (event_id, user_id, role)
      select id, '${OWNER}', 'owner' from public.events where slug = 'designathon-x';
  `);
  const eventId = (await db.query<{ id: string }>("select id from public.events where slug = 'designathon-x'")).rows[0].id;
  return { db, eventId };
}

type Who = { role: "anon" } | { role: "authenticated"; sub: string; signedInSecondsAgo?: number };

/** Runs SQL as an API caller would reach it through PostgREST (role + JWT claims). */
export async function as<T>(db: PGlite, who: Who, sql: string, params: unknown[] = []) {
  await db.exec("reset role");
  if (who.role === "anon") {
    await db.exec(`select set_config('request.jwt.claims', '{"role":"anon"}', false); set role anon;`);
  } else {
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      sub: who.sub,
      role: "authenticated",
      amr: [{ method: "password", timestamp: now - (who.signedInSecondsAgo ?? 3600) }],
    };
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
    await db.exec("set role authenticated");
  }
  try {
    return await db.query<T & Record<string, unknown>>(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claims', '', false);");
  }
}

/** Test-only: moves the official timestamps into the past, as if time had elapsed. */
export async function travel(db: PGlite, eventId: string, seconds: number) {
  await db.exec("reset role; set session_replication_role = replica;");
  await db.query(
    `update public.event_timers
        set started_at = started_at - make_interval(secs => $2),
            ends_at    = ends_at    - make_interval(secs => $2),
            held_at    = held_at    - make_interval(secs => $2)
      where event_id = $1`,
    [eventId, seconds],
  );
  await db.exec("set session_replication_role = origin;");
}
