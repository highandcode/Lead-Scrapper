import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiAuth } from "@/lib/api-auth";
import { parseLeadFilters, applyLeadFilters, applyLeadSort } from "@/lib/lead-filters";
import type { LeadFilters, PaginatedLeads, DashboardStats } from "@/types";

export async function GET(request: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;
  const { searchParams } = new URL(request.url);

  const filters: LeadFilters = {
    ...parseLeadFilters(searchParams),
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? 20),
  };

  try {
    // Stats request
    if (searchParams.get("stats") === "true") {
      return await getStats();
    }

    // Distinct niches/categories request (for populating the niche filter dynamically)
    if (searchParams.get("categories") === "true") {
      return await getCategories(filters.data_source);
    }

    let query = supabaseAdmin.from("leads").select("*", { count: "exact" });

    query = applyLeadFilters(query, filters);
    query = applyLeadSort(query, filters);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: leads, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response: PaginatedLeads = {
      leads: leads ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };

    return NextResponse.json(response);
  } catch (error) {
    // A connection-level failure arrives here as a bare `TypeError: fetch
    // failed`, which says nothing on its own — log the cause, and still answer
    // with JSON so the caller gets a message instead of a 500 HTML page it
    // cannot parse.
    console.error("[api/leads] GET failed:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getStats() {
  const { data: allLeads, error } = await supabaseAdmin
    .from("leads")
    .select("lead_score, outreach_status, created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const stats: DashboardStats = {
    totalLeads: allLeads?.length ?? 0,
    analyzedLeads: allLeads?.filter((l) => l.lead_score != null).length ?? 0,
    contactedLeads: allLeads?.filter((l) =>
      ["contacted", "replied", "meeting_set", "closed"].includes(l.outreach_status)
    ).length ?? 0,
    avgLeadScore: Math.round(
      (allLeads?.filter((l) => l.lead_score != null).reduce((sum, l) => sum + (l.lead_score ?? 0), 0) ?? 0) /
      Math.max(allLeads?.filter((l) => l.lead_score != null).length ?? 1, 1)
    ),
    highScoreLeads: allLeads?.filter((l) => (l.lead_score ?? 0) >= 70).length ?? 0,
    newThisWeek: allLeads?.filter((l) => new Date(l.created_at) >= weekAgo).length ?? 0,
  };

  return NextResponse.json(stats);
}

async function getCategories(dataSource?: string) {
  let query = supabaseAdmin.from("leads").select("category").not("category", "is", null);
  if (dataSource) query = query.eq("data_source", dataSource);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const categories = Array.from(
    new Set((data ?? []).map((l) => l.category as string).map((c) => c.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;

  try {
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from("leads")
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
