"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ExternalLink, Instagram, Globe, Phone, Star, Brain,
  MessageSquare, Download, Search, Filter, ChevronUp,
  ChevronDown, Loader2, ArrowUpDown, X, SlidersHorizontal, Trash2,
} from "lucide-react";
// WhatsApp brand SVG (Lucide doesn't have one)
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ScoreRing from "@/components/shared/ScoreRing";
import { cn, getStatusColor, formatNumber, truncate, toWhatsAppUrl } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Lead, LeadFilters, PaginatedLeads, OutreachStatus } from "@/types";

const STATUS_OPTIONS: { value: OutreachStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "researched", label: "Researched" },
  { value: "contacted", label: "Contacted" },
  { value: "replied", label: "Replied" },
  { value: "meeting_set", label: "Meeting Set" },
  { value: "closed", label: "Closed" },
  { value: "not_interested", label: "Not Interested" },
  { value: "not_on_wa_or_gmail", label: "Not on WA / Gmail" },
];

const SCORE_OPTIONS = [
  { value: "any", label: "Any Score" },
  { value: "40", label: "Score 40+" },
  { value: "60", label: "Score 60+" },
  { value: "70", label: "Score 70+" },
  { value: "80", label: "Score 80+" },
];

const CITY_OPTIONS = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Pune",
  "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Surat",
  "Lucknow", "Chandigarh", "Indore", "Bhopal", "Nagpur",
  "Noida", "Gurgaon", "Moradabad",
];

const NICHE_OPTIONS = [
  "Dermatologist",
  "Hair Clinic",
  "IVF Clinic",
  "Skin Clinic",
  "Dental Clinic",
  "Aesthetic Clinic",
  "Cosmetic Surgeon",
  "Salon",
  "Wellness Center",
  "Spa",
  "Orthopedic Clinic",
  "Eye Clinic",
  "Physiotherapy Clinic",
  "Handicraft",
];

const DEFAULTS = {
  search: "",
  status: "all",
  minScore: "any",
  city: "all",
  niche: "all",
  sortBy: "lead_score" as LeadFilters["sortBy"],
  sortOrder: "desc" as "asc" | "desc",
};

// Read filters from URL search params
function filtersFromParams(params: URLSearchParams): {
  search: string;
  status: string;
  minScore: string;
  city: string;
  niche: string;
  sortBy: LeadFilters["sortBy"];
  sortOrder: "asc" | "desc";
  page: number;
} {
  return {
    search:    params.get("search")    ?? DEFAULTS.search,
    status:    params.get("status")    ?? DEFAULTS.status,
    minScore:  params.get("minScore")  ?? DEFAULTS.minScore,
    city:      params.get("city")      ?? DEFAULTS.city,
    niche:     params.get("niche")     ?? DEFAULTS.niche,
    sortBy:    (params.get("sortBy")   ?? DEFAULTS.sortBy) as LeadFilters["sortBy"],
    sortOrder: (params.get("sortOrder") ?? DEFAULTS.sortOrder) as "asc" | "desc",
    page:      Number(params.get("page") ?? 1),
  };
}

// Convert UI filter values → API LeadFilters
function toApiFilters(ui: ReturnType<typeof filtersFromParams>): LeadFilters {
  return {
    search:          ui.search      || undefined,
    outreach_status: ui.status !== "all" ? (ui.status as OutreachStatus) : undefined,
    minScore:        ui.minScore !== "any" ? Number(ui.minScore) : undefined,
    city:            ui.city !== "all" ? ui.city : undefined,
    category:        ui.niche !== "all" ? ui.niche : undefined,
    sortBy:          ui.sortBy,
    sortOrder:       ui.sortOrder,
    page:            ui.page,
    pageSize:        20,
  };
}

interface LeadsTableProps {
  initialData?: PaginatedLeads;
  dataSource?: string;   // e.g. "justdial" — locks the API query to this source
  allowDelete?: boolean; // show delete buttons
}

