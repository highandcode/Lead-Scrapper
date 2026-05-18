import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiRole } from "@/lib/api-auth";

// PATCH /api/admin/users/[id] — update name, role, or email
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user: adminUser, response } = await requireApiRole("admin");
  if (response || !adminUser) return response;

  try {
    const { full_name, role, email, permissions } = await request.json();
    const targetId = params.id;

    // Prevent admin from demoting themselves
    if (targetId === adminUser.id && role && role !== "admin") {
      return NextResponse.json(
        { error: "You cannot remove your own admin role" },
        { status: 400 }
      );
    }

    // Update profile fields
    const profileUpdates: Record<string, unknown> = {};
    if (full_name !== undefined) profileUpdates.full_name = full_name;
    if (role !== undefined) profileUpdates.role = role;
    if (permissions !== undefined) profileUpdates.permissions = permissions;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", targetId);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
    }

    // Update email via auth admin API
    if (email !== undefined) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        targetId,
        { email }
      );
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
      // Keep profile email in sync
      await supabaseAdmin
        .from("profiles")
        .update({ email })
        .eq("id", targetId);
    }

    const { data: updated } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", targetId)
      .single();

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] — permanently delete a user
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user: adminUser, response } = await requireApiRole("admin");
  if (response || !adminUser) return response;

  if (params.id === adminUser.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
