import Header from "@/components/dashboard/Header";
import UsersTable from "@/components/admin/UsersTable";
import { Shield } from "lucide-react";

export default function AdminUsersPage() {
  return (
    <div>
      <Header
        title="User Management"
        subtitle="Invite, edit, and remove platform users"
      />

      <div className="p-6">
        {/* Page heading */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">All Users</h2>
            <p className="text-xs text-muted-foreground">
              Manage access and roles for this platform
            </p>
          </div>
        </div>

        <UsersTable />
      </div>
    </div>
  );
}
