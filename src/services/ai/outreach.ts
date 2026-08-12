import { chatCompletion } from "@/lib/openai";
import type { Lead } from "@/types";

interface OutreachMessages {
  instagram_dm: string;
  whatsapp: string;
  email: string;
  followup: string;
}

function buildContext(lead: Partial<Lead>): string {
  const parts: string[] = [];

  // ── Clinic basics ────────────────────────────────────────────────────────
  parts.push(`Clinic: ${lead.clinic_name}`);
  if (lead.category) parts.push(`Type: ${lead.category}`);
  if (lead.city) parts.push(`City: ${lead.city}`);
  if (lead.rating) parts.push(`Google Rating: ${lead.rating}/5 (${lead.review_count ?? 0} reviews)`);
  if (lead.clinic_email) parts.push(`Email: ${lead.clinic_email}`);

  // ── Website status ───────────────────────────────────────────────────────
  const wa = lead.website_analysis;
  if (wa?.noWebsite) {
    if (lead.instagram_external_url) {
      // They have a bio link — this IS a web presence, just not a standalone site
      parts.push(`Website: No standalone website found via Google`);
      parts.push(`Bio Link (their only web presence): ${lead.instagram_external_url}${lead.instagram_has_booking_link ? " — IS a booking page ✓" : " — NOT a booking/enquiry page"}`);
    } else {
      parts.push(`Website: NONE — completely invisible to Google searches, no bio link either`);
    }
  } else if (wa?.directoryListing) {
    parts.push(`Website: Directory listing only (Practo/JustDial/Apollo) — no independent web presence`);
    if (lead.website) parts.push(`Directory URL: ${lead.website}`);
  } else if (wa?.domainParked) {
    parts.push(`Website: Domain exists but expired/parked — no active website`);
    if (lead.website) parts.push(`Dead domain: ${lead.website}`);
  } else if (wa?.fetchFailed) {
    parts.push(`Website: URL exists on Google Maps but not reachable — possibly broken`);
    if (lead.website) parts.push(`Website URL: ${lead.website}`);
  } else if (lead.website) {
    parts.push(`Website: ${lead.website}`);
    if (lead.website_title) parts.push(`Website Title: "${lead.website_title}"`);
  } else if (lead.instagram_external_url) {
    // No website found anywhere, but they have a bio link — acknowledge it
    parts.push(`Website: None found via Google`);
    parts.push(`Bio Link (only web presence): ${lead.instagram_external_url}${lead.instagram_has_booking_link ? " — IS a booking page ✓" : " — not a booking/enquiry page"}`);
  } else {
    parts.push(`Website: NONE — completely invisible to Google searches, no bio link either`);
  }

  // ── Website quality signals ──────────────────────────────────────────────
  if (wa && !wa.noWebsite && !wa.directoryListing && !wa.domainParked) {
    const missing: string[] = [];
    if (!wa.hasLandingPage) missing.push("no dedicated landing page");
    if (!wa.hasLeadForm) missing.push("no lead capture form");
    if (!wa.hasWhatsAppButton) missing.push("no WhatsApp button");
    if (!wa.hasBookingSystem) missing.push("no online booking");
    if (!wa.hasChatbot) missing.push("no chatbot");
    if (!wa.hasMetaPixel) missing.push("no Meta Pixel (no retargeting)");
    if (!wa.hasMobileOptimization) missing.push("not mobile-optimized");
    if (wa.designQuality === "poor") missing.push("poor design quality");

    if (missing.length) parts.push(`Website Missing: ${missing.join(", ")}`);
    if (wa.weaknesses?.length) parts.push(`Website Weaknesses: ${wa.weaknesses.join("; ")}`);
    if (wa.pitchableServices?.length) parts.push(`Services to Pitch: ${wa.pitchableServices.slice(0, 3).join(", ")}`);
  }

  // ── Instagram presence ───────────────────────────────────────────────────
  if (lead.instagram_username) {
    parts.push(`\nInstagram: @${lead.instagram_username}`);
    if (lead.instagram_followers != null) parts.push(`Followers: ${lead.instagram_followers.toLocaleString()}`);
    if (lead.instagram_posts != null) parts.push(`Posts: ${lead.instagram_posts}`);
    if (lead.instagram_bio) parts.push(`Bio: "${lead.instagram_bio}"`);
    if (lead.instagram_is_verified) parts.push(`Verified account: Yes`);

    // Bio link
    if (lead.instagram_external_url && !wa?.noWebsite) {
      parts.push(`Link in Bio: ${lead.instagram_external_url}${lead.instagram_has_booking_link ? " ✓ (booking link)" : " (not a booking page)"}`);
    } else if (!lead.instagram_external_url) {
      parts.push(`Link in Bio: MISSING — losing all profile traffic`);
    }

    // WhatsApp
    if (lead.has_whatsapp_cta) {
      parts.push(`WhatsApp CTA in Bio: Yes — already using WhatsApp for enquiries`);
    } else {
      parts.push(`WhatsApp CTA in Bio: No — no WhatsApp contact in bio`);
    }
  } else {
    parts.push(`\nInstagram: NOT FOUND — no Instagram presence`);
  }

  // ── Post engagement & content analysis ──────────────────────────────────
  const enrichment = lead.instagram_enrichment;
  if (enrichment) {
    if (enrichment.realEngagementRate > 0) {
      const engLabel = enrichment.realEngagementRate < 1 ? "low" : enrichment.realEngagementRate < 3 ? "average" : "good";
      parts.push(`Engagement Rate: ${enrichment.realEngagementRate}% (${engLabel}) — avg ${enrichment.avgLikes} likes & ${enrichment.avgComments} comments per post`);
    }

    if (enrichment.postingFrequencyDays) {
      parts.push(`Posting Frequency: every ${enrichment.postingFrequencyDays} day(s)`);
    }

    if (enrichment.lastPostDate) {
      const daysSince = Math.floor((Date.now() - new Date(enrichment.lastPostDate).getTime()) / 86400000);
      if (daysSince > 30) parts.push(`Last Post: ${daysSince} days ago — account going INACTIVE`);
      else parts.push(`Last Post: ${daysSince} days ago — actively posting`);
    }

    const pt = enrichment.postTypes;
    const has = [
      pt.beforeAfter && "before/after transformations",
      pt.testimonials && "patient testimonials",
      pt.educational && "educational tips",
      pt.promotional && "offers/promotions",
    ].filter(Boolean);
    const missing = [
      !pt.beforeAfter && "before/after results",
      !pt.testimonials && "patient testimonials",
    ].filter(Boolean);

    if (has.length) parts.push(`Content They Post: ${has.join(", ")}`);
    if (missing.length) parts.push(`Content GAP (not posting): ${missing.join(", ")} — major missed trust-building opportunity`);
    if (pt.whatsappInPosts) parts.push(`WhatsApp in Captions: Yes — they push WhatsApp in posts`);

    if (enrichment.sampleCaptions.length) {
      parts.push(`Recent Caption Sample: "${enrichment.sampleCaptions[0].slice(0, 100)}"`);
    }
  }

  return parts.join("\n");
}

