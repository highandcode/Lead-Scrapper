import { jsonCompletion } from "@/lib/openai";
import type { Lead, ScoreBreakdown, WebsiteAnalysis, InstagramAnalysis } from "@/types";

interface ScoringInput {
  clinicName: string;
  category: string;
  rating: number;
  reviewCount: number;
  website: string;
  websiteAnalysis: WebsiteAnalysis | null;
  instagramFollowers: number;
  instagramHasBookingLink: boolean;
  instagramHasLinkInBio: boolean;
  instagramAnalysis: Partial<InstagramAnalysis> | null;
  hasWhatsApp: boolean;
}

function buildHeuristicScore(input: ScoringInput): ScoreBreakdown {
  let websiteScore = 50;
  let instagramScore = 50;
  let conversionScore = 50;
  let automationScore = 50;

  const wa = input.websiteAnalysis;
  const igFollowers = input.instagramFollowers;
  const hasIgBooking = input.instagramHasBookingLink;
  const hasIgLink = input.instagramHasLinkInBio;

  if (wa?.domainParked) {
    websiteScore = 5;
    conversionScore -= 30;
    automationScore -= 20;
  } else if (wa?.noWebsite) {
    // No standalone website — penalize for SEO invisibility, but credit what they DO have via Instagram
    websiteScore = 20; // Always a gap vs having an independent site
    if (!hasIgBooking) { conversionScore -= 15; automationScore -= 15; } // Missing booking capability entirely
    if (!hasIgLink) { conversionScore -= 10; } // No web presence at all from bio
    // Large established chains with no website still have real patients — less urgent need
    if (igFollowers > 50000) websiteScore += 10;
  } else if (wa) {
    if (!wa.hasLandingPage) websiteScore -= 20;
    if (!wa.hasLeadForm) { websiteScore -= 15; conversionScore -= 20; }
    if (!wa.hasWhatsAppButton) { websiteScore -= 10; conversionScore -= 10; }
    if (!wa.hasBookingSystem) { websiteScore -= 10; automationScore -= 20; }
    if (!wa.hasChatbot) automationScore -= 15;
    if (!wa.hasMetaPixel) websiteScore -= 10;
    if (!wa.hasMobileOptimization) websiteScore -= 15;
    if (wa.designQuality === "poor") websiteScore -= 15;
    if (wa.designQuality === "good") websiteScore += 10;
    if (wa.hasMetaPixel) websiteScore += 5;
  }

  const ig = input.instagramAnalysis;
  if (ig) {
    const followers = ig.followers ?? 0;
    if (followers < 500) instagramScore -= 20;
    else if (followers < 2000) instagramScore -= 10;
    else if (followers >= 10000) instagramScore += 10;
    else if (followers >= 50000) instagramScore += 20;
    else if (followers >= 100000) instagramScore += 30;

    if (!ig.hasWhatsAppCTA) { instagramScore -= 10; conversionScore -= 10; }
    if (!ig.hasLinkInBio) instagramScore -= 10;
    if (ig.postingFrequency === "inactive") instagramScore -= 15;
    if (ig.postingFrequency === "frequent") instagramScore += 10;
    // Large account with low engagement = conversion opportunity
    if (followers > 10000 && ig.contentQuality === "poor") {
      conversionScore -= 10; // Low engagement despite large following
    }
  } else {
    instagramScore = 30;
  }

  if (!input.hasWhatsApp) automationScore -= 25;

  if (input.rating >= 4.0 && input.reviewCount > 20) {
    conversionScore += 10;
  }

  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const ws = clamp(websiteScore);
  const is = clamp(instagramScore);
  const cs = clamp(conversionScore);
  const as = clamp(automationScore);

  const overall = Math.round((ws + is + cs + as) / 4);
  const leadPotential = clamp(100 - overall + 20);

  return {
    websiteScore: ws,
    instagramScore: is,
    conversionScore: cs,
    automationScore: as,
    overallPotential: leadPotential,
    reasoning: "Heuristic analysis — awaiting AI enrichment",
  };
}

