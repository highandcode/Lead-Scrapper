"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import Header from "@/components/dashboard/Header";
import JustDialPanel from "@/components/search/JustDialPanel";

const QUICK_SEARCHES = [
  { city: "Mumbai", niche: "Dermatologist" },
  { city: "Delhi", niche: "IVF Clinic" },
  { city: "Bangalore", niche: "Hair Clinic" },
  { city: "Pune", niche: "Aesthetic Clinic" },
  { city: "Chennai", niche: "Dental Clinic" },
  { city: "Hyderabad", niche: "Skin Clinic" },
];

export default function JustDialPage() {
  const [lastCount, setLastCount] = useState<number | null>(null);

  return (
    <div>
      <Header
        title="Search JustDial"
        subtitle="Discover active clinic prospects from JustDial listings"
      />

      <div className="p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <JustDialPanel onSearchComplete={setLastCount} />

          {/* Popular searches */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-white/8 bg-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-semibold text-foreground">Popular Searches</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_SEARCHES.map((s) => (
                <div
                  key={`${s.niche}-${s.city}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15 transition-colors cursor-default"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.niche}</p>
                    <p className="text-xs text-muted-foreground">{s.city}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              ))}
            </div>
          </motion.div>

          {/* Tip */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl bg-orange-500/5 border border-orange-500/15 p-4"
          >
            <p className="text-sm text-orange-300">
              <span className="font-semibold">Why JustDial?</span> Clinics listed on JustDial tend to be more active in local patient acquisition and are often easier to reach — they&apos;ve already invested in being found. Go to{" "}
              <Link href="/leads" className="underline">All Leads</Link> to run AI analysis and generate outreach messages after scraping.
            </p>
          </motion.div>

          {lastCount !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <Link href="/leads">
                <div className="inline-flex items-center gap-2 text-sm text-orange-400 hover:underline">
                  View {lastCount} leads in dashboard <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
