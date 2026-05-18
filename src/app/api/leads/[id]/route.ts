import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { response } = await requireApiAuth();
  if (response) return response;
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { response } = await requireApiAuth();
  if (response) return response;

  try {
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from("leads")
      .update(body)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { response } = await requireApiAuth();
  if (response) return response;
  const { error } = await supabaseAdmin
    .from("leads")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
