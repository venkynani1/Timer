export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const DEFAULT_EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG || "designathon-x";

export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const SLUG_RE = /^[a-z0-9-]{2,64}$/;
export function resolveSlug(v: string | null | undefined) {
  return v && SLUG_RE.test(v) ? v : DEFAULT_EVENT_SLUG;
}
