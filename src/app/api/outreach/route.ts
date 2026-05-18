import { NextRequest, NextResponse } from "next/server";
import { generateOutreachMessages } from "@/services/ai/outreach";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;

  try {
    const { leadId, suggestion } = await request.json();

    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    const { data: lead, error: fetchError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (fetchError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const messages = await generateOutreachMessages(lead, suggestion);

    // Save to DB
    await supabaseAdmin
      .from("leads")
      .update({
        outreach_instagram_dm: messages.instagram_dm,
        outreach_whatsapp: messages.whatsapp,
        outreach_email: messages.email,
        outreach_followup: messages.followup,
      })
      .eq("id", leadId);

    return NextResponse.json({ success: true, messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Outreach generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
