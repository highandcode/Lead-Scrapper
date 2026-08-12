"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft, Brain, Loader2, MessageSquare,
  BarChart2, Download, Pencil, Check, X, RefreshCw, Mail,
} from "lucide-react";
import Header from "@/components/dashboard/Header";
import AnalysisPanel from "@/components/leads/AnalysisPanel";
import OutreachPanel from "@/components/leads/OutreachPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ScoreRing from "@/components/shared/ScoreRing";
import { getStatusColor, toWhatsAppUrl, resolveTemplate } from "@/lib/utils";
import { useUser } from "@/hooks/useUser";
import toast from "react-hot-toast";
import type { Lead, OutreachStatus, WhatsAppTemplate } from "@/types";

// WhatsApp brand SVG (Lucide doesn't have one) — matches LeadsTable's icon.
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const STATUS_OPTIONS: OutreachStatus[] = [
  "new", "researched", "contacted", "replied", "meeting_set", "closed", "not_interested", "not_on_wa_or_gmail"
];

/**
 * Rendered under /leads/[id], /jd-leads/[id] and /google-leads/[id] — one
 * component, three route folders, so a lead opened from JD Leads or Google
 * Leads keeps that section in the URL instead of always landing on the
 * generic "All Leads" route (which used to make the sidebar jump to "All
 * Leads" and lose the section on refresh or a shared link).
 */
