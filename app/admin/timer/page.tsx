import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createUserSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured, resolveSlug } from "@/lib/env";
import { AdminDashboard } from "@/components/admin/dashboard";
import { SystemScreen } from "@/components/mission/system-screen";

export const metadata: Metadata = { title: "Mission Control" };
export const dynamic = "force-dynamic";

export default async function AdminTimerPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  if (!isSupabaseConfigured()) {
    return <SystemScreen title="Mission control offline" detail="Configure Supabase environment variables to enable the host dashboard." />;
  }
  const slug = resolveSlug((await searchParams).event);
  const supabase = await createUserSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login?next=/admin/timer");

  // Server-side authorisation: only staff of this event can see the dashboard.
  const { data: ev } = await supabase.from("events").select("id").eq("slug", slug).maybeSingle();
  const { data: staff } = ev
    ? await supabase.from("event_staff").select("role").eq("event_id", ev.id).eq("user_id", user.id).maybeSingle()
    : { data: null };

  if (!staff) {
    return (
      <SystemScreen title="Access denied" detail={`${user.email} is not on the mission staff for this event.`}>
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="font-tech text-xs uppercase tracking-[0.3em] text-cyan-300 hover:underline">Sign out</button>
        </form>
      </SystemScreen>
    );
  }

  return <AdminDashboard slug={slug} role={staff.role as "host" | "override_admin" | "owner"} email={user.email ?? ""} />;
}
