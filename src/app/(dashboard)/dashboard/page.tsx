"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Search, Brain, ArrowRight, TrendingUp, Zap } from "lucide-react";
import Header from "@/components/dashboard/Header";
import StatsCards from "@/components/dashboard/StatsCards";
import { Button } from "@/components/ui/button";
import type { DashboardStats, Lead } from "@/types";
import ScoreRing from "@/components/shared/ScoreRing";
import { getStatusColor } from "@/lib/utils";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hotLeads, setHotLeads] = useState<Lead[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [statsRes, leadsRes] = await Promise.all([
        fetch("/api/leads?stats=true"),
        fetch("/api/leads?sortBy=lead_score&sortOrder=desc&pageSize=5&minScore=60"),
      ]);
      const statsData = await statsRes.json();
      const leadsData = await leadsRes.json();
      setStats(statsData);
      setHotLeads(leadsData.leads ?? []);
      setStatsLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle="Clinic Lead Intelligence Platform"
        actions={
          <Link href="/search">
            <Button variant="gradient" size="sm">
              <Search className="w-3.5 h-3.5" /> Find Leads
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <StatsCards stats={stats} loading={statsLoading} />

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              title: "Find New Leads",
              desc: "Scrape Google Maps for clinic prospects",
              icon: Search,
              href: "/search",
              gradient: "from-blue-600 to-cyan-500",
              glow: "shadow-blue-500/25",
            },
            {
              title: "AI Analyze Leads",
              desc: "Score and research your discovered leads",
              icon: Brain,
              href: "/leads",
              gradient: "from-purple-600 to-purple-400",
              glow: "shadow-purple-500/25",
            },
            {
              title: "View Pipeline",
              desc: "Track outreach status and follow-ups",
              icon: TrendingUp,
              href: "/leads",
              gradient: "from-emerald-600 to-emerald-400",
              glow: "shadow-emerald-500/25",
            },
          ].map((action, i) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
            >
              <Link href={action.href}>
                <div className="group rounded-xl border border-white/8 bg-card p-5 hover:border-white/15 transition-all duration-200 cursor-pointer">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-lg ${action.glow} mb-4`}>
                    <action.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{action.desc}</p>
                  <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                    Get started <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Hot Leads */}
        {hotLeads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border border-white/8 bg-card overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-400" />
                <h2 className="font-semibold text-foreground">Hot Leads</h2>
                <span className="text-xs text-muted-foreground">Score 60+</span>
              </div>
              <Link href="/leads">
                <Button variant="ghost" size="sm">View all →</Button>
              </Link>
            </div>

            <div className="divide-y divide-white/5">
              {hotLeads.map((lead) => (
                <Link key={lead.id} href={`/leads/${lead.id}`}>
                  <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/3 transition-colors group">
                    <ScoreRing score={lead.lead_score} size="sm" showLabel={false} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {lead.clinic_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lead.category} · {lead.city}
                      </p>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${getStatusColor(lead.outreach_status)}`}>
                      {lead.outreach_status.replace("_", " ")}
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {!statsLoading && (stats?.totalLeads ?? 0) === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-dashed border-white/15 p-16 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-5">
              <Search className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No leads yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              Start by searching for clinics in your target city to build your lead pipeline.
            </p>
            <Link href="/search">
              <Button variant="gradient" className="mt-6">
                <Search className="w-4 h-4" /> Find Your First Leads
              </Button>
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
