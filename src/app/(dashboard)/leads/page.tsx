import Header from "@/components/dashboard/Header";
import LeadsTable from "@/components/leads/LeadsTable";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Search, Download } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  // Query Supabase directly — avoids HTTP self-fetch port issues
  let initialData;

  try {
    const { data: leads, count, error } = await supabaseAdmin
      .from("leads")
      .select("*", { count: "exact" })
      .order("lead_score", { ascending: false, nullsFirst: false })
      .range(0, 19);

    if (error) throw error;

    initialData = {
      leads: leads ?? [],
      total: count ?? 0,
      page: 1,
      pageSize: 20,
      totalPages: Math.ceil((count ?? 0) / 20),
    };
  } catch {
    initialData = { leads: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }

  return (
    <div>
      <Header
        title="All Leads"
        subtitle={`${initialData.total ?? 0} total clinic prospects`}
        actions={
          <div className="flex gap-2">
            <a href="/api/export" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </a>
            <Link href="/search">
              <Button variant="gradient" size="sm">
                <Search className="w-3.5 h-3.5" /> Find More
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6">
        <LeadsTable initialData={initialData} />
      </div>
    </div>
  );
}
