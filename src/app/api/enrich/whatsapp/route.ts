import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiAuth } from "@/lib/api-auth";
import { enrichContacts } from "@/services/scraping/contactEnrichment";

export async function POST(request: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;

  const { leadId } = await request.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("id, website, google_maps_url, instagram_username, instagram_bio, instagram_external_url, clinic_email")
    .eq("id", leadId)
    .single();

  if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const result = await enrichContacts(lead);

  const updates: Record<string, string> = {};
  if (result.whatsapp_phone) updates.whatsapp_phone = result.whatsapp_phone;
  if (result.clinic_email && !lead.clinic_email) updates.clinic_email = result.clinic_email;

  if (Object.keys(updates).length > 0) {
    await supabaseAdmin.from("leads").update(updates).eq("id", leadId);
  }

  const found = !!(result.whatsapp_phone || result.clinic_email);

  return NextResponse.json({
    found,
    whatsapp_phone: result.whatsapp_phone,
    clinic_email: result.clinic_email,
    sources_tried: result.sources_tried,
  });
}
