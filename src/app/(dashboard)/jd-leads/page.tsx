import Header from "@/components/dashboard/Header";
import LeadsTable from "@/components/leads/LeadsTable";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { loadInitialLeads } from "@/lib/initial-leads";

export const dynamic = "force-dynamic";

export default async function JustDialLeadsPage() {
  const initialData = await loadInitialLeads("justdial");

  return (
    <div>
      <Header
        title="JustDial Leads"
        subtitle={`${initialData.total} leads imported from JustDial`}
        actions={
          <div className="flex gap-2">
            {/* Export lives in the LeadsTable toolbar, where it can see the
                active filters — a header link here would ignore them. */}
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
