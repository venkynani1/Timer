import { SystemScreen } from "./system-screen";

export function NotConfigured() {
  const dev = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ALLOW_SIMULATION === "true";
  return (
    <SystemScreen
      title="Mission control offline"
      detail="Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then apply the migrations in supabase/migrations."
    >
      {dev && (
        <a href="?sim=1&at=0" className="mt-6 font-tech text-xs uppercase tracking-[0.3em] text-cyan-300 underline-offset-4 hover:underline">
          Open a developer simulation →
        </a>
      )}
    </SystemScreen>
  );
}
