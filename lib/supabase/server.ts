import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { DB_SCHEMA } from "./schema";

/** Request-scoped client carrying the signed-in user's session (RLS applies as that user). */
export async function createUserSupabase() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: DB_SCHEMA },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a Server Component: middleware refreshes the session instead */
        }
      },
    },
  });
}

/** Anonymous, stateless client for public reads. Never uses the service role. */
export function createAnonSupabase() {
  return createPlainClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: DB_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
