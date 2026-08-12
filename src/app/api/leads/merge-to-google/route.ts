import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiPermission } from "@/lib/api-auth";
import { normalizePhone, nameCityKey } from "@/services/scraping/dedupe";

/** Same one leads.update(...).in("id", chunk) call can carry safely. */
const ID_CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface CandidateRow {
  id: string;
  place_id: string | null;
  clinic_name: string | null;
  city: string | null;
  phone: string | null;
}

// POST /api/leads/merge-to-google — relabel existing leads in the given
// categories (optionally narrowed to a created_at date range) as
// data_source="google_search" so they show up under Google Leads, skipping
// any that already have an equivalent there (place_id, phone, or name+city
// match).
export async function POST(request: NextRequest) {
  const { response } = await requireApiPermission("leadsWrite");
  if (response) return response;

  try {
    const { categories, dateFrom, dateTo } = (await request.json()) as {
      categories?: string[];
      dateFrom?: string;
      dateTo?: string;
    };

    if (!Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json({ error: "categories is required" }, { status: 400 });
    }

    let candidateQuery = supabaseAdmin
      .from("leads")
      .select("id, place_id, clinic_name, city, phone")
      .in("category", categories)
      .neq("data_source", "google_search");
    // Scoped to when the lead was first scraped — same field and convention
    // the table's own date filter uses (lib/lead-filters.ts).
    if (dateFrom) candidateQuery = candidateQuery.gte("created_at", dateFrom);
    if (dateTo) candidateQuery = candidateQuery.lte("created_at", `${dateTo}T23:59:59.999`);

    // Duplicate check always runs against the *entire* existing Google Leads
    // set, regardless of the date range being merged — a match found there
    // still counts as a duplicate no matter when it was added.
    const [{ data: candidates, error: candErr }, { data: existing, error: existErr }] =
      await Promise.all([
        candidateQuery,
        supabaseAdmin
          .from("leads")
          .select("place_id, clinic_name, city, phone")
          .eq("data_source", "google_search"),
      ]);

    if (candErr) return NextResponse.json({ error: candErr.message }, { status: 500 });
    if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 });

    const seenPlaceIds = new Set<string>();
    const seenPhones = new Set<string>();
    const seenNameCity = new Set<string>();

    for (const row of existing ?? []) {
      if (row.place_id) seenPlaceIds.add(row.place_id);
      const phone = normalizePhone(row.phone);
      if (phone) seenPhones.add(phone);
      seenNameCity.add(nameCityKey(row.clinic_name, row.city));
    }

    const toMerge: string[] = [];
    let skippedDuplicates = 0;

    for (const c of (candidates ?? []) as CandidateRow[]) {
      const phone = normalizePhone(c.phone);
      const nameCity = nameCityKey(c.clinic_name, c.city);
      const placeId = c.place_id || null;

      const isDuplicate =
        (placeId != null && seenPlaceIds.has(placeId)) ||
        (phone != null && seenPhones.has(phone)) ||
        seenNameCity.has(nameCity);

      if (isDuplicate) {
        skippedDuplicates++;
        continue;
      }

      toMerge.push(c.id);
      // Also guard against two candidates in this same batch being duplicates
      // of each other — only the first should merge.
      if (placeId) seenPlaceIds.add(placeId);
      if (phone) seenPhones.add(phone);
      seenNameCity.add(nameCity);
    }

    for (const ids of chunk(toMerge, ID_CHUNK_SIZE)) {
      const { error } = await supabaseAdmin
        .from("leads")
        .update({ data_source: "google_search" })
        .in("id", ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      scanned: candidates?.length ?? 0,
      merged: toMerge.length,
      skippedDuplicates,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Merge failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
