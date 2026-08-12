import axios from "axios";
import {
  extractVisibleText,
  extractPhoneFromText,
  extractEmailFromHtml,
  extractEmailFromText,
  extractWhatsAppFromHtml,
} from "@/services/scraping/contactEnrichment";

/**
 * Website contact crawler.
 *
 * A Google Business Profile often has no email and sometimes no phone. When
 * that happens we follow the business's own website and hunt for contact
 * details there — homepage first, then the pages a human would click
 * ("Contact", "About", "Reach us") until we have what we need.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Pages worth following when the homepage yields nothing. */
const CONTACT_PATH_HINT =
  /contact|reach[-_]?us|get[-_]?in[-_]?touch|enquir|inquir|about|support|book|appointment/i;

/** Cap on extra pages fetched per site — keeps a scrape bounded and polite. */
const MAX_EXTRA_PAGES = 3;

export interface SiteContacts {
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  title: string;
  description: string;
  /** Pages actually fetched, for transparency in the UI. */
  pagesTried: string[];
}

const EMPTY: SiteContacts = {
  email: null, phone: null, whatsapp: null, instagram: null,
  facebook: null, linkedin: null, title: "", description: "", pagesTried: [],
};

const SOCIAL_RESERVED = new Set([
  "p", "reel", "reels", "stories", "explore", "accounts", "tv", "direct",
  "sharer", "share", "plugins", "tr", "profile.php", "pages", "groups",
  "company", "school", "showcase", "in", "pub",
]);

function extractSocial(html: string, hostPattern: string): string | null {
  const re = new RegExp(`${hostPattern}\\/([A-Za-z0-9._%-]+)\\/?["'\\s?]`, "g");
  for (const m of html.matchAll(re)) {
    const handle = m[1];
    if (!SOCIAL_RESERVED.has(handle.toLowerCase())) return handle;
  }
  return null;
}

function absoluteUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const res = await axios.get<string>(url, {
      timeout: timeoutMs,
      maxRedirects: 5,
      responseType: "text",
      validateStatus: (s) => s >= 200 && s < 400,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      // Some sites stream huge assets; cap the body we are willing to parse.
      maxContentLength: 4 * 1024 * 1024,
    });
    return typeof res.data === "string" ? res.data : null;
  } catch {
    return null;
  }
}

/** Pull every contact signal we can out of a single page's HTML. */
function harvest(html: string): Omit<SiteContacts, "pagesTried"> {
  const text = extractVisibleText(html);

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description/i);

  return {
    email: extractEmailFromHtml(html) ?? extractEmailFromText(text),
    // wa.me links are the most reliable phone signal, then any Indian number.
    phone: extractWhatsAppFromHtml(html) ?? extractPhoneFromText(text),
    whatsapp: extractWhatsAppFromHtml(html),
    instagram: extractSocial(html, "instagram\\.com"),
    facebook: extractSocial(html, "facebook\\.com"),
    linkedin: extractSocial(html, "linkedin\\.com\\/company"),
    title: titleMatch?.[1]?.trim() ?? "",
    description: descMatch?.[1]?.trim() ?? "",
  };
}

/** Merge harvested values into the accumulator, first non-null wins. */
function merge(a: SiteContacts, b: Omit<SiteContacts, "pagesTried">): SiteContacts {
  return {
    email: a.email ?? b.email,
    phone: a.phone ?? b.phone,
    whatsapp: a.whatsapp ?? b.whatsapp,
    instagram: a.instagram ?? b.instagram,
    facebook: a.facebook ?? b.facebook,
    linkedin: a.linkedin ?? b.linkedin,
    title: a.title || b.title,
    description: a.description || b.description,
    pagesTried: a.pagesTried,
  };
}

/** Rank candidate links so "Contact us" is tried before "About". */
function contactLinkScore(url: string): number {
  const u = url.toLowerCase();
  if (/contact|reach|get[-_]?in[-_]?touch/.test(u)) return 3;
  if (/enquir|inquir|book|appointment/.test(u)) return 2;
  if (/about|support/.test(u)) return 1;
  return 0;
}

export interface CrawlOptions {
  /** Per-request timeout. */
  timeoutMs?: number;
  /** Delay between requests to the same host. */
  delayMs?: number;
}

/**
 * Crawl a site for contact details, following contact-ish pages only while
 * something is still missing.
 */
export async function crawlSiteForContacts(
  websiteUrl: string,
  opts: CrawlOptions = {}
): Promise<SiteContacts> {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const delayMs = opts.delayMs ?? Number(process.env.SCRAPE_DELAY_MS ?? 800);

  const base = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
  const homepage = await fetchHtml(base, timeoutMs);
  if (!homepage) return { ...EMPTY, pagesTried: [base] };

  let result: SiteContacts = { ...EMPTY, pagesTried: [base] };
  result = merge(result, harvest(homepage));

  // Homepage already answered the question — do not crawl further.
  if (result.email && result.phone) return result;

  const origin = new URL(base).origin;
  const candidates = new Map<string, number>();

  for (const m of homepage.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    const abs = absoluteUrl(m[1], base);
    if (!abs || !abs.startsWith(origin)) continue;
    if (abs === base || abs === `${base}/`) continue;
    if (!CONTACT_PATH_HINT.test(abs)) continue;
    candidates.set(abs, contactLinkScore(abs));
  }

  const ordered = [...candidates.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_EXTRA_PAGES)
    .map(([url]) => url);

  for (const url of ordered) {
    if (result.email && result.phone) break;
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));

    const html = await fetchHtml(url, timeoutMs);
    result.pagesTried.push(url);
    if (!html) continue;
    result = merge(result, harvest(html));
  }

  return result;
}
