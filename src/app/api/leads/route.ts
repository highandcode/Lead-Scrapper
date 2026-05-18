import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireApiAuth } from "@/lib/api-auth";
import type { LeadFilters, PaginatedLeads, DashboardStats } from "@/types";

export async function GET(request: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;
  const { searchParams } = new URL(request.url);

  const filters: LeadFilters = {
    search: searchParams.get("search") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    outreach_status: (searchParams.get("outreach_status") as LeadFilters["outreach_status"]) ?? undefined,
    minScore: searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined,
    maxScore: searchParams.get("maxScore") ? Number(searchParams.get("maxScore")) : undefined,
    hasWebsite: searchParams.get("hasWebsite") === "true" ? true : undefined,
    hasInstagram: searchParams.get("hasInstagram") === "true" ? true : undefined,
    data_source: searchParams.get("data_source") ?? undefined,
    sortBy: (searchParams.get("sortBy") as LeadFilters["sortBy"]) ?? "created_at",
    sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") ?? "desc",
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? 20),
  };

  // Stats request
  if (searchParams.get("stats") === "true") {
    return getStats();
  }

  try {
    let query = supabaseAdmin.from("leads").select("*", { count: "exact" });

    if (filters.search) {
      query = query.ilike("clinic_name", `%${filters.search}%`);
    }
    if (filters.city) query = query.eq("city", filters.city);
    if (filters.category) query = query.ilike("category", `%${filters.category}%`);
    if (filters.outreach_status) query = query.eq("outreach_status", filters.outreach_status);
    if (filters.minScore != null) query = query.gte("lead_score", filters.minScore);
    if (filters.maxScore != null) query = query.lte("lead_score", filters.maxScore);
    if (filters.hasWebsite) query = query.not("website", "is", null);
    if (filters.hasInstagram) query = query.not("instagram_username", "is", null);
    if (filters.data_source) query = query.eq("data_source", filters.data_source);

    const sortCol = filters.sortBy ?? "created_at";
    const ascending = filters.sortOrder === "asc";
    query = query.order(sortCol, { ascending, nullsFirst: false });

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
