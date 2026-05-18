import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types";

/** Returns the currently authenticated user or null — safe for server components. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Returns the profile row for the authenticated user or null. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

/**
 * Asserts the caller is authenticated.
 * Redirects to /login if not — safe to use in server components / server actions.
 */
export async function requireAuth() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Asserts the caller has the required role.
 * Redirects to /dashboard if insufficient permissions.
 */
export async function requireRole(role: UserRole) {
  const user = await requireAuth();
  const profile = await getProfile();

  if (!profile || profile.role !== role) {
    redirect("/dashboard");
  }

  return { user, profile };
}

/** Helper for API routes: returns user or throws 401. */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

