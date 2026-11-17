import { NextResponse, type NextRequest } from "next/server";
import { createUserSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createUserSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/admin/login", req.url), { status: 303 });
}