export default function LeadsTable({ initialData, dataSource, allowDelete }: LeadsTableProps) {
  const router     = useRouter();
  const pathname   = usePathname();
  const rawParams  = useSearchParams();

  const [data,        setData]        = useState<PaginatedLeads>(
    initialData ?? { leads: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }
  );
  const [ui,          setUi]          = useState(() => filtersFromParams(rawParams));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analyzing,   setAnalyzing]   = useState<Set<string>>(new Set());
  const [loading,     setLoading]     = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────
  // silent=true skips the loading skeleton (background refresh when we already have data)
  const fetchLeads = useCallback(async (apiFilters: LeadFilters, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const p = new URLSearchParams();
      if (apiFilters.search)          p.set("search",          apiFilters.search);
      if (apiFilters.city)            p.set("city",            apiFilters.city);
      if (apiFilters.category)        p.set("category",        apiFilters.category);
      if (apiFilters.outreach_status) p.set("outreach_status", apiFilters.outreach_status);
      if (apiFilters.minScore != null)p.set("minScore",        String(apiFilters.minScore));
      if (apiFilters.sortBy)          p.set("sortBy",          apiFilters.sortBy);
      if (apiFilters.sortOrder)       p.set("sortOrder",       apiFilters.sortOrder);
      if (dataSource)                 p.set("data_source",     dataSource);
      p.set("page",     String(apiFilters.page     ?? 1));
      p.set("pageSize", String(apiFilters.pageSize ?? 20));

      const res  = await fetch(`/api/leads?${p}`);
      const json = await res.json();
      setData(json);
    } catch {
      if (!silent) toast.error("Failed to load leads");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [dataSource]);

  // On mount: always re-fetch so status changes made on the detail page are reflected here.
  // Use silent mode if initialData was provided (no loading flash, data updates in background).
  useEffect(() => {
    const parsed = filtersFromParams(rawParams);
    setUi(parsed);
    const hasSeedData = (initialData?.leads?.length ?? 0) > 0;
    fetchLeads(toApiFilters(parsed), hasSeedData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── URL sync helper ────────────────────────────────────────
  function pushUrl(next: ReturnType<typeof filtersFromParams>) {
    const p = new URLSearchParams();
    if (next.search   && next.search   !== DEFAULTS.search)    p.set("search",    next.search);
    if (next.status   && next.status   !== DEFAULTS.status)    p.set("status",    next.status);
    if (next.minScore && next.minScore !== DEFAULTS.minScore)  p.set("minScore",  next.minScore);
    if (next.city     && next.city     !== DEFAULTS.city)      p.set("city",      next.city);
    if (next.niche    && next.niche    !== DEFAULTS.niche)     p.set("niche",     next.niche);
    if (next.sortBy   && next.sortBy   !== DEFAULTS.sortBy)    p.set("sortBy",    next.sortBy);
    if (next.sortOrder && next.sortOrder !== DEFAULTS.sortOrder) p.set("sortOrder", next.sortOrder);
    if (next.page > 1)                                          p.set("page",      String(next.page));
    const qs = p.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  // ── Apply a filter change ──────────────────────────────────
  function applyFilter(patch: Partial<ReturnType<typeof filtersFromParams>>) {
    const next = { ...ui, ...patch, page: 1 };
    setUi(next);
    pushUrl(next);
    fetchLeads(toApiFilters(next));
  }

  // ── Debounced search ───────────────────────────────────────
  function handleSearch(q: string) {
    const next = { ...ui, search: q, page: 1 };
    setUi(next);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      pushUrl(next);
      fetchLeads(toApiFilters(next));
    }, 350);
  }

  // ── Clear all filters ──────────────────────────────────────
  function clearFilters() {
    const next = { ...DEFAULTS, page: 1 };
    setUi(next);
    router.replace(pathname, { scroll: false });
    fetchLeads(toApiFilters(next));
  }

  // ── Sort ───────────────────────────────────────────────────
  function handleSort(col: LeadFilters["sortBy"]) {
    const order = ui.sortBy === col && ui.sortOrder === "desc" ? "asc" : "desc";
    applyFilter({ sortBy: col, sortOrder: order });
  }

  // ── Pagination ─────────────────────────────────────────────
  function goPage(p: number) {
    const next = { ...ui, page: p };
    setUi(next);
    pushUrl(next);
    fetchLeads(toApiFilters(next));
  }

  // ── Active filter count (for badge) ───────────────────────
  const activeCount = [
    ui.search    !== DEFAULTS.search,
    ui.status    !== DEFAULTS.status,
    ui.minScore  !== DEFAULTS.minScore,
    ui.city      !== DEFAULTS.city,
    ui.niche     !== DEFAULTS.niche,
  ].filter(Boolean).length;

  // ── Active chips ───────────────────────────────────────────
  const chips: { label: string; clear: () => void }[] = [];
  if (ui.search)                   chips.push({ label: `"${ui.search}"`,                        clear: () => applyFilter({ search: "" }) });
  if (ui.status   !== DEFAULTS.status)   chips.push({ label: STATUS_OPTIONS.find(s => s.value === ui.status)?.label ?? ui.status, clear: () => applyFilter({ status: "all" }) });
  if (ui.minScore !== DEFAULTS.minScore) chips.push({ label: SCORE_OPTIONS.find(s => s.value === ui.minScore)?.label ?? ui.minScore, clear: () => applyFilter({ minScore: "any" }) });
  if (ui.city     !== DEFAULTS.city)     chips.push({ label: ui.city,                            clear: () => applyFilter({ city: "all" }) });

  // ── Selection helpers ──────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === data.leads.length && data.leads.length > 0
      ? new Set()
      : new Set(data.leads.map(l => l.id)));
  }

  // ── Analyze ────────────────────────────────────────────────
  async function analyzeLead(leadId: string) {
    setAnalyzing(prev => new Set(prev).add(leadId));
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId }) });
      if (!res.ok) throw new Error();
      toast.success("Lead analyzed!");
      fetchLeads(toApiFilters(ui));
    } catch { toast.error("Analysis failed"); }
    finally { setAnalyzing(prev => { const n = new Set(prev); n.delete(leadId); return n; }); }
  }

  async function analyzeSelected() {
    if (!selectedIds.size) return;
    const ids = Array.from(selectedIds).slice(0, 10);
    const t = toast.loading(`Analyzing ${ids.length} leads…`);
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadIds: ids }) });
      const json = await res.json();
      toast.dismiss(t);
      toast.success(`${json.summary?.succeeded ?? 0} leads analyzed!`);
      setSelectedIds(new Set());
      fetchLeads(toApiFilters(ui));
    } catch { toast.dismiss(t); toast.error("Batch analysis failed"); }
  }

  async function updateStatus(leadId: string, status: OutreachStatus) {
    await fetch(`/api/leads/${leadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outreach_status: status }) });
    setData(prev => ({ ...prev, leads: prev.leads.map(l => l.id === leadId ? { ...l, outreach_status: status } : l) }));
    router.refresh();
  }

  async function deleteLead(leadId: string) {
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setData(prev => ({ ...prev, leads: prev.leads.filter(l => l.id !== leadId), total: prev.total - 1 }));
      toast.success("Lead deleted");
    } catch { toast.error("Delete failed"); }
  }

  async function deleteSelected() {
    if (!selectedIds.size) return;
    const ids = Array.from(selectedIds);
    const t = toast.loading(`Deleting ${ids.length} leads…`);
    try {
      await Promise.all(ids.map(id => fetch(`/api/leads/${id}`, { method: "DELETE" })));
      setData(prev => ({ ...prev, leads: prev.leads.filter(l => !selectedIds.has(l.id)), total: prev.total - ids.length }));
      setSelectedIds(new Set());
      toast.dismiss(t);
      toast.success(`${ids.length} leads deleted`);
    } catch { toast.dismiss(t); toast.error("Bulk delete failed"); }
  }

  function exportCSV() {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds).join(",") : undefined;
    window.open(`/api/export${ids ? `?ids=${ids}` : ""}`, "_blank");
  }

  function SortIcon({ col }: { col: LeadFilters["sortBy"] }) {
    if (ui.sortBy !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return ui.sortOrder === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            placeholder="Search clinics…"
            value={ui.search}
            onChange={e => handleSearch(e.target.value)}
          />
          {ui.search && (
            <button
              onClick={() => applyFilter({ search: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status */}
        <Select value={ui.status} onValueChange={v => applyFilter({ status: v })}>
          <SelectTrigger className={cn("w-44 h-9", ui.status !== DEFAULTS.status && "border-primary/50 text-primary")}>
            <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Min Score */}
        <Select value={ui.minScore} onValueChange={v => applyFilter({ minScore: v })}>
          <SelectTrigger className={cn("w-36 h-9", ui.minScore !== DEFAULTS.minScore && "border-primary/50 text-primary")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCORE_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* City */}
        <Select value={ui.city} onValueChange={v => applyFilter({ city: v })}>
          <SelectTrigger className={cn("w-36 h-9", ui.city !== DEFAULTS.city && "border-primary/50 text-primary")}>
            <SelectValue placeholder="All Cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {CITY_OPTIONS.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Niche */}
        <Select value={ui.niche} onValueChange={v => applyFilter({ niche: v })}>
          <SelectTrigger className={cn("w-40 h-9", ui.niche !== DEFAULTS.niche && "border-primary/50 text-primary")}>
            <SelectValue placeholder="All Niches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Niches</SelectItem>
            {NICHE_OPTIONS.map(n => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        <AnimatePresence>
          {activeCount > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
                Clear
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                  {activeCount}
                </span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1" />

        {/* Bulk actions */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
              <Button variant="outline" size="sm" onClick={analyzeSelected}><Brain className="w-3.5 h-3.5" /> Analyze</Button>
              <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-3.5 h-3.5" /> Export</Button>
              {allowDelete && (
                <Button variant="outline" size="sm" onClick={deleteSelected} className="text-red-400 border-red-500/30 hover:bg-red-500/10">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {selectedIds.size === 0 && (
          <Button variant="outline" size="sm" className="h-9" onClick={exportCSV}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        )}
      </div>

      {/* ── Active filter chips ── */}
      <AnimatePresence>
        {chips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap items-center gap-2 overflow-hidden"
          >
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" /> Active filters:
            </span>
            {chips.map(chip => (
              <button
                key={chip.label}
                onClick={chip.clear}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
              >
                {chip.label}
                <X className="w-2.5 h-2.5" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Table ── */}
      <div className="rounded-xl border border-white/8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/2">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === data.leads.length && data.leads.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-white/20 bg-transparent accent-primary cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort("clinic_name")} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground">
                    Clinic <SortIcon col="clinic_name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact</th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort("rating")} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground">
                    Rating <SortIcon col="rating" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Presence</th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort("lead_score")} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground">
                    Score <SortIcon col="lead_score" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-white/5 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : data.leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Search className="w-8 h-8 text-muted-foreground opacity-30" />
                      <p className="text-muted-foreground text-sm">
                        {activeCount > 0 ? "No leads match your filters." : "No leads yet. Start by searching for clinics."}
                      </p>
                      {activeCount > 0 ? (
                        <Button variant="outline" size="sm" onClick={clearFilters}>Clear Filters</Button>
                      ) : (
                        <Link href="/search"><Button variant="outline" size="sm">Find Leads</Button></Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                data.leads.map(lead => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    selected={selectedIds.has(lead.id)}
                    onSelect={() => toggleSelect(lead.id)}
                    onAnalyze={() => analyzeLead(lead.id)}
                    analyzing={analyzing.has(lead.id)}
                    onStatusChange={s => updateStatus(lead.id, s)}
                    allowDelete={allowDelete}
                    onDelete={() => deleteLead(lead.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/8">
            <p className="text-xs text-muted-foreground">
              {((data.page - 1) * data.pageSize) + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total} leads
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => goPage(data.page - 1)}>Previous</Button>
              {Array.from({ length: Math.min(data.totalPages, 5) }, (_, i) => {
                const page = data.totalPages <= 5 ? i + 1
                  : data.page <= 3 ? i + 1
                  : data.page >= data.totalPages - 2 ? data.totalPages - 4 + i
                  : data.page - 2 + i;
                return (
                  <Button
                    key={page}
                    variant={page === data.page ? "default" : "outline"}
                    size="sm"
                    className="w-8 px-0"
                    onClick={() => goPage(page)}
                  >
                    {page}
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => goPage(data.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-right">{data.total} total leads</p>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────

interface LeadRowProps {
  lead: Lead; selected: boolean;
  onSelect: () => void; onAnalyze: () => void;
  analyzing: boolean; onStatusChange: (s: OutreachStatus) => void;
  allowDelete?: boolean; onDelete?: () => void;
}

function LeadRow({ lead, selected, onSelect, onAnalyze, analyzing, onStatusChange, allowDelete, onDelete }: LeadRowProps) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("group transition-colors hover:bg-white/3", selected && "bg-primary/5")}
    >
      <td className="px-4 py-3.5">
        <input type="checkbox" checked={selected} onChange={onSelect}
          className="rounded border-white/20 bg-transparent accent-primary cursor-pointer" />
      </td>

      <td className="px-4 py-3.5">
        <Link href={`/leads/${lead.id}`} className="block">
          <p className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">{lead.clinic_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {lead.category && <span className="text-[11px] text-muted-foreground">{lead.category}</span>}
            {lead.city && <><span className="text-muted-foreground opacity-30">·</span><span className="text-[11px] text-muted-foreground">{lead.city}</span></>}
          </div>
        </Link>
      </td>

      <td className="px-4 py-3.5">
        <div className="space-y-0.5">
          {lead.phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" /><span className="font-mono">{lead.phone}</span>
            </div>
          )}
          {lead.website && (
            <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
              <Globe className="w-3 h-3" />
              <span className="truncate max-w-[120px]">{truncate(lead.website.replace(/^https?:\/\/(www\.)?/, ""), 20)}</span>
            </a>
          )}
        </div>
      </td>

      <td className="px-4 py-3.5">
        {lead.rating != null ? (
          <div>
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-medium">{lead.rating.toFixed(1)}</span>
            </div>
            <span className="text-[11px] text-muted-foreground">{lead.review_count} reviews</span>
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </td>

      <td className="px-4 py-3.5">
        <div className="flex flex-col gap-1">
          {lead.instagram_username ? (
            <a href={lead.instagram_url ?? `https://instagram.com/${lead.instagram_username}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-pink-400 hover:underline">
              <Instagram className="w-3 h-3" />
              <span>{formatNumber(lead.instagram_followers ?? 0)} followers</span>
            </a>
          ) : (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Instagram className="w-3 h-3 opacity-30" /> No Instagram
            </span>
          )}
          <div className="flex gap-1">
            {lead.has_whatsapp_cta && <Badge variant="success" className="text-[10px] px-1.5 py-0">WA</Badge>}
            {lead.website           && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Web</Badge>}
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        {lead.lead_score != null ? (
          <ScoreRing score={lead.lead_score} size="sm" showLabel={false} />
        ) : (
          <Button variant="ghost" size="icon-sm" onClick={onAnalyze} disabled={analyzing} title="Analyze">
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5 text-muted-foreground" />}
          </Button>
        )}
      </td>

      <td className="px-4 py-3.5">
        <Select value={lead.outreach_status} onValueChange={v => onStatusChange(v as OutreachStatus)}>
          <SelectTrigger className="h-7 w-32 text-xs border-transparent bg-transparent px-2">
            <span className={cn("px-2 py-0.5 rounded-md border text-[11px] font-medium", getStatusColor(lead.outreach_status))}>
              {lead.outreach_status.replace(/_/g, " ")}
            </span>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.slice(1).map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link href={`/leads/${lead.id}`}>
            <Button variant="ghost" size="icon-sm" title="View details"><ExternalLink className="w-3.5 h-3.5" /></Button>
          </Link>
          {lead.lead_score == null && (
            <Button variant="ghost" size="icon-sm" onClick={onAnalyze} disabled={analyzing} title="AI Analyze">
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            </Button>
          )}
          {lead.outreach_instagram_dm && (
            <Link href={`/leads/${lead.id}?tab=outreach`}>
              <Button variant="ghost" size="icon-sm" title="View outreach"><MessageSquare className="w-3.5 h-3.5" /></Button>
            </Link>
          )}
          {lead.google_maps_url && (
            <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon-sm" title="View on Maps"><ExternalLink className="w-3.5 h-3.5" /></Button>
            </a>
          )}
          {toWhatsAppUrl(lead.whatsapp_phone, lead.phone) && (
            <a href={toWhatsAppUrl(lead.whatsapp_phone, lead.phone)!} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon-sm" title="Check on WhatsApp" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                <WhatsAppIcon className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
          {allowDelete && (
            <Button
              variant="ghost" size="icon-sm" title="Delete lead"
              onClick={() => { if (confirm(`Delete "${lead.clinic_name}"?`)) onDelete?.(); }}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </td>
    </motion.tr>
  );
}
