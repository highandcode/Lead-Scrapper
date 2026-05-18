"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Shield, LayoutDashboard, Users, Search,
  BookOpen, ListFilter, Download, Brain, Trash2, PenLine, Loader2, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Profile, UserPermissions, UserRole } from "@/types";
import { DEFAULT_PERMISSIONS } from "@/types";

interface PermissionsModalProps {
  user: Profile & { last_sign_in_at: string | null; email_confirmed_at: string | null };
  onClose: () => void;
  onUpdated: (updated: Profile) => void;
}

// ── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 transition-colors duration-200 focus:outline-none",
        enabled ? "bg-primary border-primary" : "bg-white/10 border-white/20",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200",
          enabled ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ── Permission row ────────────────────────────────────────────────────────────

function PermRow({
  icon: Icon,
  label,
  description,
  enabled,
  onChange,
  disabled,
  iconClass,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  iconClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", iconClass ?? "bg-white/5")}>
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground leading-none">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Toggle enabled={enabled} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function PermissionsModal({ user, onClose, onUpdated }: PermissionsModalProps) {
  const isAdmin = user.role === "admin";
  const base: UserPermissions = user.permissions ?? DEFAULT_PERMISSIONS;
  const [perms, setPerms] = useState<UserPermissions>(base);
  const [saving, setSaving] = useState(false);

  function setPage(key: keyof UserPermissions["pages"], val: boolean) {
    setPerms(p => ({ ...p, pages: { ...p.pages, [key]: val } }));
  }
  function setAction(key: keyof UserPermissions["actions"], val: boolean) {
    setPerms(p => ({ ...p, actions: { ...p.actions, [key]: val } }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: perms }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const updated = await res.json();
      toast.success("Permissions saved");
      onUpdated(updated);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function resetToDefault() {
    setPerms(DEFAULT_PERMISSIONS);
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-md rounded-2xl border border-white/10 bg-card shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Permissions</p>
                <p className="text-xs text-muted-foreground">{user.full_name || user.email}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Admin notice */}
            {isAdmin ? (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  Admins always have full access. Permissions only apply to regular users.
                </p>
              </div>
            ) : null}

            {/* Pages section */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Pages — what they can visit
              </p>
              <div className="divide-y divide-white/5">
                <PermRow
                  icon={LayoutDashboard} label="Dashboard" description="Overview stats and metrics"
                  iconClass="bg-blue-500/10" enabled={isAdmin || perms.pages.dashboard}
                  onChange={v => setPage("dashboard", v)} disabled={isAdmin}
                />
                <PermRow
                  icon={Search} label="Find Leads" description="Search Google Maps for clinics"
                  iconClass="bg-cyan-500/10" enabled={isAdmin || perms.pages.search}
                  onChange={v => setPage("search", v)} disabled={isAdmin}
                />
                <PermRow
                  icon={BookOpen} label="Search JustDial" description="Scrape leads from JustDial"
                  iconClass="bg-orange-500/10" enabled={isAdmin || perms.pages.justdial}
                  onChange={v => setPage("justdial", v)} disabled={isAdmin}
                />
                <PermRow
                  icon={Users} label="All Leads" description="View and manage all scraped leads"
                  iconClass="bg-purple-500/10" enabled={isAdmin || perms.pages.leads}
                  onChange={v => setPage("leads", v)} disabled={isAdmin}
                />
                <PermRow
                  icon={ListFilter} label="JustDial Leads" description="Dedicated JustDial leads list"
                  iconClass="bg-indigo-500/10" enabled={isAdmin || perms.pages.jdLeads}
                  onChange={v => setPage("jdLeads", v)} disabled={isAdmin}
                />
                <PermRow
                  icon={Download} label="Export" description="Download leads as CSV"
                  iconClass="bg-emerald-500/10" enabled={isAdmin || perms.pages.export}
                  onChange={v => setPage("export", v)} disabled={isAdmin}
                />
              </div>
            </div>

            {/* Actions section */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Actions — what they can do
              </p>
              <div className="divide-y divide-white/5">
                <PermRow
                  icon={PenLine} label="Import / Add Leads" description="Run searches and save new leads"
                  iconClass="bg-blue-500/10" enabled={isAdmin || perms.actions.leadsWrite}
                  onChange={v => setAction("leadsWrite", v)} disabled={isAdmin}
                />
                <PermRow
                  icon={Brain} label="Run AI Analysis" description="Analyze leads, generate scores & outreach"
                  iconClass="bg-pink-500/10" enabled={isAdmin || perms.actions.analyze}
                  onChange={v => setAction("analyze", v)} disabled={isAdmin}
                />
                <PermRow
                  icon={Trash2} label="Delete Leads" description="Permanently remove leads from the system"
                  iconClass="bg-red-500/10" enabled={isAdmin || perms.actions.leadsDelete}
                  onChange={v => setAction("leadsDelete", v)} disabled={isAdmin}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-white/8">
            <button
              onClick={resetToDefault}
              disabled={isAdmin}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reset to defaults
            </button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button variant="gradient" size="sm" onClick={save} disabled={saving || isAdmin}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
