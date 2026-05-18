import { NextRequest, NextResponse } from "next/server";
import { scrapeJustDial } from "@/services/scraping/justdial";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiAuth } from "@/lib/api-auth";
import type { SearchParams } from "@/types";

export async function POST(request: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;

  try {
    const body = await request.json();
    const { city, niche, minRating, maxRating, limit = 20 } = body as SearchParams;

    if (!city || !niche) {
      return NextResponse.json(
        { error: "city and niche are required" },
        { status: 400 }
      );
    }

    // Create search session
    const { data: session } = await supabaseAdmin
      .from("search_sessions")
      .insert({
        city,
        niche,
        filters: { minRating, maxRating, limit, source: "justdial" },
        status: "running",
      })
      .select()
      .single();

    // Run scraper
    const places = await scrapeJustDial({ city, niche, minRating, maxRating, limit });

    if (places.length === 0) {
      if (session) {
        await supabaseAdmin
          .from("search_sessions")
          .update({ status: "completed", leads_found: 0, completed_at: new Date().toISOString() })
          .eq("id", session.id);
      }
      return NextResponse.json({ leads: [], count: 0, message: "No results found" });
    }

    // Upsert leads — deduplicate on place_id (prefixed with "jd_")
    const leadsToInsert = places.map((p) => ({
      clinic_name: p.clinic_name,
      category: p.category,
      city: p.city,
      address: p.address,
      phone: p.phone,
      website: p.website || null,
      google_maps_url: p.justdial_url, // reuse column for the listing URL
      rating: p.rating,
      review_count: p.review_count,
      place_id: p.place_id,
      search_query: `${niche} ${city}`,
      data_source: "justdial",
      outreach_status: "new",
    }));

    const { data: inserted, error } = await supabaseAdmin
      .from("leads")
      .upsert(leadsToInsert, { onConflict: "place_id", ignoreDuplicates: true })
      .select("id, clinic_name, city, rating");

    if (error) {
      console.error("DB upsert error:", error);
    }

    if (session) {
      await supabaseAdmin
        .from("search_sessions")
        .update({
          status: "completed",
          leads_found: inserted?.length ?? 0,
          completed_at: new Date().toISOString(),
        })
        .eq("id", session.id);
    }

    return NextResponse.json({
      leads: inserted ?? [],
      count: inserted?.length ?? 0,
      message: `Found ${inserted?.length ?? 0} clinics for "${niche} ${city}" on JustDial`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scraping failed";
    console.error("JustDial scrape error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
