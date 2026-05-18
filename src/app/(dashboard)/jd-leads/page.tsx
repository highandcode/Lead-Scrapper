import Header from "@/components/dashboard/Header";
import LeadsTable from "@/components/leads/LeadsTable";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpen, Download } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function JustDialLeadsPage() {
  let initialData;

  try {
    const { data: leads, count, error } = await supabaseAdmin
      .from("leads")
      .select("*", { count: "exact" })
      .eq("data_source", "justdial")
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
        title="JustDial Leads"
        subtitle={`${initialData.total} leads imported from JustDial`}
        actions={
          <div className="flex gap-2">
            <a href="/api/export?data_source=justdial" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </a>
            <Link href="/justdial">
              <Button variant="gradient" size="sm">
                <BookOpen className="w-3.5 h-3.5" /> Search JustDial
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6">
        <LeadsTable
          initialData={initialData}
          dataSource="justdial"
          allowDelete
        />
      </div>
    </div>
  );
}
