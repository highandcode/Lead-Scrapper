"use client";

import { useState, useTransition, useEffect } from "react";
import { Pencil, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";
import type { Profile } from "@/types";

interface UserRow extends Profile {
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

interface EditUserModalProps {
  user: UserRow;
  onClose: () => void;
  onUpdated: (user: UserRow) => void;
}

export default function EditUserModal({ user, onClose, onUpdated }: EditUserModalProps) {
  const [email, setEmail] = useState(user.email);
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [role, setRole] = useState<"user" | "admin">(user.role);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset fields when user changes
  useEffect(() => {
    setEmail(user.email);
    setFullName(user.full_name ?? "");
    setRole(user.role);
    setError(null);
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const payload: Record<string, string> = {};
        if (fullName !== (user.full_name ?? "")) payload.full_name = fullName;
        if (role !== user.role) payload.role = role;
        if (email !== user.email) payload.email = email;

        if (Object.keys(payload).length === 0) {
          onClose();
          return;
        }

        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Failed to update user");
          return;
        }

        toast.success("User updated");
        onUpdated({ ...user, ...data });
      } catch {
        setError("Unexpected error. Please try again.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" /> Edit User
          </DialogTitle>
          <DialogDescription>
            Update profile information and role for this user.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Full name</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isPending}
              />
              {email !== user.email && (
                <p className="text-xs text-amber-400">
                  Changing email will update their login credentials.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Role</label>
              <Select value={role} onValueChange={(v) => setRole(v as "user" | "admin")} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User — limited access</SelectItem>
                  <SelectItem value="admin">Admin — full access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={isPending}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
