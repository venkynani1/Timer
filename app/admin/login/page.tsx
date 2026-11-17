import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/login-form";
import { Backdrop } from "@/components/mission/backdrop";
import { BrandLockup } from "@/components/mission/brand";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Host sign-in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin/timer";
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center px-5" data-phase="charged">
      <Backdrop intensity="calm" />
      <div className="glass relative z-10 w-full max-w-sm rounded-2xl p-7">
        <BrandLockup name="DESIGNATHON X" subtitle="MISSION CONTROL" compact />
        <h1 className="mt-7 font-display text-lg font-semibold tracking-[0.18em] text-white">Host sign-in</h1>
        <p className="mt-1 text-sm text-sky-100/60">Authorised mission staff only.</p>
        {isSupabaseConfigured() ? (
          <LoginForm next={safeNext} />
        ) : (
          <p className="mt-6 rounded-lg border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-100">Supabase is not configured for this deployment.</p>
        )}
      </div>
    </main>
  );
}