const AGENCY_CONTEXT = `You work for "Clinic Growth with Ankit" — an AI automation agency that helps aesthetic clinics,
dermatologists, hair clinics, IVF centers, and dental clinics grow using AI-powered WhatsApp systems,
high-converting landing pages, and lead automation funnels.
Owner: Ankit Agrawal
Phone/WhatsApp: +919910217760
Website: clinicgrowthwithankit.com
Always sign off as "Ankit Agrawal" with phone and website. Never use placeholders like "[Your Name]".`;

export async function generateOutreachMessages(
  lead: Partial<Lead>,
  suggestion?: string
): Promise<OutreachMessages> {
  const context = buildContext(lead);
  const suggestionBlock = suggestion?.trim()
    ? `\nSpecial instruction from Ankit: ${suggestion.trim()}`
    : "";

  const systemPrompt = `${AGENCY_CONTEXT}

You are writing cold outreach for a clinic prospect. You have detailed intelligence about this clinic.

RULES:
- Sound like a human who actually studied their profile — not a template
- Pick the 1-2 MOST compelling pain points from the data and build the entire message around those
- Reference specific numbers or observations (e.g. "86K followers but only 0.1% engagement", "no booking link despite 2K posts")
- Do NOT mention price
- End with a soft, curious question — not a pushy CTA
- Sign off: Ankit Agrawal | +919910217760 | clinicgrowthwithankit.com`;

  const instagramDmPrompt = `${context}${suggestionBlock}

Write an Instagram DM (max 120 words).
- Open with something specific you noticed about THEIR profile (a real observation)
- Name exactly one problem that's costing them patients
- Briefly say how you solve it for clinics
- End with an open question`;

  const whatsappPrompt = `${context}${suggestionBlock}

Write a WhatsApp message (max 80 words). Casual, warm tone. Use short line breaks.
- Mention how you found them / what caught your eye
- One specific thing they're missing that you can fix
- Invite a quick conversation`;

  const emailPrompt = `${context}${suggestionBlock}

Write a cold email:
SUBJECT: [one compelling line, no clickbait]

Body (max 150 words):
- Para 1: Specific observation about their clinic marketing (use real data from the context)
- Para 2: What that's costing them and how you fix it for clinics like theirs
- Para 3: One concrete result or case study (can be hypothetical but realistic)
- CTA: Ask for a 15-min call

Format exactly as:
SUBJECT: [subject]

[body]`;

  const followupPrompt = `${context}${suggestionBlock}

Write a follow-up (max 60 words), 5-7 days after no reply.
- Acknowledge they're probably busy
- Add one new insight or tip specific to their situation
- Keep the door open, no pressure`;

  try {
    const [igDm, whatsapp, emailRaw, followup] = await Promise.all([
      chatCompletion(systemPrompt, instagramDmPrompt, { temperature: 0.75, maxTokens: 300 }),
      chatCompletion(systemPrompt, whatsappPrompt, { temperature: 0.75, maxTokens: 250 }),
      chatCompletion(systemPrompt, emailPrompt, { temperature: 0.7, maxTokens: 400 }),
      chatCompletion(systemPrompt, followupPrompt, { temperature: 0.75, maxTokens: 180 }),
    ]);

    return {
      instagram_dm: igDm.trim(),
      whatsapp: whatsapp.trim(),
      email: emailRaw.trim(),
      followup: followup.trim(),
    };
  } catch {
    return generateFallbackMessages(lead);
  }
}

