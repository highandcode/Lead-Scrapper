import axios from "axios";
import { extractEmailFromBio, scrapeInstagramProfile } from "./instagram";

// ─── Phone normalisation ─────────────────────────────────────────────────────

function normalisePhone(digits: string): string | null {
  if (digits.length === 12 && digits.startsWith("91") && /^91[6-9]/.test(digits)) return digits;
  if (digits.length === 11 && digits.startsWith("091")) return `91${digits.slice(1)}`;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  return null;
}

// ─── Visible-text extraction ─────────────────────────────────────────────────
// Strips scripts, styles, and tags so we can scan the rendered copy.

function extractVisibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Phone extraction from any text ─────────────────────────────────────────
// Strips separators (spaces, dashes, dots) then finds digit runs — handles
// "+ 91 9667828884", "96-678-28884", "📞9667828884", etc.

function extractPhoneFromText(text: string): string | null {
  const cleaned = text.replace(/[-.\s]/g, "");
  const runs = cleaned.match(/\d+/g) ?? [];
  for (const run of runs) {
    const result = normalisePhone(run);
    if (result) return result;
  }
  return null;
}

// ─── Email extraction ────────────────────────────────────────────────────────

// From HTML: prefer mailto: links, then any visible email address
function extractEmailFromHtml(html: string): string | null {
  const mailtoMatch = html.match(
    /href=["']mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})["']/i,
  );
  if (mailtoMatch) return mailtoMatch[1].toLowerCase();
  return null;
}

// From visible text: broad regex catches any email (gmail, clinic domain, etc.)
function extractEmailFromText(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

// ─── WhatsApp link extraction ────────────────────────────────────────────────

const WA_HREF_PATTERNS = [
  /wa\.me\/(\d{10,13})/i,
  /whatsapp\.com\/send[?&]phone=(\d{10,13})/i,
  /api\.whatsapp\.com\/send[?&]phone=(\d{10,13})/i,
];

function extractWhatsAppFromHtml(html: string): string | null {
  for (const pattern of WA_HREF_PATTERNS) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const result = normalisePhone(match[1]);
      if (result) return result;
    }
  }
  return null;
}

// ─── Scrape a URL for contact details ───────────────────────────────────────
// Returns phone + email found on the page (wa.me links first, then plain text).

interface PageContacts {
  phone: string | null;
  email: string | null;
}

async function scrapePageContacts(url: string): Promise<PageContacts> {
  const normalised = url.startsWith("http") ? url : `https://${url}`;
  let html = "";
  try {
    const res = await axios.get<string>(normalised, {
      timeout: 12_000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      responseType: "text",
    });
    html = typeof res.data === "string" ? res.data : "";
  } catch {
    return { phone: null, email: null };
  }

  if (!html) return { phone: null, email: null };

  const visibleText = extractVisibleText(html);

  // Phone: wa.me links take priority (guaranteed WA number), then plain text scan
  const phone = extractWhatsAppFromHtml(html) ?? extractPhoneFromText(visibleText);

  // Email: mailto: links first, then any email in visible text
  const email = extractEmailFromHtml(html) ?? extractEmailFromText(visibleText);

  return { phone, email };
}

// ─── Main waterfall ──────────────────────────────────────────────────────────

export interface ContactEnrichmentResult {
  whatsapp_phone: string | null;
  clinic_email: string | null;
  sources_tried: string[];
}

interface LeadContactFields {
  website?: string | null;
  google_maps_url?: string | null;          // JustDial URL reused for JD leads
  instagram_username?: string | null;
  instagram_bio?: string | null;
  instagram_external_url?: string | null;   // link-in-bio (often wa.me or clinic site)
  clinic_email?: string | null;
}

export async function enrichContacts(lead: LeadContactFields): Promise<ContactEnrichmentResult> {
  const sources_tried: string[] = [];
  let whatsapp: string | null = null;
  let email: string | null = lead.clinic_email ?? null;

  const done = () => whatsapp !== null && email !== null;

  // ── Step 1: clinic's own website ────────────────────────────────────────
  if (lead.website) {
    sources_tried.push("website");
    const contacts = await scrapePageContacts(lead.website);
    whatsapp = whatsapp ?? contacts.phone;
    email = email ?? contacts.email;
  }
  if (done()) return { whatsapp_phone: whatsapp, clinic_email: email, sources_tried };

  // ── Step 2: Instagram link-in-bio ────────────────────────────────────────
  // Many Indian clinics put their WhatsApp or website as link-in-bio
  if (lead.instagram_external_url) {
    const extUrl = lead.instagram_external_url;

    // Direct wa.me link in the URL itself
    const waMatch = extUrl.match(/wa\.me\/(\d{10,13})/i);
    if (waMatch?.[1]) {
      whatsapp = whatsapp ?? normalisePhone(waMatch[1]);
      sources_tried.push("instagram_link_in_bio");
    } else if (!extUrl.includes("instagram.com")) {
      // Treat it as a website and scrape it
      sources_tried.push("instagram_linked_website");
      const contacts = await scrapePageContacts(extUrl);
      whatsapp = whatsapp ?? contacts.phone;
      email = email ?? contacts.email;
    }
  }
  if (done()) return { whatsapp_phone: whatsapp, clinic_email: email, sources_tried };

  // ── Step 3: Instagram bio text (already in DB) ───────────────────────────
  if (lead.instagram_bio) {
    sources_tried.push("instagram_bio");
    whatsapp = whatsapp ?? extractPhoneFromText(lead.instagram_bio);
    email = email ?? extractEmailFromBio(lead.instagram_bio);
  }
  if (done()) return { whatsapp_phone: whatsapp, clinic_email: email, sources_tried };

  // ── Step 4: follow the Instagram external URL (link-in-bio) ──────────────
  // instagram_external_url may not be in DB (not saved by the enrichment route),
  // so re-scrape the profile to get it whenever we have a username.
  if (lead.instagram_username) {
    sources_tried.push("instagram_scrape");
    try {
      const igData = await scrapeInstagramProfile(lead.instagram_username);
      if (igData) {
        // Check bio if we didn't have it already
        if (igData.bio && !lead.instagram_bio) {
          whatsapp = whatsapp ?? extractPhoneFromText(igData.bio);
          email = email ?? extractEmailFromBio(igData.bio);
        }
        // Fetch the external URL (clinic website linked from Instagram)
        const extUrl = igData.externalUrl ?? lead.instagram_external_url;
        if (extUrl && !extUrl.includes("instagram.com")) {
          const waMatch = extUrl.match(/wa\.me\/(\d{10,13})/i);
          if (waMatch?.[1]) {
            whatsapp = whatsapp ?? normalisePhone(waMatch[1]);
          } else {
            sources_tried.push("instagram_linked_website");
            const contacts = await scrapePageContacts(extUrl);
            whatsapp = whatsapp ?? contacts.phone;
            email = email ?? contacts.email;
          }
        }
      }
    } catch {
      // scrape failed — continue
    }
  }
  if (done()) return { whatsapp_phone: whatsapp, clinic_email: email, sources_tried };

  // ── Step 5: JustDial listing direct fetch ───────────────────────────────
  if (lead.google_maps_url?.includes("justdial.com")) {
    sources_tried.push("justdial_listing");
    const contacts = await scrapePageContacts(lead.google_maps_url);
    whatsapp = whatsapp ?? contacts.phone;
    email = email ?? contacts.email;
  }

  return { whatsapp_phone: whatsapp, clinic_email: email, sources_tried };
}
