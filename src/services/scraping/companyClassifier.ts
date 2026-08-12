import axios from "axios";
import { extractVisibleText } from "./contactEnrichment";
import { jsonCompletion } from "@/lib/openai";

/**
 * "Is this lead an actual business, or just a page that ranks for the query?"
 *
 * A Google search for "PR agency Delhi" returns three very different things:
 *
 *   1. Real agencies' own sites            → keep, this is the lead.
 *   2. Platform/directory pages            → never a lead. LinkedIn showcase
 *      pages, Pinterest boards, JustDial/Sulekha/Clutch listings.
 *   3. Listicles: "Top 10 PR Firms in Delhi" → the interesting case.
 *
 * The trap is (3). Those articles are usually published *by a real agency* on
 * its own blog to rank for the term — the page is an article, but the domain
 * belongs to a genuine lead. Rejecting on the title ("Top 10…", "54 Best…")
 * throws away exactly the agencies that invest most in their own marketing,
 * while keeping the same title on medium.com or justdial.com would be wrong.
 *
 * So the unit of judgement here is the ROOT DOMAIN, never the URL that
 * happened to rank. We fetch the domain's homepage (and its About page) and
 * ask what the site as a whole is: one business selling its own services, or a
 * directory/publisher that lists other people's. When it's a business, we also
 * recover its real name, because the lead is currently named after the article
 * ("Top 10 PR Firms in Delhi Helping Brands Build Strong…") rather than the
 * company.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Hosts that can never be a single company's own website, so they are rejected
 * without spending a fetch or an OpenAI call on them. Social platforms and
 * user-content sites first, then the B2B directories and review aggregators
 * that dominate "best <service> in <city>" results.
 */
const PLATFORM_HOSTS = [
  // Social / user-generated
  "linkedin.com", "pinterest.com", "pinterest.co.uk", "facebook.com", "instagram.com",
  "twitter.com", "x.com", "youtube.com", "reddit.com", "quora.com", "medium.com",
  "tumblr.com", "blogspot.com", "wordpress.com", "wixsite.com", "weebly.com",
  "substack.com", "slideshare.net", "issuu.com", "behance.net", "dribbble.com",
  // Indian directories / classifieds
  "justdial.com", "sulekha.com", "indiamart.com", "tradeindia.com", "exportersindia.com",
  "quikr.com", "olx.in", "yellowpages.in", "mouthshut.com", "asklaila.com",
  "indiacom.com", "grotal.com", "tradeford.com", "99acres.com", "magicbricks.com",
  // Agency / B2B review aggregators
  "clutch.co", "goodfirms.co", "designrush.com", "sortlist.com", "themanifest.com",
  "agencyspotter.com", "expertise.com", "topdevelopers.co", "superbcompanies.com",
  "trustpilot.com", "yelp.com", "g2.com", "capterra.com",
  // Jobs / employer review
  "glassdoor.com", "glassdoor.co.in", "indeed.com", "ambitionbox.com", "naukri.com",
  "shine.com", "monsterindia.com", "internshala.com", "timesjobs.com",
  // News / reference
  "wikipedia.org", "economictimes.indiatimes.com", "timesofindia.indiatimes.com",
  "business-standard.com", "livemint.com", "forbes.com", "inc42.com", "yourstory.com",
];

/** Phrases that only appear on sites listing OTHER people's businesses. */
const DIRECTORY_COPY =
  /list your business|add your business|claim (this|your) (listing|business|profile)|write a review|browse by category|sponsored listing|get (free )?quotes from|compare (agencies|companies|vendors)|post your requirement|find the best .{0,30}near you|verified listings|advertise with us/i;

export type LeadVerdictKind = "company" | "not_company" | "unknown";

export interface LeadVerdict {
  kind: LeadVerdictKind;
  /** The business's real name, when the site let us recover one. */
  companyName: string | null;
  /** Short human-readable justification, shown in the review list before deleting. */
  reason: string;
  /** Root domain the verdict is about — the cache key and the unit of judgement. */
  domain: string;
}

function rootDomainOf(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isPlatformHost(domain: string): boolean {
  return PLATFORM_HOSTS.some((h) => domain === h || domain.endsWith(`.${h}`));
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const res = await axios.get<string>(url, {
      timeout: timeoutMs,
      maxRedirects: 5,
      responseType: "text",
      validateStatus: (s) => s >= 200 && s < 400,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      maxContentLength: 4 * 1024 * 1024,
    });
    return typeof res.data === "string" ? res.data : null;
  } catch {
    return null;
  }
}

/** Title, meta description and the opening copy — enough to tell what a site is. */
interface SiteProfile {
  title: string;
  description: string;
  text: string;
}