function generateFallbackMessages(lead: Partial<Lead>): OutreachMessages {
  const name = lead.clinic_name ?? "Doctor";
  const city = lead.city ?? "";
  const wa = lead.website_analysis;
  const noWebsite = wa?.noWebsite || (!lead.website && !lead.instagram_external_url);
  const noBooking = !lead.instagram_has_booking_link;
  const followers = lead.instagram_followers ?? 0;

  const painPoint = noWebsite
    ? "you have no website — your clinic is invisible to Google searches"
    : noBooking && followers > 1000
    ? `you have ${followers.toLocaleString()} Instagram followers but no online booking system, so most of them never convert`
    : "your patient enquiry process could be fully automated";

  return {
    instagram_dm: `Hi ${name},\n\nI noticed ${painPoint}. I help clinics in ${city} fix exactly this using AI-powered WhatsApp systems and landing pages.\n\nWould you be open to seeing how it works for a clinic like yours?\n\n— Ankit Agrawal | clinicgrowthwithankit.com | +919910217760`,

    whatsapp: `Hi, this is Ankit from Clinic Growth with Ankit 👋\n\nI came across ${name} and noticed ${painPoint}.\n\nI help clinics automate patient enquiries using WhatsApp + AI — would love to show you a quick demo.\n\n+919910217760 | clinicgrowthwithankit.com`,

    email: `SUBJECT: Quick observation about ${name}'s patient enquiries\n\nHi,\n\nI recently reviewed ${name}'s online presence and noticed ${painPoint}.\n\nI run an AI automation agency for clinics — we help convert more visitors and followers into booked patients using WhatsApp automation and high-converting landing pages.\n\nClinics we work with typically see 30-40% more enquiries within 60 days. I'd love to show you a 15-minute demo tailored for your clinic.\n\nWould Thursday or Friday work?\n\nBest,\nAnkit Agrawal\n+919910217760\nclinicgrowthwithankit.com`,

    followup: `Hi again — just following up on my note about ${name}.\n\nQuick tip: clinics that add a WhatsApp link to their Google profile see 20-30% more direct enquiries overnight. Happy to set this up for you for free as a starting point.\n\nInterested?\n\n— Ankit | +919910217760`,
  };
}
