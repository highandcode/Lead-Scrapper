"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Tag, Star, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import toast from "react-hot-toast";

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
];

const CITY_OPTIONS = [
  "Mumbai",
  "Delhi",
  "Bangalore",
  "Hyderabad",
  "Pune",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Surat",
  "Lucknow",
  "Chandigarh",
  "Noida",
  "Gurgaon",
];

interface SearchPanelProps {
  onSearchComplete?: (count: number) => void;
}

export default function SearchPanel({ onSearchComplete }: SearchPanelProps) {
  const [city, setCity] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [niche, setNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [limit, setLimit] = useState("20");
  const [minRating, setMinRating] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [lastResult, setLastResult] = useState<{
    count: number;
    scanned: number;
    duplicatesSkipped: number;
    query: string;
  } | null>(null);

  const effectiveCity = customCity || city;
  const effectiveNiche = customNiche || niche;
  const canSearch = effectiveCity.trim() && effectiveNiche.trim();

  async function handleSearch() {
    if (!canSearch) {
      toast.error("Please select a city and niche");
      return;
    }

    setLoading(true);
    setLastResult(null);

    const query = `${effectiveNiche} ${effectiveCity}`;

    const searchToast = toast.loading(`Scraping Google Maps for "${query}"...`);

    try {
      const response = await fetch("/api/scrape/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: effectiveCity,
          niche: effectiveNiche,
          minRating: minRating ? Number(minRating) : undefined,
          limit: Number(limit),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Search failed");
      }

      toast.dismiss(searchToast);
      toast.success(data.message ?? `Found ${data.count} clinics!`);
      setLastResult({
        count: data.count,
        scanned: data.scanned ?? data.count,
        duplicatesSkipped: data.duplicatesSkipped ?? 0,
        query,
      });
      onSearchComplete?.(data.count);
    } catch (error) {
      toast.dismiss(searchToast);
      const message = error instanceof Error ? error.message : "Search failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/8 bg-card overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Search className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Find Clinic Leads</h2>
            <p className="text-xs text-muted-foreground">Scrape Google Maps for clinic prospects in any city</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-6 space-y-5">
        {/* City */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <MapPin className="w-3 h-3" /> City
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Select value={city} onValueChange={(v) => { setCity(v); setCustomCity(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select city..." />
              </SelectTrigger>
              <SelectContent>
                {CITY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Or type custom city..."
              value={customCity}
              onChange={(e) => { setCustomCity(e.target.value); setCity(""); }}
            />
          </div>
        </div>

        {/* Niche */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Tag className="w-3 h-3" /> Clinic Type / Niche
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Select value={niche} onValueChange={(v) => { setNiche(v); setCustomNiche(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select niche..." />
              </SelectTrigger>
              <SelectContent>
                {NICHE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Or type custom niche..."
              value={customNiche}
              onChange={(e) => { setCustomNiche(e.target.value); setNiche(""); }}
            />
          </div>
        </div>

        {/* Advanced filters toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Advanced filters
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Star className="w-3 h-3" /> Min Google Rating
                  </label>
                  <Select value={minRating || "any"} onValueChange={(v) => setMinRating(v === "any" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any rating..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="3">3.0+</SelectItem>
                      <SelectItem value="3.5">3.5+</SelectItem>
                      <SelectItem value="4">4.0+</SelectItem>
                      <SelectItem value="4.5">4.5+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Max Results
                  </label>
                  <Select value={limit} onValueChange={setLimit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 clinics</SelectItem>
                      <SelectItem value="20">20 clinics</SelectItem>
                      <SelectItem value="50">50 clinics</SelectItem>
                      <SelectItem value="100">100 clinics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search preview */}
        {canSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <p className="text-xs text-blue-300">
              Will search: <span className="font-semibold">"{effectiveNiche} {effectiveCity}"</span> — up to {limit} results
            </p>
          </motion.div>
        )}

        {/* Submit */}
        <Button
          variant="gradient"
          size="lg"
          className="w-full"
          onClick={handleSearch}
          disabled={loading || !canSearch}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Scraping Google Maps...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Find Leads
            </>
          )}
        </Button>

        {/* Result */}
        <AnimatePresence>
          {lastResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20"
            >
              <div>
                <p className="text-sm font-semibold text-emerald-400">
                  {lastResult.count} new {lastResult.count === 1 ? "lead" : "leads"} added
                </p>
                <p className="text-xs text-muted-foreground">
                  for "{lastResult.query}"
                  {lastResult.scanned > 0 && (
                    <>
                      {" · "}scanned {lastResult.scanned}
                      {/* Without this, a repeat search looks like the scraper failed. */}
                      {lastResult.duplicatesSkipped > 0 &&
                        `, ${lastResult.duplicatesSkipped} already in your list`}
                    </>
                  )}
                </p>
              </div>
              <a href="/leads" className="text-xs text-blue-400 hover:underline">
                View leads →
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
