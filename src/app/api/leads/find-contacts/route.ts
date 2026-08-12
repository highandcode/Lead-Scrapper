import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiAuth } from "@/lib/api-auth";
import { parseLeadFilters, applyLeadFilters, applyLeadSort } from "@/lib/lead-filters";
import {
  findContactsForLead,
  leadHasPhone,
  mapLimit,
  type FindContactsOutcome,
} from "@/services/scraping/findContacts";
import type { Lead } from "@/types";

/**
 * Batch "find contacts" over the leads the table is currently showing.
 *
 * The set is chosen exactly the way the CSV export chooses it (same
 * parseLeadFilters/applyLeadFilters path), so "Find contacts for these 47
 * leads" acts on the same 47 rows the filter bar says there are — an
 * independently re-implemented query here would silently drift from the table.
 *
 * Explicitly selected ids win over filters, mirroring exportCSV.
 */

/**
 * Hard ceiling per request. Each lead costs a homepage fetch plus up to three
 * more pages, so this is what keeps one click from running past the function's
 * 300s budget. The UI reports what was left over so the user can run it again.
 */
const MAX_LEADS_PER_RUN = 60;
const DEFAULT_CONCURRENCY = Number(process.env.MAX_CONCURRENT_SCRAPES ?? 4);
/** Google website lookups are the block-prone rung — capped far lower. */
const MAX_WEBSITE_LOOKUPS = 8;

interface FindContactsBody {
  ids?: string[];
  /** Query string of the table's active filters, as leadFiltersToParams builds it. */
  filters?: string;
  limit?: number;
  niche?: string;
  resolveMissingWebsite?: boolean;
  useSocialFallback?: boolean;
  /** Report what would change without writing anything. */
  dryRun?: boolean;
}

export async function POST(request: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;

  let body: FindContactsBody;
  try {
    body = (await request.json()) as FindContactsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const limit = Math.min(body.limit ?? MAX_LEADS_PER_RUN, MAX_LEADS_PER_RUN);

  try {
    // ── Pick the leads ────────────────────────────────────────────────────
    let leads: Lead[] = [];
    let totalMatching = 0;

    if (body.ids?.length) {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select("*")
        .in("id", body.ids.slice(0, limit));
      if (error) throw new Error(error.message);
      leads = (data ?? []) as Lead[];
      totalMatching = body.ids.length;
    } else {
      const filters = parseLeadFilters(new URLSearchParams(body.filters ?? ""));
      let query = supabaseAdmin.from("leads").select("*", { count: "exact" });
      query = applyLeadFilters(query, filters);
      query = applyLeadSort(query, filters);
      const { data, count, error } = await query.range(0, limit - 1);
      if (error) throw new Error(error.message);
      leads = (data ?? []) as Lead[];
      totalMatching = count ?? leads.length;
    }

    // Never re-hunt a number we already have — the caller may have run this
    // without the "no phone" filter, and a phone on the record is the whole
    // point of the exercise.
    const targets = leads.filter((lead) => !leadHasPhone(lead));

    if (targets.length === 0) {
      return NextResponse.json({
        summary: { considered: leads.length, attempted: 0, enriched: 0, phonesFound: 0, notCompanies: 0, failed: 0, remaining: 0 },
        results: [],
        message: "Every lead in this selection already has a phone number.",
      });
    }

    // ── Run the ladder ────────────────────────────────────────────────────
    const budget = { websiteLookupsLeft: body.resolveMissingWebsite ? MAX_WEBSITE_LOOKUPS : 0 };

    const results = await mapLimit<Lead, FindContactsOutcome>(
      targets,
      DEFAULT_CONCURRENCY,
      (lead) =>
        findContactsForLead(
          lead,
          {
            niche: body.niche,
            resolveMissingWebsite: body.resolveMissingWebsite,
            useSocialFallback: body.useSocialFallback,
            classify: true,
          },
          budget
        )
    );

    // ── Persist ───────────────────────────────────────────────────────────
    let written = 0;
    if (!body.dryRun) {
      for (const result of results) {
        if (result.status !== "enriched" || Object.keys(result.updates).length === 0) continue;
        const { error } = await supabaseAdmin
          .from("leads")
          .update({ ...result.updates, updated_at: new Date().toISOString() })
          .eq("id", result.leadId);
        if (error) {
          console.error(`[find-contacts] failed to save lead ${result.leadId}:`, error.message);
          result.status = "failed";
          result.reason = `Found details but could not save them: ${error.message}`;
          continue;
        }
        written++;
      }
    }

    const phonesFound = results.filter((r) => r.updates.phone).length;

    return NextResponse.json({
      summary: {
        considered: leads.length,
        attempted: targets.length,
        enriched: body.dryRun ? results.filter((r) => r.status === "enriched").length : written,
        phonesFound,
        notCompanies: results.filter((r) => r.status === "not_a_company").length,
        failed: results.filter((r) => r.status === "failed").length,
        /** Leads matching the filter that this run did not get to. */
        remaining: Math.max(0, totalMatching - leads.length),
      },
      results,
      dryRun: body.dryRun ?? false,
    });
  } catch (error) {
    console.error("[api/leads/find-contacts] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Find contacts failed" },
      { status: 500 }
    );
  }
}
