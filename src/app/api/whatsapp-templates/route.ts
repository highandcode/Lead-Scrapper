import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiAuth, requireApiRole } from "@/lib/api-auth";

// GET /api/whatsapp-templates — any authenticated user can list templates (to pick one when sending)
export async function GET() {
  const { response } = await requireApiAuth();
  if (response) return response;

  const { data, error } = await supabaseAdmin
    .from("whatsapp_templates")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// POST /api/whatsapp-templates — admin only, create a new template
export async function POST(request: NextRequest) {
  const { response } = await requireApiRole("admin");
  if (response) return response;

  try {
    const { name, content } = await request.json();

    if (!name || !content) {
      return NextResponse.json(
        { error: "Name and content are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("whatsapp_templates")
      .insert({ name, content })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
