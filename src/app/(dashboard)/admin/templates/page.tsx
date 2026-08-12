import Header from "@/components/dashboard/Header";
import TemplatesManager from "@/components/admin/TemplatesManager";
import { MessageSquareText } from "lucide-react";

export default function AdminTemplatesPage() {
  return (
    <div>
      <Header
        title="WhatsApp Templates"
        subtitle="Manage the message templates users can send from Google Leads"
      />

      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <MessageSquareText className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Templates</h2>
            <p className="text-xs text-muted-foreground">
              Users pick one of these when sending a WhatsApp message to a Google lead
            </p>
          </div>
        </div>

        <TemplatesManager />
      </div>
    </div>
  );
}
