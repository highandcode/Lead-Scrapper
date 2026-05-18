import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiRole } from "@/lib/api-auth";

// GET /api/admin/users — list all users with their profiles
export async function GET() {
  const { response } = await requireApiRole("admin");
  if (response) return response;

  // Query profiles (has email, name, role) joined with auth last_sign_in_at
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with auth data (last_sign_in_at, email_confirmed)
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });

  const authMap = new Map(
    (authData?.users ?? []).map((u) => [u.id, u])
  );

  const users = (profiles ?? []).map((p) => {
    const authUser = authMap.get(p.id);
    return {
      ...p,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
      email_confirmed_at: authUser?.email_confirmed_at ?? null,
    };
  });

  return NextResponse.json(users);
}

// POST /api/admin/users — create a new user
export async function POST(request: NextRequest) {
  const { response } = await requireApiRole("admin");
  if (response) return response;

  try {
    const { email, password, full_name, role = "user" } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Create auth user (trigger auto-creates profile)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name ?? "" },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Set role (trigger defaults to 'user', update if admin requested)
    if (role === "admin" && data.user) {
      await supabaseAdmin
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", data.user.id);
    }

    // Return the created profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", data.user!.id)
      .single();

    return NextResponse.json(profile, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
