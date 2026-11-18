import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import type { MissionDb } from "@/lib/supabase/schema";
import type { ZodType, ZodTypeDef } from "zod";
import { createUserSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { DB_SCHEMA } from "@/lib/supabase/schema";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Map Postgres/PostgREST errors raised by the mission functions to HTTP responses. */
export function fromDbError(err: { code?: string; message?: string } | null | undefined) {
  const code = err?.code ?? "";
  const status =
    code === "42501" ? 403 : code === "28000" ? 401 : code === "54000" ? 429 : code === "22023" || code === "23514" ? 400 : code === "P0002" ? 404 : 500;
  const message = status === 500 ? "Mission control error" : err?.message ?? "Request failed";
  if (status === 500) console.error("[mission] database error", err);
  return json({ error: message, code }, status);
}

/** Basic CSRF defence for cookie-authenticated mutations: same-origin requests only. */
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients don't send cookies cross-site
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export interface AdminContext<T> {
  supabase: MissionDb;
  user: User;
  eventId: string;
  body: T;
}

/**
 * Wraps an admin mutation: same-origin check → schema validation → session →
 * event lookup → handler. Authorisation itself is enforced again in Postgres
 * (SECURITY DEFINER functions check the caller's role), never only here.
 */
export function adminRoute<T>(schema: ZodType<T, ZodTypeDef, unknown>, handler: (ctx: AdminContext<T>) => Promise<Response>) {
  return async (req: NextRequest) => {
    if (!isSupabaseConfigured()) return json({ error: "Supabase is not configured" }, 503);
    if (!sameOrigin(req)) return json({ error: "Cross-origin request refused" }, 403);
    const raw = req.method === "GET" ? Object.fromEntries(req.nextUrl.searchParams) : await req.json().catch(() => null);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: parsed.error.issues.map((i) => i.message).join("; "), issues: parsed.error.issues }, 400);
    }
    const supabase = await createUserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ error: "Sign in required" }, 401);
    const slug = (parsed.data as { event: string }).event;
    const { data: ev, error } = await supabase.from("events").select("id").eq("slug", slug).maybeSingle();
    if (error) return fromDbError(error);
    if (!ev) return json({ error: "Unknown event" }, 404);
    return handler({ supabase, user, eventId: ev.id, body: parsed.data });
  };
}

/**
 * Re-authentication for privileged actions: verifies the password with a fresh,
 * non-persisted sign-in and returns a client bound to that *new* session. The
 * database then checks the session's sign-in time (amr claim) is recent.
 */
export async function reauthenticate(user: User, password: string): Promise<MissionDb | null> {
  if (!user.email) return null;
  const fresh = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: DB_SCHEMA }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await fresh.auth.signInWithPassword({ email: user.email, password });
  if (error || !data.session || data.user?.id !== user.id) return null;
  return fresh;
}
