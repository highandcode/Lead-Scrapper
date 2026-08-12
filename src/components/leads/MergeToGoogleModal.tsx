"use client";

import { useState } from "react";
import { Sparkles, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface MergeToGoogleModalProps {
  open: boolean;
  onClose: () => void;
  categories: string[];
  /** Called after a successful merge so the caller can refresh its data. */
  onMerged: () => void;
}

export default function MergeToGoogleModal({ open, onClose, categories, onMerged }: MergeToGoogleModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);

  function toggle(category: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  }

  function handleClose() {
    setSelected(new Set());
    onClose();
  }

  async function merge() {
    if (selected.size === 0) return;
    setMerging(true);
    try {
      const res = await fetch("/api/leads/merge-to-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Merge failed");

      toast.success(
        `${data.merged} lead${data.merged === 1 ? "" : "s"} merged into Google Leads` +
          (data.skippedDuplicates ? ` — ${data.skippedDuplicates} skipped as duplicates` : "")
      );
      onMerged();
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Merge to Google Leads
          </DialogTitle>
          <DialogDescription>
            Pick one or more categories — matching leads not already in Google Leads will be
            moved there. Leads that already exist in Google Leads (same place, phone, or
            name + city) are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No categories found yet.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
              {categories.map((category) => {
                const checked = selected.has(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggle(category)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm text-left transition-colors",
                      checked
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-white/8 bg-white/2 text-muted-foreground hover:bg-white/5"
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 rounded flex items-center justify-center border shrink-0",
                        checked ? "bg-primary border-primary" : "border-white/20"
                      )}
                    >
                      {checked && <Check className="w-3 h-3 text-primary-foreground" />}
                    </span>
                    {category}
                  </button>
                );
              })}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={merging}>Cancel</Button>
          <Button variant="gradient" onClick={merge} disabled={merging || selected.size === 0}>
            {merging ? "Merging…" : `Merge ${selected.size || ""} ${selected.size === 1 ? "Category" : "Categories"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
