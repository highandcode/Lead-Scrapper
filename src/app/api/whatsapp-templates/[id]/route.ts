import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiRole } from "@/lib/api-auth";

// PATCH /api/whatsapp-templates/[id] — admin only, update name/content
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { response } = await requireApiRole("admin");
  if (response) return response;

  try {
    const { name, content } = await request.json();

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (content !== undefined) updates.content = content;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("whatsapp_templates")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/whatsapp-templates/[id] — admin only
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { response } = await requireApiRole("admin");
  if (response) return response;

  const { error } = await supabaseAdmin
    .from("whatsapp_templates")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