export async function generateLeadScore(lead: Partial<Lead>): Promise<{
  score: number;
  breakdown: ScoreBreakdown;
  reasoning: string;
}> {
  const input: ScoringInput = {
    clinicName: lead.clinic_name ?? "",
    category: lead.category ?? "",
    rating: lead.rating ?? 0,
    reviewCount: lead.review_count ?? 0,
    website: lead.website ?? "",
    websiteAnalysis: lead.website_analysis ?? null,
    instagramFollowers: lead.instagram_followers ?? 0,
    instagramHasBookingLink: lead.instagram_has_booking_link ?? false,
    instagramHasLinkInBio: lead.has_link_in_bio ?? false,
    instagramAnalysis: lead.instagram_username
      ? {
          followers: lead.instagram_followers ?? 0,
          hasWhatsAppCTA: lead.has_whatsapp_cta ?? false,
          hasLinkInBio: lead.has_link_in_bio ?? false,
          postingFrequency: lead.instagram_enrichment?.postingFrequencyDays
            ? lead.instagram_enrichment.postingFrequencyDays <= 3
              ? "frequent"
              : lead.instagram_enrichment.postingFrequencyDays <= 7
              ? "regular"
              : "rare"
            : "regular",
          contentQuality: (lead.instagram_followers ?? 0) > 10000 ? "good" : (lead.instagram_followers ?? 0) > 2000 ? "average" : "poor",
        }
      : null,
    hasWhatsApp: lead.has_whatsapp_cta ?? false,
  };

  // Use heuristic for baseline
  const heuristic = buildHeuristicScore(input);

  // Enrich with AI reasoning
  const systemPrompt = `You are an expert digital marketing analyst for a clinic growth agency.
Your task is to score a clinic as a lead prospect.
A HIGH score (70-100) means the clinic has POOR marketing — lots of opportunities for your agency.
A LOW score (1-40) means the clinic has GOOD marketing — fewer opportunities.
Return only JSON with: score (1-100), reasoning (2-3 sentences), quickWins (array of 2-3 quick wins you can offer).`;

  const websiteStatus = input.websiteAnalysis?.domainParked
    ? "Domain expired/parked — no active website"
    : input.website
    ? "Has website"
    : "No website";

  const enrichment = lead.instagram_enrichment;
  const igEngagement = enrichment?.realEngagementRate
    ? `${enrichment.realEngagementRate}% (avg ${enrichment.avgLikes} likes, ${enrichment.avgComments} comments)`
    : "unknown";
  const igFrequency = enrichment?.postingFrequencyDays
    ? `every ${enrichment.postingFrequencyDays} day(s)`
    : "unknown";
  const igContentGaps = enrichment
    ? [
        !enrichment.postTypes.beforeAfter && "no before/after posts",
        !enrichment.postTypes.testimonials && "no testimonial posts",
        !lead.has_whatsapp_cta && "no WhatsApp CTA",
        !lead.instagram_has_booking_link && "no booking link",
      ].filter(Boolean).join(", ")
    : "";

  const userPrompt = `Clinic: ${input.clinicName}
Category: ${input.category}
City: ${lead.city ?? "Unknown"}
Google Rating: ${input.rating}/5 (${input.reviewCount} reviews)

Website Status: ${websiteStatus}
Website Issues: ${JSON.stringify(input.websiteAnalysis?.weaknesses ?? [])}
Website Opportunities: ${JSON.stringify(input.websiteAnalysis?.opportunities ?? [])}

Instagram: ${lead.instagram_username ? `@${lead.instagram_username}` : "not found"}
Instagram Followers: ${input.instagramFollowers}
Instagram Engagement Rate: ${igEngagement}
Posting Frequency: ${igFrequency}
Instagram Gaps: ${igContentGaps || "none detected"}
Has WhatsApp CTA: ${input.hasWhatsApp}
Has Booking Link: ${lead.instagram_has_booking_link ? "Yes" : "No"}

Heuristic Score: ${heuristic.overallPotential}/100`;

  try {
    const aiResult = await jsonCompletion<{
      score: number;
      reasoning: string;
      quickWins: string[];
    }>(systemPrompt, userPrompt, { temperature: 0.3, maxTokens: 500 });

    const finalScore = Math.round(
      (heuristic.overallPotential * 0.4) + (aiResult.score * 0.6)
    );

    return {
      score: Math.max(1, Math.min(100, finalScore)),
      breakdown: { ...heuristic, overallPotential: finalScore, reasoning: aiResult.reasoning },
      reasoning: aiResult.reasoning,
    };
  } catch {
    return {
      score: heuristic.overallPotential,
      breakdown: heuristic,
      reasoning: "Score based on automated analysis of website and social presence.",
    };
  }
}
