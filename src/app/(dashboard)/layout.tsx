import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import Sidebar from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} />
      <main className="ml-60 flex-1 min-h-screen">{children}</main>
    </div>
  );
}
