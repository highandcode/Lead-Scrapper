"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Download, FileSpreadsheet, Filter } from "lucide-react";
import Header from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ExportPage() {
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("");

  function buildExportUrl() {
    const params = new URLSearchParams();
    if (city && city !== "all") params.set("city", city);
    if (status && status !== "all") params.set("status", status);
    return `/api/export?${params}`;
  }

  return (
    <div>
      <Header title="Export Leads" subtitle="Download your lead data as CSV" />

      <div className="p-6 max-w-lg space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/8 bg-card p-6 space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">CSV Export</h2>
              <p className="text-xs text-muted-foreground">Excel-compatible format with all lead data</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Filter className="w-3 h-3" /> Filter by City (optional)
              </label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger>
                  <SelectValue placeholder="All cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities</SelectItem>
                  {["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Pune", "Chennai"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Filter by Status (optional)
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="researched">Researched</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <a href={buildExportUrl()} target="_blank" rel="noopener noreferrer">
            <Button variant="gradient" className="w-full">
              <Download className="w-4 h-4" /> Download CSV
            </Button>
          </a>

          <div className="rounded-lg bg-white/3 border border-white/8 p-3">
            <p className="text-xs text-muted-foreground">
              Export includes: clinic name, city, contact, rating, lead score, Instagram details, WhatsApp status, outreach messages, and pipeline status. Max 500 leads per export.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
