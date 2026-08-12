import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiAuth } from "@/lib/api-auth";
import { parseLeadFilters, applyLeadFilters, applyLeadSort } from "@/lib/lead-filters";
import { classifyLeadSite, type LeadVerdict } from "@/services/scraping/companyClassifier";
import { mapLimit } from "@/services/scraping/findContacts";
import type { Lead } from "@/types";

/**
 * Sweep a lead set for rows that are not businesses — LinkedIn/Pinterest pages,
 * JustDial-style directories, listicle publishers — so they can be removed.
 *
 * Deliberately two-phase. A scan (the default) only reports what it found and
 * why; deletion happens on a second call carrying the ids the user actually
 * approved. Classification involves a model call and a live fetch, so it is
 * never certain enough to delete a user's leads unprompted — and deletes here
 * are not undoable.
 */

const MAX_LEADS_PER_RUN = 200;
const CONCURRENCY = Number(process.env.MAX_CONCURRENT_SCRAPES ?? 4);

interface ClassifyBody {
  ids?: string[];
  filters?: string;
  niche?: string;
  limit?: number;
  /** Ids the user approved for deletion after seeing the scan. */
  deleteIds?: string[];
  /** Renames the user approved after seeing the `renameable` list from a scan. */
  renames?: { id: string; name: string }[];
}

export interface ClassifiedLead {
  id: string;
  name: string;
  website: string | null;
  verdict: LeadVerdict;
}

export async function POST(request: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;

  let body: ClassifyBody;
  try {
    body = (await request.json()) as ClassifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Phase 2a: apply an approved deletion ───────────────────────────────
  if (body.deleteIds?.length) {
    const { error, count } = await supabaseAdmin
      .from("leads")
      .delete({ count: "exact" })
      .in("id", body.deleteIds);

    if (error) {
      console.error("[api/leads/classify] delete failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ deleted: count ?? 0 });
  }

  // ── Phase 2b: apply approved renames ───────────────────────────────────
  // One row at a time — each rename targets a different id/name pair, so
  // there is no single `.in()` update to batch these into.
  if (body.renames?.length) {
    let renamed = 0;
    for (const r of body.renames) {
      if (!r.id || !r.name?.trim()) continue;
      const { error } = await supabaseAdmin
        .from("leads")
        .update({ clinic_name: r.name.trim(), updated_at: new Date().toISOString() })
        .eq("id", r.id);
      if (error) {
        console.error(`[api/leads/classify] rename failed for lead ${r.id}:`, error.message);
        continue;
      }
      renamed++;
    }
    return NextResponse.json({ renamed });
  }

  // ── Phase 1: scan and report ───────────────────────────────────────────
  const limit = Math.min(body.limit ?? MAX_LEADS_PER_RUN, MAX_LEADS_PER_RUN);

  try {
    let leads: Lead[] = [];
    let totalMatching = 0;

    if (body.ids?.length) {
      const { data, error } = await supabaseAdmin.from("leads").select("*").in("id", body.ids.slice(0, limit));
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

    const withSite = leads.filter((lead) => lead.website?.trim());

    const classified = await mapLimit<Lead, ClassifiedLead>(withSite, CONCURRENCY, async (lead) => ({
      id: lead.id,
      name: lead.clinic_name,
      website: lead.website,
      verdict: await classifyLeadSite(lead.website as string, { niche: body.niche }),
    }));

    const rejected = classified.filter((c) => c.verdict.kind === "not_company");
    const unreachable = classified.filter((c) => c.verdict.kind === "unknown");

    // A lead whose name is an article title but whose domain IS a real
    // business is not junk — it is a lead with the wrong name, which Find
    // Contacts renames from the site's own branding. Reported separately so a
    // cleanup pass does not delete them.
    const renameable = classified.filter(
      (c) => c.verdict.kind === "company" && c.verdict.companyName && c.verdict.companyName !== c.name
    );

    return NextResponse.json({
      summary: {
        scanned: classified.length,
        skippedNoWebsite: leads.length - withSite.length,
        notCompanies: rejected.length,
        unreachable: unreachable.length,
        renameable: renameable.length,
        remaining: Math.max(0, totalMatching - leads.length),
      },
      rejected,
      unreachable,
      renameable,
    });
  } catch (error) {
    console.error("[api/leads/classify] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Classification failed" },
      { status: 500 }
    );
  }
}
