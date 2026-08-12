"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Loader2, Search, Building2, Link2, Mail, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 transition-colors duration-200 focus:outline-none",
        enabled ? "bg-primary border-primary" : "bg-white/10 border-white/20"
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

const CITIES = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Pune", "Chennai",
  "Kolkata", "Ahmedabad", "Jaipur", "Surat", "Lucknow", "Chandigarh",
  "Indore", "Bhopal", "Nagpur", "Noida", "Gurgaon", "Moradabad",
];

interface Result {
  count: number;
  scanned: number;
  duplicatesSkipped: number;
  profilesFound: number;
  websitesFound: number;
  contactsEnriched: number;
  query: string;
}

export default function GoogleSearchPanel({
  onSearchComplete,
}: {
  onSearchComplete?: (count: number) => void;
}) {
  const [city, setCity] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [niche, setNiche] = useState("");
  const [limit, setLimit] = useState("20");
  const [enrichContacts, setEnrichContacts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  const effectiveCity = customCity || city;
  const canSearch = effectiveCity.trim() && niche.trim();

  async function handleSearch() {
    if (!canSearch) {
      toast.error("Please pick a city and enter a niche");
      return;
    }

    setLoading(true);
    setResult(null);
    setBlocked(null);

    const query = `${niche} ${effectiveCity}`;
    const pending = toast.loading(
      enrichContacts
        ? `Searching Google and crawling websites for "${query}"…`
        : `Searching Google for "${query}"…`
    );

    try {
      const res = await fetch("/api/scrape/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: effectiveCity,
          niche,
          limit: Number(limit),
          enrichContacts,
        }),
      });
      const data = await res.json();
      toast.dismiss(pending);

      // 429 means Google throttled us — that is not "no results".
      if (res.status === 429 || data.blocked) {
        setBlocked(data.error ?? "Google is rate-limiting this IP.");
        toast.error("Google rate-limited this search");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Search failed");

      setResult({
        count: data.count ?? 0,
        scanned: data.scanned ?? 0,
        duplicatesSkipped: data.duplicatesSkipped ?? 0,
        profilesFound: data.profilesFound ?? 0,
        websitesFound: data.websitesFound ?? 0,
        contactsEnriched: data.contactsEnriched ?? 0,
        query,
      });
      onSearchComplete?.(data.count ?? 0);
      toast.success(data.message ?? `${data.count} new leads`);
    } catch (error) {
      toast.dismiss(pending);
      toast.error(error instanceof Error ? error.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/8 bg-card p-6 space-y-5"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-400 flex items-center justify-center">
          <Globe className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Google Search</h2>
          <p className="text-xs text-muted-foreground">
            Scrapes Google Business Profiles and top-ranking websites directly
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">City</label>
          <Select value={city} onValueChange={(v) => { setCity(v); setCustomCity(""); }}>
            <SelectTrigger><SelectValue placeholder="Select a city" /></SelectTrigger>
            <SelectContent>
              {CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            className="h-9"
            placeholder="…or type any city"
            value={customCity}
            onChange={(e) => setCustomCity(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Niche</label>
          <Input
            placeholder="e.g. Dental Clinic, PR Agency"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
          />
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["10", "20", "30", "50"].map((n) => (
                <SelectItem key={n} value={n}>{n} results</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-white/3 border border-white/8 p-3">
        <div>
          <p className="text-sm text-foreground">Crawl websites for contacts</p>
          <p className="text-xs text-muted-foreground">
            Follows each site&apos;s contact/about pages when the profile has no email or phone. Slower, far richer.
          </p>
        </div>
        <Toggle enabled={enrichContacts} onChange={setEnrichContacts} />
      </div>

      {canSearch && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm">
          Will search: <span className="font-semibold">&quot;{niche} {effectiveCity}&quot;</span> — up to {limit} results
        </div>
      )}

      <Button variant="gradient" className="w-full" onClick={handleSearch} disabled={loading || !canSearch}>
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</>
          : <><Search className="w-4 h-4" /> Find Leads</>}
      </Button>

      <AnimatePresence>
        {blocked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Google rate-limited this search</p>
              <p className="text-xs text-muted-foreground mt-1">{blocked}</p>
            </div>
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-400">
                  {result.count} new {result.count === 1 ? "lead" : "leads"} added
                </p>
                <p className="text-xs text-muted-foreground">
                  for &quot;{result.query}&quot; · scanned {result.scanned}
                  {result.duplicatesSkipped > 0 && `, ${result.duplicatesSkipped} already in your list`}
                </p>
              </div>
              <a href="/google-leads" className="text-xs text-blue-400 hover:underline">View leads →</a>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {result.profilesFound} business profiles</span>
              <span className="flex items-center gap-1.5"><Link2 className="w-3 h-3" /> {result.websitesFound} websites</span>
              <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {result.contactsEnriched} contacts found</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
