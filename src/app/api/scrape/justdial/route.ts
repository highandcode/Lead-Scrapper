import { NextRequest, NextResponse } from "next/server";
import { scrapeJustDial } from "@/services/scraping/justdial";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiAuth } from "@/lib/api-auth";
import { filterNewLeads } from "@/services/scraping/dedupe";
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

    // Keep only leads we don't already have — place_id alone misses the same
    // clinic arriving from another source or under another niche.
    const { fresh, existingCount, inBatchCount } = await filterNewLeads(
      leadsToInsert,
      city
    );
    const skipped = existingCount + inBatchCount;

    let inserted: { id: string; clinic_name: string; city: string; rating: number }[] = [];

    if (fresh.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .upsert(fresh, { onConflict: "place_id", ignoreDuplicates: true })
        .select("id, clinic_name, city, rating");

      if (error) {
        console.error("DB upsert error:", error);
      }
      inserted = data ?? [];
    }

    if (session) {
      await supabaseAdmin
        .from("search_sessions")
        .update({
          status: "completed",
          leads_found: inserted.length,
          completed_at: new Date().toISOString(),
        })
        .eq("id", session.id);
    }

    return NextResponse.json({
      leads: inserted,
      count: inserted.length,
      scanned: places.length,
      duplicatesSkipped: skipped,
      message:
        `Found ${places.length} clinics for "${niche} ${city}" on JustDial — ` +
        `${inserted.length} new` +
        (skipped > 0 ? `, ${skipped} already in your list` : ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scraping failed";
    console.error("JustDial scrape error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
