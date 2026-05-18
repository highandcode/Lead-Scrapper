import axios from "axios";
import type { WebsiteAnalysis } from "@/types";

const PARKED_DOMAIN_HOSTS = [
  "hugedomains.com", "godaddy.com", "sedo.com", "dan.com",
  "namecheap.com", "afternic.com", "parkingcrew.net", "bodis.com",
  "above.com", "undeveloped.com", "uniregistry.com",
];

// Doctor/clinic directory platforms — not the clinic's own website
const DIRECTORY_DOMAINS = [
  "apollohospitals.com",
  "practo.com",
  "lybrate.com",
  "justdial.com",
  "sulekha.com",
  "1mg.com",
  "tata1mg.com",
  "healthgrades.com",
  "zocdoc.com",
  "doctorspring.com",
  "bajajfinservhealth.in",
  "medibuddy.in",
  "credihealth.com",
  "docsapp.in",
  "mfine.co",
  "portea.com",
  "docprime.com",
  "myupchar.com",
  "sehat.com",
  "vaidam.com",
];

export function isDirectoryListing(url: string): boolean {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return DIRECTORY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function isParkedDomain(finalUrl: string, html: string): boolean {
  try {
    const host = new URL(finalUrl).hostname;
    if (PARKED_DOMAIN_HOSTS.some((p) => host.includes(p))) return true;
  } catch { /* ignore */ }
  const lower = html.toLowerCase();
  return (
    lower.includes("this domain is for sale") ||
    lower.includes("domain is parked") ||
    lower.includes("buy this domain") ||
    lower.includes("domain parking")
  );
}

function extractEmail(html: string): string | null {
  // mailto: links are most reliable
  const mailtoMatch = html.match(/href=["']mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})["']/i);
  if (mailtoMatch) return mailtoMatch[1].toLowerCase();

  // Fallback: plain email pattern in text (common patterns like info@, contact@, etc.)
  const plainMatch = html.match(/\b(info|contact|hello|enquiry|enquiries|admin|reception|clinic|appointment|care)@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/i);
  if (plainMatch) return plainMatch[0].toLowerCase();

  return null;
}

interface FetchResult {
  html: string;
  title: string;
  description: string;
  parked: boolean;
  email: string | null;
  instagramUsername: string | null;
}

const INSTAGRAM_RESERVED = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "tv", "direct"]);

function extractInstagramFromHtml(html: string): string | null {
  // Match any instagram.com/<username> href in the page
  const matches = html.matchAll(/instagram\.com\/([a-zA-Z0-9._]+)\/?["'\s]/g);
  for (const m of matches) {
    const username = m[1];
    if (!INSTAGRAM_RESERVED.has(username)) return username;
  }
  return null;
}

async function fetchWebsite(url: string): Promise<FetchResult | null> {
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  try {
    const response = await axios.get<string>(normalizedUrl, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClinicLeadBot/1.0; +https://clinicgrowthwithankit.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      responseType: "text",
    });

    const html: string = response.data;
    const finalUrl: string =
      (response.request as { res?: { responseUrl?: string } })?.res?.responseUrl ?? normalizedUrl;

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description/i);

    return {
      html,
      title: titleMatch?.[1]?.trim() ?? "",
      description: descMatch?.[1]?.trim() ?? "",
      parked: isParkedDomain(finalUrl, html),
      email: extractEmail(html),
      instagramUsername: extractInstagramFromHtml(html),
    };
  } catch {
    return null;
  }
}

function analyzeHtml(html: string): Omit<WebsiteAnalysis, "domainParked" | "strengths" | "weaknesses" | "opportunities" | "pitchableServices"> {
  const lower = html.toLowerCase();

  const hasLeadForm =
    lower.includes("<form") &&
    (lower.includes('type="submit"') || lower.includes("book") || lower.includes("enquir") || lower.includes("contact"));

  const hasWhatsAppButton =
    lower.includes("wa.me") ||
    lower.includes("whatsapp") ||
    lower.includes("api.whatsapp.com");

  const hasBookingSystem =
    lower.includes("book") ||
    lower.includes("appointment") ||
    lower.includes("schedule") ||
    lower.includes("calendly") ||
    lower.includes("docprime") ||
    lower.includes("practo");

  // Only detect actual chatbot SDK signatures — script src domains or init calls.
  // Generic words like "chatbot" / "chat" are intentionally excluded because
  // WhatsApp buttons, phone icons, and blog copy routinely trigger false positives.
  const hasChatbot =
    lower.includes("tawk.to") ||
    lower.includes("tawk_api") ||
    lower.includes("embed.tawk.to") ||
    lower.includes("app.intercom.io") ||
    lower.includes("widget.intercom.io") ||
    lower.includes("window.intercom(") ||
    lower.includes("freshchat.com") ||
    lower.includes("wchat.freshchat.com") ||
    lower.includes("drift.com/load/") ||
    lower.includes("js.driftt.com") ||
    lower.includes("ekr.zdassets.com") ||
    lower.includes("zendesk.com/embeddable_framework") ||
    lower.includes("static.zdassets.com") ||
    lower.includes("tidio.co") ||
    lower.includes("code.tidio.co") ||
    lower.includes("window.tidioconfig") ||
    lower.includes("crisp.chat") ||
    lower.includes("client.crisp.chat") ||
    lower.includes("$crisp") ||
    lower.includes("livechatinc.com") ||
    lower.includes("cdn.livechatinc.com") ||
    lower.includes("smartsupp.com") ||
    lower.includes("smart_supp") ||
    lower.includes("olark.com") ||
    lower.includes("olark.identify") ||
    lower.includes("hubspot.com/conversations-visitor") ||
    lower.includes("js.hs-scripts.com") ||
    lower.includes("collect.chat") ||
    lower.includes("chatbase.co") ||
    lower.includes("widget.kommunicate.io") ||
    lower.includes("in.v2.callbell.eu") ||
    lower.includes("botpress.cloud") ||
    lower.includes("landbot.io");

  const hasMetaPixel =
    lower.includes("fbq(") ||
    lower.includes("facebook.net/en_US/fbevents") ||
    lower.includes("connect.facebook.net");

  const hasMobileOptimization =
    lower.includes('name="viewport"') ||
    lower.includes("@media") ||
    lower.includes("responsive");

  const hasModernFramework =
    lower.includes("react") || lower.includes("next") || lower.includes("vue") ||
    lower.includes("tailwind") || lower.includes("bootstrap 5") || lower.includes("material");

  const hasOutdatedIndicators =
    lower.includes("jquery-1.") || lower.includes("jquery-2.") ||
    lower.includes("bootstrap/3.") || html.includes("<!DOCTYPE HTML PUBLIC");

  const designQuality = hasModernFramework ? "good" : hasOutdatedIndicators ? "poor" : "average";

  return {
    hasLandingPage: html.length > 500,
    hasLeadForm,
    hasWhatsAppButton,
    hasBookingSystem,
    hasChatbot,
    hasMetaPixel,
    hasMobileOptimization,
    hasSSL: true,
    designQuality,
    loadingSpeed: "average",
  };
}

function buildNarrative(
  analysis: ReturnType<typeof analyzeHtml>
): Pick<WebsiteAnalysis, "strengths" | "weaknesses" | "opportunities" | "pitchableServices"> {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const opportunities: string[] = [];
  const pitchableServices: string[] = [];

  if (analysis.hasMetaPixel) strengths.push("Facebook Pixel installed — running ads");
  if (analysis.hasBookingSystem) strengths.push("Online booking system present");
  if (analysis.hasMobileOptimization) strengths.push("Mobile-responsive design");
  if (analysis.hasSSL) strengths.push("Secure HTTPS connection");
  if (analysis.hasChatbot) strengths.push("Live chat / chatbot installed");
  if (analysis.hasLandingPage) strengths.push("Full website with content");

  if (!analysis.hasLeadForm) {
    weaknesses.push("No lead capture form found");
    opportunities.push("Add a lead capture form to convert visitors");
    pitchableServices.push("Lead Capture Landing Page");
  }
  if (!analysis.hasWhatsAppButton) {
    weaknesses.push("No WhatsApp CTA on website");
    opportunities.push("WhatsApp click-to-chat button can increase enquiries by 30%+");
    pitchableServices.push("WhatsApp Integration & Automation");
  }
  if (!analysis.hasBookingSystem) {
    weaknesses.push("No online appointment booking");
    opportunities.push("Automated booking system reduces front-desk load");
    pitchableServices.push("AI Appointment Booking System");
  }
  if (!analysis.hasChatbot) {
    weaknesses.push("No chatbot or live chat for instant response");
    opportunities.push("Chatbot can qualify leads 24/7 without staff");
    pitchableServices.push("AI Chatbot / Lead Qualifier");
  }
  if (!analysis.hasMetaPixel) {
    weaknesses.push("No Meta Pixel — cannot run retargeting ads");
    opportunities.push("Install pixel and run targeted ad campaigns");
    pitchableServices.push("Meta Ads Setup & Management");
  }
  if (analysis.designQuality === "poor") {
    weaknesses.push("Outdated website design");
    opportunities.push("Modern redesign can increase credibility and trust");
    pitchableServices.push("Website Redesign (High-Converting)");
  }
  if (!analysis.hasMobileOptimization) {
    weaknesses.push("Poor mobile experience");
    opportunities.push("60%+ of clinic traffic is mobile — fix is critical");
    pitchableServices.push("Mobile-Optimized Landing Page");
  }

  return { strengths, weaknesses, opportunities, pitchableServices };
}

const FETCH_FAILED_RESULT: WebsiteAnalysis = {
  fetchFailed: true,
  hasLandingPage: false,
  hasLeadForm: false,
  hasWhatsAppButton: false,
  hasBookingSystem: false,
  hasChatbot: false,
  hasMetaPixel: false,
  hasMobileOptimization: false,
  hasSSL: false,
  designQuality: "poor",
  loadingSpeed: "slow",
  strengths: [],
  weaknesses: ["Website could not be reached — may be down or blocking bots"],
  opportunities: ["Verify website is live and accessible", "Add WhatsApp CTA and booking system once confirmed"],
  pitchableServices: ["Website Health Check", "Lead Capture Landing Page"],
};

export const DIRECTORY_LISTING_RESULT: WebsiteAnalysis = {
  directoryListing: true,
  hasLandingPage: false,
  hasLeadForm: false,
  hasWhatsAppButton: false,
  hasBookingSystem: false,
  hasChatbot: false,
  hasMetaPixel: false,
  hasMobileOptimization: false,
  hasSSL: false,
  designQuality: "poor",
  loadingSpeed: "average",
  strengths: [],
  weaknesses: [
    "No independent website — only listed on a directory platform",
    "Cannot capture leads outside the platform's ecosystem",
    "Dependent on Practo/Apollo for patient discovery",
  ],
  opportunities: [
    "Build their own brand with a standalone website",
    "Own their patient pipeline instead of paying directory fees",
    "Add WhatsApp & direct booking independent of the platform",
  ],
  pitchableServices: [
    "Website Design & Development",
    "Lead Capture Landing Page",
    "WhatsApp Integration & Automation",
    "AI Appointment Booking System",
    "Google Business Profile Optimization",
  ],
};

export const NO_WEBSITE_RESULT: WebsiteAnalysis = {
  noWebsite: true,
  hasLandingPage: false,
  hasLeadForm: false,
  hasWhatsAppButton: false,
  hasBookingSystem: false,
  hasChatbot: false,
  hasMetaPixel: false,
  hasMobileOptimization: false,
  hasSSL: false,
  designQuality: "poor",
  loadingSpeed: "slow",
  strengths: [],
  weaknesses: [
    "No website — clinic is invisible to online searches",
    "Cannot capture leads digitally",
    "No online booking possible",
  ],
  opportunities: [
    "Build a high-converting website from scratch — massive opportunity",
    "Set up online appointment booking to reduce front-desk load",
    "Add WhatsApp CTA to capture enquiries 24/7",
  ],
  pitchableServices: [
    "Website Design & Development",
    "Lead Capture Landing Page",
    "WhatsApp Integration & Automation",
    "AI Appointment Booking System",
    "Meta Ads Setup & Management",
  ],
};

const PARKED_DOMAIN_RESULT: WebsiteAnalysis = {
  domainParked: true,
  hasLandingPage: false,
  hasLeadForm: false,
  hasWhatsAppButton: false,
  hasBookingSystem: false,
  hasChatbot: false,
  hasMetaPixel: false,
  hasMobileOptimization: false,
  hasSSL: false,
  designQuality: "poor",
  loadingSpeed: "average",
  strengths: [],
  weaknesses: ["Domain is expired or parked — website is not active"],
  opportunities: ["Build a new high-converting website for this clinic"],
  pitchableServices: ["Website Design & Development", "Domain Setup", "Lead Capture Landing Page"],
};

export async function analyzeWebsite(url: string): Promise<{ analysis: WebsiteAnalysis; email: string | null; instagramUsername: string | null } | null> {
  if (!url) return null;
  if (isDirectoryListing(url)) return { analysis: DIRECTORY_LISTING_RESULT, email: null, instagramUsername: null };
  const result = await fetchWebsite(url);
  if (!result) return { analysis: FETCH_FAILED_RESULT, email: null, instagramUsername: null };
  if (result.parked) return { analysis: PARKED_DOMAIN_RESULT, email: null, instagramUsername: null };
  const tech = analyzeHtml(result.html);
  return { analysis: { ...tech, ...buildNarrative(tech) }, email: result.email, instagramUsername: result.instagramUsername };
}

export async function getWebsiteMetadata(url: string): Promise<{ title: string; description: string } | null> {
  const result = await fetchWebsite(url);
  if (!result || result.parked) return null;
  return { title: result.title, description: result.description };
}
