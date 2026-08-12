import Header from "@/components/dashboard/Header";
import LeadsTable from "@/components/leads/LeadsTable";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Globe } from "lucide-react";
import { loadInitialLeads } from "@/lib/initial-leads";

export const dynamic = "force-dynamic";

export default async function GoogleLeadsPage() {
  const initialData = await loadInitialLeads("google_search");

  return (
    <div>
      <Header
        title="Google Leads"
        subtitle={`${initialData.total} leads scraped directly from Google`}
        actions={
          <div className="flex gap-2">
            {/* Export lives in the LeadsTable toolbar, where it can see the
                active filters — a header link here would ignore them. */}
            <Link href="/google-search">
              <Button variant="gradient" size="sm">
                <Globe className="w-3.5 h-3.5" /> Search Google
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6">
        <LeadsTable initialData={initialData} dataSource="google_search" allowDelete />
      </div>
    </div>
  );
}
