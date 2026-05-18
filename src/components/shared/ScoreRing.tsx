"use client";

import { cn, getLeadScoreColor } from "@/lib/utils";

interface ScoreRingProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const sizeMap = {
  sm: { outer: 40, inner: 30, stroke: 3, text: "text-xs", label: "text-[9px]" },
  md: { outer: 56, inner: 44, stroke: 4, text: "text-sm", label: "text-[10px]" },
  lg: { outer: 80, inner: 64, stroke: 5, text: "text-lg", label: "text-xs" },
};

function getScoreGradient(score: number): [string, string] {
  if (score >= 80) return ["#10b981", "#059669"];
  if (score >= 60) return ["#f59e0b", "#d97706"];
  if (score >= 40) return ["#f97316", "#ea580c"];
  return ["#ef4444", "#dc2626"];
}

export default function ScoreRing({ score, size = "md", showLabel = true }: ScoreRingProps) {
  if (score == null) {
    return (
      <div
        className={cn(
          "rounded-full border-2 border-white/10 flex items-center justify-center bg-white/5",
          size === "sm" ? "w-10 h-10" : size === "lg" ? "w-20 h-20" : "w-14 h-14"
        )}
      >
        <span className="text-muted-foreground" style={{ fontSize: size === "sm" ? 10 : 12 }}>N/A</span>
      </div>
    );
  }

  const s = sizeMap[size];
  const radius = (s.outer - s.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const [c1, c2] = getScoreGradient(score);
  const gradientId = `score-grad-${score}-${size}`;

  return (
    <div className="relative inline-flex flex-col items-center gap-1">
      <svg width={s.outer} height={s.outer} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={s.outer / 2}
          cy={s.outer / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={s.stroke}
        />
        {/* Progress */}
        <circle
          cx={s.outer / 2}
          cy={s.outer / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={s.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      {/* Score text */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center rotate-0"
      >
        <span className={cn("font-bold", s.text, getLeadScoreColor(score))}>{score}</span>
        {showLabel && <span className={cn("text-muted-foreground", s.label)}>score</span>}
      </div>
    </div>
  );
}
