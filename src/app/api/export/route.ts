import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { leadsToCSV } from "@/services/export/csv";
import { requireApiAuth } from "@/lib/api-auth";
import type { Lead } from "@/types";

export async function GET(request: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("ids");
  const city = searchParams.get("city");
  const status = searchParams.get("status");
  const dataSource = searchParams.get("data_source");

  try {
    let query = supabaseAdmin.from("leads").select("*");

    if (ids) {
      query = query.in("id", ids.split(","));
    } else {
      if (city) query = query.eq("city", city);
      if (status) query = query.eq("outreach_status", status);
      if (dataSource) query = query.eq("data_source", dataSource);
      query = query.order("lead_score", { ascending: false, nullsFirst: false });
      query = query.limit(500);
    }

    const { data: leads, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const csv = leadsToCSV((leads as Lead[]) ?? []);
    const source = dataSource ? `-${dataSource}` : "";
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
