import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiAuth } from "@/lib/api-auth";
import { filterNewLeads } from "@/services/scraping/dedupe";
import { scrapeGoogleLeads, SerpBlockedError } from "@/services/scraping/google";
import type { SearchParams } from "@/types";

/** Headless Chromium cannot run on the Edge runtime. */
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;

  try {
    const body = await request.json();
    const {
      city,
      niche,
      limit = 20,
      countryCode = "in",
    } = body as SearchParams & { enrichContacts?: boolean };
    const enrichContacts = body.enrichContacts !== false;

    if (!city || !niche) {
      return NextResponse.json(
        { error: "city and niche are required" },
        { status: 400 }
      );
    }

    const { data: session } = await supabaseAdmin
      .from("search_sessions")
      .insert({
        city,
        niche,
        filters: { limit, source: "google_search", enrichContacts },
        status: "running",
      })
      .select()
      .single();

    let report;
    try {
      report = await scrapeGoogleLeads({
        city,
        niche,
        limit,
        countryCode,
        enrichContacts,
      });
    } catch (error) {
      if (session) {
        await supabaseAdmin
          .from("search_sessions")
          .update({
            status: "failed",
            leads_found: 0,
            completed_at: new Date().toISOString(),
          })
          .eq("id", session.id);
      }
      // A throttle is not "no results" — say so, so the user can retry later.
      if (error instanceof SerpBlockedError) {
        return NextResponse.json(
          { error: error.message, blocked: true },
          { status: 429 }
        );
      }
      throw error;
    }

    if (report.candidates.length === 0) {
      if (session) {
        await supabaseAdmin
          .from("search_sessions")
          .update({ status: "completed", leads_found: 0, completed_at: new Date().toISOString() })
          .eq("id", session.id);
      }
      return NextResponse.json({
        leads: [], count: 0, scanned: 0, duplicatesSkipped: 0,
        message: "No results found",
      });
    }

    const leadsToInsert = report.candidates.map((c) => ({
      clinic_name: c.clinic_name,
      category: c.category,
      city: c.city,
      address: c.address,
      phone: c.phone,
      website: c.website,
      clinic_email: c.clinic_email,
      instagram_username: c.instagram_username,
      rating: c.rating,
      review_count: c.review_count,
      place_id: c.place_id,
      website_title: c.website_title,
      website_description: c.website_description,
      search_query: `${niche} ${city}`,
      data_source: "google_search",
      outreach_status: "new",
    }));

    const { fresh, existingCount, inBatchCount } = await filterNewLeads(
      leadsToInsert,
      city
    );
    const skipped = existingCount + inBatchCount;

    let inserted: { id: string; clinic_name: string; city: string }[] = [];

    if (fresh.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .upsert(fresh, { onConflict: "place_id", ignoreDuplicates: true })
        .select("id, clinic_name, city");

      if (error) console.error("DB upsert error:", error);
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
      scanned: report.candidates.length,
      duplicatesSkipped: skipped,
      profilesFound: report.localCount,
      websitesFound: report.organicCount,
      contactsEnriched: report.enrichedCount,
      outOfRegionDropped: report.outOfRegionDropped,
      message:
        `Scanned ${report.candidates.length} businesses for "${niche} ${city}" — ` +
        `${inserted.length} new` +
        (skipped > 0 ? `, ${skipped} already in your list` : ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scraping failed";
    console.error("Google scrape error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
