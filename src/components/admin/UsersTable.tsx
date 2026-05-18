"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  User,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  Search,
  UserPlus,
  RefreshCw,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";
import { useUser } from "@/hooks/useUser";
import InviteUserModal from "./InviteUserModal";
import EditUserModal from "./EditUserModal";
import DeleteUserDialog from "./DeleteUserDialog";
import PermissionsModal from "./PermissionsModal";
import toast from "react-hot-toast";
import type { Profile } from "@/types";

interface UserRow extends Profile {
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

export default function UsersTable() {
  const { user: currentUser } = useUser();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filtered, setFiltered] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [permUser, setPermUser] = useState<UserRow | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
      setFiltered(data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? users.filter(
            (u) =>
              u.email.toLowerCase().includes(q) ||
              (u.full_name ?? "").toLowerCase().includes(q)
          )
        : users
    );
  }, [search, users]);

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  }

  function handleCreated(user: UserRow) {
    setUsers((prev) => [user, ...prev]);
    setInviteOpen(false);
  }

  function handleUpdated(updated: UserRow) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setEditUser(null);
  }

  function handleDeleted(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setDeleteUser(null);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={fetchUsers}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </Button>
        <Button
          variant="gradient"
          size="sm"
          onClick={() => setInviteOpen(true)}
          className="gap-1.5"
        >
          <UserPlus className="w-3.5 h-3.5" /> Invite User
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/8 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_140px_120px_120px_48px] gap-4 px-5 py-3 border-b border-white/8 bg-white/2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">User</span>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Role</span>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Joined</span>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Last Sign In</span>
          <span />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading users…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <User className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "No users match your search" : "No users yet"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            <AnimatePresence initial={false}>
              {filtered.map((user, i) => {
                const initials = getInitials(user.full_name, user.email);
                const isSelf = user.id === currentUser?.id;

                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ delay: i * 0.03 }}
                    className="grid grid-cols-[1fr_140px_120px_120px_48px] gap-4 items-center px-5 py-3.5 hover:bg-white/3 transition-colors group"
                  >
                    {/* User */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        {user.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.avatar_url}
                            alt={user.full_name ?? user.email}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/80 to-cyan-400/80 flex items-center justify-center text-xs font-bold text-white">
                            {initials}
                          </div>
                        )}
                        {user.email_confirmed_at ? (
                          <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 text-emerald-400 bg-card rounded-full" />
                        ) : (
                          <Clock className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 text-amber-400 bg-card rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground truncate leading-none">
                            {user.full_name || "—"}
                          </p>
                          {isSelf && (
                            <span className="text-[9px] font-semibold text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded px-1 py-px leading-none">
                              YOU
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    {/* Role */}
                    <div>
                      {user.role === "admin" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-md px-2 py-0.5">
                          <Shield className="w-3 h-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-white/5 border border-white/8 rounded-md px-2 py-0.5">
                          <User className="w-3 h-3" /> User
                        </span>
                      )}
                    </div>

                    {/* Joined */}
                    <p className="text-sm text-muted-foreground">{formatDate(user.created_at)}</p>

                    {/* Last Sign In */}
                    <p className="text-sm text-muted-foreground">{formatDate(user.last_sign_in_at)}</p>

                    {/* Actions */}
                    <div className="relative flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>

                      <AnimatePresence>
                        {openMenu === user.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenu(null)}
                            />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-white/10 bg-card shadow-xl overflow-hidden"
                            >
                              <button
                                onClick={() => { setEditUser(user); setOpenMenu(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => { setPermUser(user); setOpenMenu(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                              >
                                <KeyRound className="w-3.5 h-3.5" /> Permissions
                              </button>
                              {!isSelf && (
                                <button
                                  onClick={() => { setDeleteUser(user); setOpenMenu(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              )}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer count */}
      {!loading && (
        <p className="text-xs text-muted-foreground mt-3">
          {filtered.length} {filtered.length === 1 ? "user" : "users"}
          {search && ` matching "${search}"`}
        </p>
      )}

      {/* Modals */}
      <InviteUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreated={handleCreated}
      />
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onUpdated={handleUpdated}
        />
      )}
      {deleteUser && (
        <DeleteUserDialog
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onDeleted={handleDeleted}
        />
      )}
      {permUser && (
        <PermissionsModal
          user={permUser}
          onClose={() => setPermUser(null)}
          onUpdated={(updated) => {
            setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
            setPermUser(null);
          }}
        />
      )}
    </>
  );
}
