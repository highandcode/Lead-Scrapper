import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

export async function getRequestUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/** Returns 401 JSON response if caller is not authenticated. */
export async function requireApiAuth() {
  const user = await getRequestUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
  return { user, response: null };
}

/** Returns 401/403 JSON response if caller lacks the required role. */
export async function requireApiRole(role: UserRole) {
  const { user, response } = await requireApiAuth();
  if (response || !user) return { user: null, profile: null, response };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== role) {
    return {
      user: null,
      profile: null,
      response: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return { user, profile, response: null };
}
