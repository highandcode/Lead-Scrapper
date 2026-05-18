"use client";

import { motion } from "framer-motion";
import { Users, Brain, MessageSquare, TrendingUp, Star, Sparkles } from "lucide-react";
import type { DashboardStats } from "@/types";

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" },
  }),
};

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  gradient: string;
  glowColor: string;
  index: number;
}

function StatCard({ label, value, subtitle, icon: Icon, gradient, glowColor, index }: StatCardProps) {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="relative overflow-hidden rounded-xl border border-white/8 bg-card p-5"
    >
      {/* Glow */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ background: glowColor, transform: "translate(30%, -30%)" }}
      />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </motion.div>
  );
}

interface StatsCardsProps {
  stats: DashboardStats | null;
  loading?: boolean;
}

export default function StatsCards({ stats, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-white/8 bg-card shimmer-bg" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Leads",
      value: stats?.totalLeads ?? 0,
      subtitle: `${stats?.newThisWeek ?? 0} added this week`,
      icon: Users,
      gradient: "from-blue-600 to-blue-400",
      glowColor: "#3b82f6",
    },
    {
      label: "Analyzed",
      value: stats?.analyzedLeads ?? 0,
      subtitle: "AI scored leads",
      icon: Brain,
      gradient: "from-purple-600 to-purple-400",
      glowColor: "#8b5cf6",
    },
    {
      label: "Contacted",
      value: stats?.contactedLeads ?? 0,
      subtitle: "In outreach pipeline",
      icon: MessageSquare,
      gradient: "from-emerald-600 to-emerald-400",
      glowColor: "#10b981",
    },
    {
      label: "Avg Lead Score",
      value: stats?.avgLeadScore ?? 0,
      subtitle: "Out of 100",
      icon: TrendingUp,
      gradient: "from-cyan-600 to-cyan-400",
      glowColor: "#06b6d4",
    },
    {
      label: "Hot Leads",
      value: stats?.highScoreLeads ?? 0,
      subtitle: "Score 70+",
      icon: Star,
      gradient: "from-orange-600 to-orange-400",
      glowColor: "#f97316",
    },
    {
      label: "New This Week",
      value: stats?.newThisWeek ?? 0,
      subtitle: "Recently discovered",
      icon: Sparkles,
      gradient: "from-pink-600 to-pink-400",
      glowColor: "#ec4899",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, i) => (
        <StatCard key={card.label} {...card} index={i} />
      ))}
    </div>
  );
}