export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultTab = searchParams.get("tab") ?? "analysis";

  // Strip the trailing /[id] to recover whichever section this route lives
  // under — /leads, /jd-leads or /google-leads — without hardcoding it.
  const basePath = pathname.replace(/\/[^/]+$/, "") || "/leads";
  const isGoogleLeads = basePath === "/google-leads";
  const { isAdmin } = useUser();
  // AI analysis is an admin-only tool on Google Leads — everywhere else it's available to all roles.
  const showAnalyze = !isGoogleLeads || isAdmin;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [fetchingWa, setFetchingWa] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) ?? null;

  useEffect(() => {
    fetch(`/api/leads/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setLead(data);
        setNotes(data.notes ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  // Google Leads only — templates let users send a pre-filled WhatsApp
  // message without needing AI-generated outreach copy.
  useEffect(() => {
    if (!isGoogleLeads) return;
    fetch("/api/whatsapp-templates")
      .then((r) => r.json())
      .then((json) => setTemplates(Array.isArray(json) ? json : []))
      .catch(() => {});
  }, [isGoogleLeads]);

  async function runAnalysis() {
    if (!lead) return;
    setAnalyzing(true);
    const t = toast.loading("Running AI analysis...");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      if (!res.ok) throw new Error();
      toast.dismiss(t);
      toast.success("Analysis complete!");

      const updated = await fetch(`/api/leads/${lead.id}`).then((r) => r.json());
      setLead(updated);
    } catch {
      toast.dismiss(t);
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveNotes() {
    if (!lead) return;
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setLead((prev) => prev ? { ...prev, notes } : prev);
    setEditingNotes(false);
    toast.success("Notes saved");
  }

  async function updateStatus(status: OutreachStatus) {
    if (!lead) return;
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outreach_status: status,
        last_contacted_at: ["contacted", "replied", "meeting_set"].includes(status)
          ? new Date().toISOString()
          : undefined,
      }),
    });
    setLead((prev) => prev ? { ...prev, outreach_status: status } : prev);
    // Invalidate the router cache so the list page reflects this change when navigating back
    router.refresh();
    toast.success("Status updated");
  }

  async function fetchWhatsApp() {
    if (!lead) return;
    setFetchingWa(true);
    const t = toast.loading("Looking up contact details…");
    try {
      const res = await fetch("/api/enrich/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      const data = await res.json();
      toast.dismiss(t);
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");

      if (data.whatsapp_phone || data.clinic_email) {
        const parts = [];
        if (data.whatsapp_phone) parts.push(`WhatsApp: +${data.whatsapp_phone}`);
        if (data.clinic_email) parts.push(`Email: ${data.clinic_email}`);
        toast.success(parts.join(" · "));
        // Fetch fresh lead from DB so all child components (OutreachPanel etc.) get the updated data
        const updated = await fetch(`/api/leads/${lead.id}`).then((r) => r.json());
        setLead(updated);
      } else {
        toast.error(
          `Nothing found (checked: ${(data.sources_tried ?? []).join(", ") || "no sources"})`,
        );
      }
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setFetchingWa(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Lead not found</p>
        <Link href={basePath}><Button variant="outline">Back to Leads</Button></Link>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={lead.clinic_name}
        subtitle={isGoogleLeads ? (lead.city ?? "") : `${lead.category ?? "Clinic"} · ${lead.city ?? ""}`}
        actions={
          <div className="flex items-center gap-2">
            <a href={`/api/export?ids=${lead.id}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
            </a>
            {showAnalyze && (
              <Button
                variant={lead.lead_score == null ? "gradient" : "outline"}
                size="sm"
                onClick={runAnalysis}
                disabled={analyzing}
              >
                {analyzing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                ) : (
                  <><Brain className="w-3.5 h-3.5" /> {lead.lead_score == null ? "Run Analysis" : "Re-analyze"}</>
                )}
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-5">
        {/* Lead header card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/8 bg-card p-5"
        >
          <div className="flex items-center gap-5">
            {/* Score */}
            <ScoreRing score={lead.lead_score} size="lg" />

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-foreground">{lead.clinic_name}</h2>
                <Select value={lead.outreach_status} onValueChange={(v) => updateStatus(v as OutreachStatus)}>
                  <SelectTrigger className="h-7 w-auto text-xs border-transparent bg-transparent px-2">
                    <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${getStatusColor(lead.outreach_status)}`}>
                      {lead.outreach_status.replace("_", " ")}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {!isGoogleLeads && lead.category && <span className="px-2 py-1 rounded-md bg-white/5 border border-white/8">{lead.category}</span>}
                {lead.city && <span className="px-2 py-1 rounded-md bg-white/5 border border-white/8">{lead.city}</span>}
                {lead.rating && <span className="px-2 py-1 rounded-md bg-white/5 border border-white/8">⭐ {lead.rating.toFixed(1)}</span>}
                {lead.instagram_username && <span className="px-2 py-1 rounded-md bg-pink-500/10 border border-pink-500/20 text-pink-300">@{lead.instagram_username}</span>}
                {lead.phone && (
                  <span className="px-2 py-1 rounded-md bg-white/5 border border-white/8 font-mono">{lead.phone}</span>
                )}
                {lead.clinic_email && (
                  <a
                    href={`mailto:${lead.clinic_email}`}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-300 hover:bg-sky-500/20 transition-colors"
                  >
                    <Mail className="w-3 h-3" />
                    {lead.clinic_email}
                  </a>
                )}
                {toWhatsAppUrl(lead.whatsapp_phone, lead.phone) && (
                  <a
                    href={toWhatsAppUrl(lead.whatsapp_phone, lead.phone)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    {lead.whatsapp_phone ? "WhatsApp (verified)" : "Check on WhatsApp"}
                  </a>
                )}
                {(!lead.whatsapp_phone || !lead.clinic_email) && (
                  <button
                    onClick={fetchWhatsApp}
                    disabled={fetchingWa}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/25 text-violet-300 hover:bg-violet-500/20 transition-colors text-xs disabled:opacity-50"
                  >
                    {fetchingWa ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    {fetchingWa ? "Searching…" : "Find Contact Info"}
                  </button>
                )}
              </div>
            </div>

            {/* Back */}
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
          </div>

          {/* WhatsApp templates — Google Leads only */}
          {isGoogleLeads && (
            <div className="mt-4 pt-4 border-t border-white/8">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Send via WhatsApp</span>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">
                  No templates yet — an admin can add one under WhatsApp Templates.
                </p>
              ) : (
                <div className="flex items-center gap-2 mt-2">
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className="h-9 w-56 text-sm">
                      <SelectValue placeholder="Choose a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(() => {
                    const text = selectedTemplate
                      ? resolveTemplate(selectedTemplate.content, {
                          name: lead.clinic_name, phone: lead.whatsapp_phone ?? lead.phone, city: lead.city, category: lead.category,
                        })
                      : undefined;
                    const url = selectedTemplate ? toWhatsAppUrl(lead.whatsapp_phone, lead.phone, text) : null;
                    return (
                      <Button
                        variant="gradient" size="sm"
                        disabled={!url}
                        onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5" /> Send on WhatsApp
                      </Button>
                    );
                  })()}
                  {!(lead.whatsapp_phone || lead.phone) && (
                    <span className="text-xs text-muted-foreground">No phone number for this lead</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="mt-4 pt-4 border-t border-white/8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</span>
              {editingNotes ? (
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="icon-sm" onClick={saveNotes}>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => { setEditingNotes(false); setNotes(lead.notes ?? ""); }}>
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="icon-sm" onClick={() => setEditingNotes(true)}>
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>
            {editingNotes ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this lead..."
                className="w-full min-h-20 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {lead.notes ?? <span className="italic opacity-50">No notes yet. Click the pencil to add.</span>}
              </p>
            )}
          </div>
        </motion.div>

        {/* Main tabs */}
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="analysis" className="gap-1.5">
              <BarChart2 className="w-3.5 h-3.5" /> Analysis
            </TabsTrigger>
            <TabsTrigger value="outreach" className="gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Outreach Messages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analysis">
            <AnalysisPanel lead={lead} />
          </TabsContent>

          <TabsContent value="outreach">
            <OutreachPanel lead={lead} onRefresh={setLead} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
