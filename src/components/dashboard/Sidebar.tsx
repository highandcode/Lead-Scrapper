"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Search,
  Users,
  Download,
  Zap,
  TrendingUp,
  Shield,
  UserCog,
  BookOpen,
  ListFilter,
  Globe,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import UserMenu from "./UserMenu";
import type { Profile, UserPermissions } from "@/types";
import { DEFAULT_PERMISSIONS } from "@/types";

// Each nav item is gated by a permission key (null = always visible)
const navItems: { href: string; icon: React.ElementType; label: string; permKey: keyof UserPermissions["pages"] | null }[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard",      permKey: "dashboard" },
  { href: "/search",    icon: Search,          label: "Find Leads",     permKey: "search"    },
  { href: "/justdial",  icon: BookOpen,         label: "Search JustDial",permKey: "justdial"  },
  { href: "/leads",     icon: Users,            label: "All Leads",      permKey: "leads"     },
  { href: "/jd-leads",  icon: ListFilter,       label: "JustDial Leads", permKey: "jdLeads"   },
  { href: "/google-search", icon: Globe,        label: "Google Search",  permKey: "googleSearch" },
  { href: "/google-leads",  icon: Sparkles,     label: "Google Leads",   permKey: "googleLeads"  },
];

const bottomItems: { href: string; icon: React.ElementType; label: string; permKey: keyof UserPermissions["pages"] | null }[] = [
  { href: "/export", icon: Download, label: "Export", permKey: "export" },
];

interface SidebarProps {
  profile: Profile | null;
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const email = profile?.email ?? "";

  // Admins bypass all permission checks; users use their stored permissions (fall back to defaults)
  const isAdmin = profile?.role === "admin";
  const pages: UserPermissions["pages"] = isAdmin
    ? DEFAULT_PERMISSIONS.pages
    : (profile?.permissions?.pages ?? DEFAULT_PERMISSIONS.pages);

  function canSee(permKey: keyof UserPermissions["pages"] | null): boolean {
    if (isAdmin || permKey === null) return true;
    return pages[permKey] ?? true;
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-sidebar border-r border-sidebar-border flex flex-col z-40">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-none">Clinic Lead</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Intelligence Platform</p>
          </div>
        </Link>
      </div>

      {/* Agency Brand */}
      <div className="mx-3 mt-4 p-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-cyan-500/10 border border-blue-500/20">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] font-medium text-blue-300">clinicgrowthwithankit.com</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 mt-4">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
          Navigation
        </p>
        {navItems.filter(item => canSee(item.permKey)).map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary/15 text-sidebar-primary border border-sidebar-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-4 h-4", active ? "text-sidebar-primary" : "text-muted-foreground")} />
                {item.label}
                {active && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary"
                  />
                )}
              </motion.div>
            </Link>
          );
        })}

        {/* Admin section */}
        {profile?.role === "admin" && (
          <>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mt-5 mb-2">
              Admin
            </p>
            {[
              { href: "/admin/users", icon: UserCog, label: "Manage Users" },
            ].map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    whileHover={{ x: 2 }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      active
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4", active ? "text-amber-400" : "text-muted-foreground")} />
                    {item.label}
                    {active && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-sidebar-border space-y-0.5">
        {bottomItems.filter(item => canSee(item.permKey)).map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors">
              <item.icon className="w-4 h-4 text-muted-foreground" />
              {item.label}
            </div>
          </Link>
        ))}

        {/* User menu */}
        <div className="pt-2 border-t border-sidebar-border mt-2">
          <UserMenu profile={profile} email={email} />
        </div>
      </div>
    </aside>
  );
}
