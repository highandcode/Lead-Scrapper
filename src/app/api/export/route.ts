import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { leadsToCSV } from "@/services/export/csv";
import { requireApiAuth } from "@/lib/api-auth";
import { parseLeadFilters, applyLeadFilters, applyLeadSort } from "@/lib/lead-filters";
import type { Lead } from "@/types";

/** Safety cap on an unselected export. Surfaced in the export page copy. */
const EXPORT_LIMIT = 500;

export async function GET(request: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("ids");
  const filters = parseLeadFilters(searchParams);

  try {
    let query = supabaseAdmin.from("leads").select("*");

    if (ids) {
      // Explicit row selection wins over the filter bar.
      query = query.in("id", ids.split(","));
    } else {
      // Same filters, same semantics as GET /api/leads, so the CSV matches
      // exactly what the table was showing.
      query = applyLeadFilters(query, filters);
      query = applyLeadSort(query, filters);
      query = query.limit(EXPORT_LIMIT);
    }

    const { data: leads, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const csv = leadsToCSV((leads as Lead[]) ?? []);
    const source = filters.data_source ? `-${filters.data_source}` : "";
    const filename = `clinic-leads${source}-${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
