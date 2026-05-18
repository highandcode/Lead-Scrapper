"use client";

import { useTransition } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Profile } from "@/types";

interface UserRow extends Profile {
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

interface DeleteUserDialogProps {
  user: UserRow;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export default function DeleteUserDialog({ user, onClose, onDeleted }: DeleteUserDialogProps) {
  const [isPending, startTransition] = useTransition();

  const initials = getInitials(user.full_name, user.email);

  async function handleDelete() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: "DELETE",
        });
        const data = await res.json();

        if (!res.ok) {
          toast.error(data.error ?? "Failed to delete user");
          return;
        }

        toast.success(`${user.email} deleted`);
        onDeleted(user.id);
      } catch {
        toast.error("Unexpected error. Please try again.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <Trash2 className="w-4 h-4" /> Delete User
          </DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-400">
              All leads and data created by this user will remain, but their login access will be permanently revoked.
            </p>
          </div>

          {/* User card */}
          <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/80 to-cyan-400/80 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user.full_name || "—"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Deleting…" : "Yes, Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
