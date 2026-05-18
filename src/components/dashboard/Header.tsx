"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/useUser";
import { getInitials } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  const { user, profile } = useUser();

  const initials = user
    ? getInitials(profile?.full_name ?? null, user.email ?? "")
    : "?";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
          <Bell className="w-4 h-4" />
        </Button>
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={profile.full_name ?? "User"}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white">
            {initials}
          </div>
        )}
      </div>
    </header>
  );
}
