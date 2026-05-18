"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut,
  User,
  Settings,
  ChevronUp,
  Shield,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { getInitials } from "@/lib/utils";
import type { Profile } from "@/types";

interface UserMenuProps {
  profile: Profile | null;
  email: string;
}

export default function UserMenu({ profile, email }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const initials = getInitials(profile?.full_name ?? null, email);
  const displayName = profile?.full_name || email.split("@")[0];
  const isAdmin = profile?.role === "admin";

  function handleLogout() {
    startTransition(async () => {
      await logout();
    });
  }

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-sidebar-accent transition-colors group"
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white">
              {initials}
            </div>
          )}
          {isAdmin && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-sidebar flex items-center justify-center">
              <Shield className="w-1.5 h-1.5 text-white" />
            </span>
          )}
        </div>

        {/* Name + email */}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-sidebar-foreground truncate leading-none">
            {displayName}
          </p>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            {isAdmin ? "Admin" : "User"}
          </p>
        </div>

        <ChevronUp
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${
            open ? "rotate-0" : "rotate-180"
          }`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 right-0 mb-2 z-50 rounded-xl border border-white/10 bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden"
            >
              {/* User info header */}
              <div className="px-4 py-3 border-b border-white/8">
                <p className="text-sm font-medium text-foreground truncate">
                  {displayName}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {email}
                </p>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-md px-1.5 py-0.5">
                    <Shield className="w-2.5 h-2.5" /> Admin
                  </span>
                )}
              </div>

              {/* Menu items */}
              <div className="p-1.5 space-y-0.5">
                <button
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  Profile
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Settings
                </button>
              </div>

              {/* Logout */}
              <div className="p-1.5 border-t border-white/8">
                <button
                  onClick={handleLogout}
                  disabled={isPending}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {isPending ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
