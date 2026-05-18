"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, AlertTriangle, Lightbulb,
  Globe, Instagram, Star, Phone, MapPin, TrendingUp,
  ShoppingBag, Zap, LinkIcon, WifiOff, Globe2, BookOpen, Mail
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import ScoreRing from "@/components/shared/ScoreRing";
import { formatNumber, getLeadScoreColor } from "@/lib/utils";
import type { Lead } from "@/types";

interface AnalysisPanelProps {
  lead: Lead;
}

function SectionCard({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

export default function AnalysisPanel({ lead }: AnalysisPanelProps) {
  const wa = lead.website_analysis;
  const score = lead.lead_score;
  const breakdown = lead.score_breakdown;

  return (
    <div className="space-y-5">
      {/* Score Overview */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/8 bg-card p-6"
      >
        <div className="flex items-start gap-6">
          <ScoreRing score={score} size="lg" />
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold text-foreground">AI Lead Score</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {lead.score_reasoning ?? "Run AI analysis to generate a score and outreach messages."}
              </p>
            </div>

            {breakdown && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Website", value: breakdown.websiteScore },
                  { label: "Instagram", value: breakdown.instagramScore },
                  { label: "Conversion", value: breakdown.conversionScore },
                  { label: "Automation", value: breakdown.automationScore },
                ].map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className={getLeadScoreColor(item.value)}>{item.value}</span>
                    </div>
                    <Progress value={item.value} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Clinic Info */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <SectionCard title="Clinic Details" icon={MapPin}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {lead.rating != null && (
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-400" />
                <span>{lead.rating.toFixed(1)} / 5</span>
                <span className="text-muted-foreground">({lead.review_count} reviews)</span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                <span className="font-mono">{lead.phone}</span>
              </div>
            )}
            {lead.address && (
              <div className="col-span-2 flex items-start gap-1.5 text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{lead.address}</span>
              </div>
            )}
            {lead.website && (
              <div className="col-span-2 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <a
                  href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline truncate"
                >
                  {lead.website}
                </a>
              </div>
            )}
            {lead.google_maps_url && (
              <a
                href={lead.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-2 text-xs text-muted-foreground hover:text-foreground"
              >
                {lead.data_source === "justdial" ? "→ View on JustDial" : "→ View on Google Maps"}
              </a>
            )}
          </div>
        </SectionCard>
      </motion.div>

      {/* Website Analysis */}
      {wa && Object.keys(wa).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <SectionCard title="Website Analysis" icon={Globe}>
            {wa.directoryListing ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/25">
                  <BookOpen className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-300">Directory Listing Only</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Their website is a profile on Practo / Apollo / JustDial — not their own. They have no independent web presence and are fully dependent on the platform.
                    </p>
                  </div>
                </div>
                {lead.website && (
                  <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Globe className="w-3 h-3" />{lead.website} ↗
                  </a>
                )}
              </div>
            ) : wa.noWebsite ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/25">
                  <Globe2 className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-300">No Website Found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This clinic has no website — they're invisible to online searches. Prime opportunity to pitch a full web presence.
                    </p>
                  </div>
                </div>
                {lead.instagram_external_url && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/25">
                    <LinkIcon className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-purple-300">Link Found in Instagram Bio</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        No standalone website, but they link to an external page from their Instagram bio.
                      </p>
                      <a
                        href={lead.instagram_external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors mt-1 inline-block truncate max-w-xs"
                      >
                        {lead.instagram_external_url} ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : wa.domainParked ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/25">
                  <LinkIcon className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-300">Domain Expired / Parked</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This clinic has a domain on Google Maps but it's no longer active — it redirects to a parking/sale page. Big opportunity to pitch a new website.
                    </p>
                  </div>
                </div>
                {lead.website && (
                  <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Globe className="w-3 h-3" />{lead.website} ↗
                  </a>
                )}
              </div>
            ) : wa.fetchFailed ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-500/10 border border-slate-500/25">
                  <WifiOff className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-300">Website Not Reachable</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      The website URL exists on Google Maps but couldn't be fetched — it may be down, slow, or blocking automated access. Verify manually before outreach.
                    </p>
                  </div>
                </div>
                {lead.website && (
                  <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400 hover:underline">
                    <Globe className="w-3 h-3" />{lead.website} ↗
                  </a>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <CheckItem ok={wa.hasLandingPage} label="Has Landing Page" />
                  <CheckItem ok={wa.hasLeadForm} label="Lead Capture Form" />
                  <CheckItem ok={wa.hasWhatsAppButton} label="WhatsApp CTA Button" />
                  <CheckItem ok={wa.hasBookingSystem} label="Online Booking System" />
                  <CheckItem ok={wa.hasChatbot} label="Chatbot / Live Chat" />
                  <CheckItem ok={wa.hasMetaPixel} label="Meta Pixel (Ads Tracking)" />
                  <CheckItem ok={wa.hasMobileOptimization} label="Mobile Optimized" />
                </div>
                <div className="flex gap-2 flex-wrap pt-1">
                  <Badge variant={wa.designQuality === "good" || wa.designQuality === "excellent" ? "success" : "warning"}>
                    Design: {wa.designQuality}
                  </Badge>
                  <Badge variant="outline">
                    Speed: {wa.loadingSpeed}
                  </Badge>
                </div>
              </>
            )}
          </SectionCard>
        </motion.div>
      )}

      {/* Instagram */}
      {lead.instagram_username && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <SectionCard title="Instagram Presence" icon={Instagram}>
            {/* Header row: handle + verified badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-pink-400">@{lead.instagram_username}</span>
              {lead.instagram_is_verified && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400 font-medium">
                  ✓ Verified
                </span>
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-5">
              <div className="text-center">
                <p className="text-xl font-bold text-foreground">
                  {formatNumber(lead.instagram_followers ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
              {lead.instagram_posts != null && (
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground">{lead.instagram_posts}</p>
                  <p className="text-xs text-muted-foreground">Posts</p>
                </div>
              )}
              {lead.instagram_following != null && (
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground">{lead.instagram_following}</p>
                  <p className="text-xs text-muted-foreground">Following</p>
                </div>
              )}
              {/* Real engagement rate takes priority over estimated */}
              {(lead.instagram_enrichment?.realEngagementRate != null && lead.instagram_enrichment.realEngagementRate > 0) ? (
                <div className="text-center">
                  <p className="text-xl font-bold text-emerald-400">
                    {lead.instagram_enrichment.realEngagementRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Real Engagement</p>
                </div>
              ) : lead.estimated_engagement_rate != null ? (
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground">
                    {lead.estimated_engagement_rate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Est. Engagement</p>
                </div>
              ) : null}
            </div>

            {/* Per-post averages */}
            {lead.instagram_enrichment && lead.instagram_enrichment.avgLikes > 0 && (
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>❤ {lead.instagram_enrichment.avgLikes} avg likes</span>
                <span>💬 {lead.instagram_enrichment.avgComments} avg comments</span>
                {lead.instagram_enrichment.postingFrequencyDays && (
                  <span>📅 every {lead.instagram_enrichment.postingFrequencyDays}d</span>
                )}
              </div>
            )}

            {/* Bio */}
            {lead.instagram_bio && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-white/10 pl-3">
                "{lead.instagram_bio}"
              </p>
            )}

            {/* Email found in bio */}
            {lead.clinic_email && (
              <a
                href={`mailto:${lead.clinic_email}`}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-300 hover:bg-sky-500/20 transition-colors w-fit"
              >
                <Mail className="w-3 h-3" />
                {lead.clinic_email}
              </a>
            )}

            {/* CTA checks */}
            <div className="space-y-1.5">
              <CheckItem ok={lead.has_whatsapp_cta} label="WhatsApp CTA in Bio" />
              <CheckItem ok={lead.instagram_has_booking_link ?? false} label="Booking Link in Bio" />
              <CheckItem ok={lead.has_link_in_bio} label="Link in Bio" />
            </div>

            {/* Actual link in bio URL */}
            {lead.instagram_external_url && (
              <a
                href={lead.instagram_external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:underline break-all"
              >
                🔗 {lead.instagram_external_url}
              </a>
            )}

            {/* Post content types */}
            {lead.instagram_enrichment?.postTypes && (
              <div className="space-y-1.5 pt-1 border-t border-white/6">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Content Mix</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "beforeAfter", label: "Before/After" },
                    { key: "testimonials", label: "Testimonials" },
                    { key: "educational", label: "Educational" },
                    { key: "promotional", label: "Promotions" },
                    { key: "whatsappInPosts", label: "WhatsApp in Posts" },
                  ].map(({ key, label }) => {
                    const active = lead.instagram_enrichment!.postTypes[key as keyof typeof lead.instagram_enrichment.postTypes];
                    return (
                      <span
                        key={key}
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          active
                            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                            : "bg-white/4 border-white/8 text-muted-foreground"
                        }`}
                      >
                        {active ? "✓" : "✗"} {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sample caption */}
            {lead.instagram_enrichment?.sampleCaptions?.[0] && (
              <div className="text-xs text-muted-foreground border-l-2 border-white/8 pl-3 italic">
                Recent: "{lead.instagram_enrichment.sampleCaptions[0]}…"
              </div>
            )}

            {/* Last post warning */}
            {lead.instagram_enrichment?.lastPostDate && (() => {
              const days = Math.floor((Date.now() - new Date(lead.instagram_enrichment!.lastPostDate!).getTime()) / 86400000);
              return days > 30 ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Last post {days} days ago — account appears inactive
                </div>
              ) : null;
            })()}

            {lead.instagram_url && (
              <a
                href={lead.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-pink-400 hover:underline"
              >
                → View Instagram Profile
              </a>
            )}
          </SectionCard>
        </motion.div>
      )}

      {/* Opportunities — filter out items contradicted by Instagram data */}
      {wa?.opportunities && wa.opportunities.length > 0 && (() => {
        const filtered = wa.opportunities.filter((opp) => {
          const lower = opp.toLowerCase();
          if (lead.instagram_has_booking_link && /booking|appointment/i.test(lower)) return false;
          if (lead.has_link_in_bio && /website.*scratch|build.*website/i.test(lower)) return false;
          return true;
        });
        if (!filtered.length) return null;
        return (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <SectionCard title="Growth Opportunities" icon={TrendingUp}>
              <div className="space-y-2">
                {filtered.map((opp, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground">{opp}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </motion.div>
        );
      })()}

      {/* Services to Pitch — filter out services the clinic already has via Instagram */}
      {wa?.pitchableServices && wa.pitchableServices.length > 0 && (() => {
        const filtered = wa.pitchableServices.filter((s) => {
          if (lead.instagram_has_booking_link && /booking/i.test(s)) return false;
          return true;
        });
        if (!filtered.length) return null;
        return (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <SectionCard title="Services to Pitch" icon={ShoppingBag}>
              <div className="flex flex-wrap gap-2">
                {filtered.map((service, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary"
                  >
                    <Zap className="w-3 h-3" />
                    {service}
                  </div>
                ))}
              </div>
            </SectionCard>
          </motion.div>
        );
      })()}

      {/* Weaknesses — filter out items contradicted by Instagram data */}
      {wa?.weaknesses && wa.weaknesses.length > 0 && (() => {
        const filtered = wa.weaknesses.filter((w) => {
          const lower = w.toLowerCase();
          // They have a booking link in bio → "no online booking" is wrong
          if (lead.instagram_has_booking_link && /booking/i.test(lower)) return false;
          // They have any link in bio → "cannot capture leads digitally" is wrong
          if (lead.has_link_in_bio && /capture leads/i.test(lower)) return false;
          return true;
        });
        if (!filtered.length) return null;
        return (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <SectionCard title="Detected Weaknesses" icon={AlertTriangle}>
              <div className="space-y-2">
                {filtered.map((weakness, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">{weakness}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </motion.div>
        );
      })()}
    </div>
  );
}
