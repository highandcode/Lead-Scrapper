"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Check, X, Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import type { WhatsAppTemplate } from "@/types";

const PLACEHOLDER_HINT = "{{name}}, {{phone}}, {{city}}, {{category}}";

interface FormState {
  id: string | null; // null = creating a new template
  name: string;
  content: string;
}

export default function TemplatesManager() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp-templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      setTemplates(await res.json());
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTemplates(); }, []);

  async function save() {
    if (!form || !form.name.trim() || !form.content.trim()) {
      toast.error("Name and message are both required");
      return;
    }
    setSaving(true);
    try {
      const isNew = form.id === null;
      const res = await fetch(
        isNew ? "/api/whatsapp-templates" : `/api/whatsapp-templates/${form.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name.trim(), content: form.content.trim() }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      toast.success(isNew ? "Template created" : "Template updated");
      setForm(null);
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this template? Users will no longer be able to select it.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/whatsapp-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted");
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Placeholders: <code className="text-[11px] px-1 py-0.5 rounded bg-white/5 border border-white/8">{PLACEHOLDER_HINT}</code>
        </p>
        {!form && (
          <Button variant="gradient" size="sm" onClick={() => setForm({ id: null, name: "", content: "" })}>
            <Plus className="w-3.5 h-3.5" /> New Template
          </Button>
        )}
      </div>

      {/* Add / edit form */}
      <AnimatePresence>
        {form && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <Input
                placeholder="Template name (e.g. Intro Offer)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <textarea
                placeholder={`Hi {{name}}, we help businesses like yours in {{city}} grow online...`}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full min-h-28 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setForm(null)}>
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
                <Button variant="gradient" size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-white/8 bg-white/3 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-card p-10 text-center">
          <MessageSquareText className="w-8 h-8 text-muted-foreground opacity-30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No templates yet. Create one so users can send a WhatsApp message with one click.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-white/8 bg-card p-4 flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">{t.content}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost" size="icon-sm"
                  onClick={() => setForm({ id: t.id, name: t.name, content: t.content })}
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost" size="icon-sm"
                  onClick={() => remove(t.id)}
                  disabled={deletingId === t.id}
                  title="Delete"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  {deletingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