async function readSiteProfile(domain: string, timeoutMs: number): Promise<SiteProfile | null> {
  const homepage = await fetchText(`https://${domain}/`, timeoutMs);
  if (!homepage) return null;

  const title = homepage.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";
  const description =
    homepage.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1]?.trim() ??
    homepage.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description/i)?.[1]?.trim() ??
    "";

  let text = extractVisibleText(homepage);

  // The About page is where a company says what it is in plain words, which is
  // exactly what this decision needs — a homepage is often all slogans.
  const aboutHref = [...homepage.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .find((href) => /\/(about|about-us|who-we-are|company)\/?$/i.test(href));

  if (aboutHref) {
    try {
      const aboutUrl = new URL(aboutHref, `https://${domain}/`).toString();
      const aboutHtml = await fetchText(aboutUrl, timeoutMs);
      if (aboutHtml) text = `${text} ${extractVisibleText(aboutHtml)}`;
    } catch {
      // A malformed href is not worth failing the whole classification over.
    }
  }

  return { title, description, text: text.slice(0, 6000) };
}

interface ClassificationJson {
  isCompany?: boolean;
  companyName?: string | null;
  reason?: string;
}

/**
 * Used when OpenAI is unavailable or errors. Deliberately conservative: it
 * only rejects on the unmistakable directory phrases, because the cost of a
 * wrong "not a company" here is a real lead being deleted.
 */
function heuristicVerdict(domain: string, profile: SiteProfile): LeadVerdict {
  if (DIRECTORY_COPY.test(profile.text)) {
    return {
      kind: "not_company",
      companyName: null,
      reason: "Site invites businesses to list themselves — a directory, not a business",
      domain,
    };
  }
  return {
    kind: "company",
    companyName: profile.title.split(/\s[|\-–—:]\s/)[0].trim() || null,
    reason: "No directory signals found (classified without AI)",
    domain,
  };
}

const CLASSIFIER_SYSTEM = `You classify websites for a B2B lead list.

Decide what the WEBSITE AS A WHOLE is, not what one page on it is about.

isCompany = true when the site belongs to a single business that sells its own
services or products — including when the page that ranked is a blog post or a
"Top 10 …" listicle that the business published on its own site for SEO. A
company that blogs about its competitors is still a company.

isCompany = false when the site's purpose is listing, ranking, reviewing or
aggregating OTHER businesses, or hosting other people's content: directories,
marketplaces, classifieds, review/comparison sites, job boards, news outlets,
magazines, blogging or social platforms, and forums.

companyName: the business's own name as it presents itself (from the site's
branding), NOT the title of the article that ranked. Null when isCompany is false.

reason: one short sentence, max 15 words.

Reply as JSON: {"isCompany": boolean, "companyName": string|null, "reason": string}`;

export interface ClassifyOptions {
  /** The niche searched for, e.g. "PR Agency" — helps the model judge relevance. */
  niche?: string;
  timeoutMs?: number;
  /** Skip the OpenAI call and decide on rules alone. */
  offline?: boolean;
}

/**
 * Verdicts are cached per root domain for the lifetime of the process. A single
 * SEO-heavy domain routinely produces several leads in one scrape (three
 * articles from the same agency's blog), and they must not each pay for their
 * own fetch and OpenAI call — nor be allowed to disagree with each other.
 */
const verdictCache = new Map<string, Promise<LeadVerdict>>();

export function classifyLeadSite(websiteUrl: string, opts: ClassifyOptions = {}): Promise<LeadVerdict> {
  const domain = rootDomainOf(websiteUrl);
  if (!domain) {
    return Promise.resolve({
      kind: "unknown",
      companyName: null,
      reason: "Not a usable URL",
      domain: "",
    });
  }

  let cached = verdictCache.get(domain);
  if (!cached) {
    cached = classifyDomain(domain, opts);
    verdictCache.set(domain, cached);
  }
  return cached;
}

async function classifyDomain(domain: string, opts: ClassifyOptions): Promise<LeadVerdict> {
  if (isPlatformHost(domain)) {
    return {
      kind: "not_company",
      companyName: null,
      reason: `${domain} is a directory or social platform, never a single company's site`,
      domain,
    };
  }

  const profile = await readSiteProfile(domain, opts.timeoutMs ?? 12_000);
  if (!profile) {
    // Unreachable is NOT "not a company" — plenty of real businesses block
    // bots or were briefly down. Left for the caller to keep and review.
    return { kind: "unknown", companyName: null, reason: "Site could not be reached", domain };
  }

  if (opts.offline) return heuristicVerdict(domain, profile);

  try {
    const result = await jsonCompletion<ClassificationJson>(
      CLASSIFIER_SYSTEM,
      [
        `Domain: ${domain}`,
        opts.niche ? `Lead list niche: ${opts.niche}` : null,
        `Title: ${profile.title}`,
        `Meta description: ${profile.description}`,
        `Homepage + About text:\n${profile.text}`,
      ]
        .filter(Boolean)
        .join("\n"),
      { temperature: 0, maxTokens: 300 }
    );

    if (typeof result.isCompany !== "boolean") return heuristicVerdict(domain, profile);

    return {
      kind: result.isCompany ? "company" : "not_company",
      companyName: result.companyName?.trim() || null,
      reason: result.reason?.trim() || (result.isCompany ? "Classified as a business" : "Classified as a directory or publisher"),
      domain,
    };
  } catch (error) {
    console.error(`[classifier] OpenAI classification failed for ${domain}:`, error);
    return heuristicVerdict(domain, profile);
  }
}
