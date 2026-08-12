import { searchGoogle, SerpBlockedError } from "./serp";
import { crawlSiteForContacts } from "./contacts";
import { isPlausiblyInCountry } from "@/services/scraping/geo";
import { isDirectoryListing } from "@/services/scraping/website";
import { normalizePhone } from "@/services/scraping/dedupe";
import type { SerpLocalResult, SerpOrganicResult } from "./types";

export { SerpBlockedError };

/**
 * Google lead pipeline: search -> merge -> region filter -> contact enrichment.
 *
 * Two Google surfaces feed this:
 *   - the local pack (Business Profiles), which carries name/rating/address and
 *     sometimes a phone, and
 *   - organic web results, which carry the business's own website.
 *
 * Anything still missing a phone or email after that gets its website crawled,
 * which is where most contact details actually live.
 */

export interface GoogleLeadCandidate {
  clinic_name: string;
  category: string | null;
  city: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  clinic_email: string | null;
  instagram_username: string | null;
  rating: number | null;
  review_count: number | null;
  place_id: string;
  website_title: string | null;
  website_description: string | null;
  /** Which Google surface produced this row. */
  origin: "local_pack" | "organic";
}

export interface GoogleScrapeOptions {
  city: string;
  niche: string;
  limit: number;
  countryCode?: string;
  /** Crawl each website for contact details. Slow but far richer. */
  enrichContacts?: boolean;
  /** Concurrency for the website crawl. */
  concurrency?: number;
}

export interface GoogleScrapeReport {
  candidates: GoogleLeadCandidate[];
  organicCount: number;
  localCount: number;
  outOfRegionDropped: number;
  enrichedCount: number;
}

/** Strip the marketing tail sites put in <title> so names stay comparable. */
function cleanBusinessName(raw: string): string {
  return raw
    .split(/\s[|\-–—:]\s/)[0]
    .replace(/\b(official site|home ?page|home|welcome to)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable identity for dedupe. Domain for organic, name+city for a profile. */
function placeIdFor(origin: "local_pack" | "organic", key: string): string {
  return origin === "organic" ? `gs_${key}` : `gsl_${key}`;
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Run `worker` over `items` with bounded parallelism. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function scrapeGoogleLeads(
  opts: GoogleScrapeOptions
): Promise<GoogleScrapeReport> {
  const query = `${opts.niche} ${opts.city}`;
  const countryCode = opts.countryCode ?? "in";

  const { organic, local } = await searchGoogle(query, {
    limit: opts.limit,
    gl: countryCode,
    hl: "en",
  });

  const candidates: GoogleLeadCandidate[] = [];
  const seenKeys = new Set<string>();
  let outOfRegionDropped = 0;

  // ── Business Profiles first: richer, and they anchor the name/address ──
  for (const l of local as SerpLocalResult[]) {
    if (!isPlausiblyInCountry({ address: l.address, phone: l.phone }, countryCode)) {
      outOfRegionDropped++;
      continue;
    }

    const key = normalizeKey(l.name);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    candidates.push({
      clinic_name: l.name,
      category: l.category,
      city: opts.city,
      address: l.address,
      phone: l.phone,
      website: l.website && !isDirectoryListing(l.website) ? l.website : null,
      clinic_email: null,
      instagram_username: null,
      rating: l.rating,
      review_count: l.reviewCount,
      place_id: placeIdFor("local_pack", `${key}|${normalizeKey(opts.city)}`),
      website_title: null,
      website_description: null,
      origin: "local_pack",
    });
  }

  // ── Organic results: businesses with a site but no Profile in the pack ──
  for (const o of organic as SerpOrganicResult[]) {
    if (isDirectoryListing(o.url)) continue;

    const name = cleanBusinessName(o.title);
    const key = normalizeKey(name);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    candidates.push({
      clinic_name: name,
      category: opts.niche,
      city: opts.city,
      address: null,
      phone: null,
      website: o.url,
      clinic_email: null,
      instagram_username: null,
      rating: null,
      review_count: null,
      place_id: placeIdFor("organic", o.domain),
      website_title: o.title,
      website_description: o.snippet || null,
      origin: "organic",
    });
  }

  // ── Contact enrichment: crawl the website when details are missing ──────
  let enrichedCount = 0;

  if (opts.enrichContacts !== false) {
    const needsContact = candidates.filter(
      (c) => c.website && (!c.phone || !c.clinic_email)
    );

    await mapLimit(
      needsContact,
      opts.concurrency ?? Number(process.env.MAX_CONCURRENT_SCRAPES ?? 3),
      async (candidate) => {
        const found = await crawlSiteForContacts(candidate.website as string);

        // Only accept a phone that is plausibly local — website footers are
        // full of international support numbers.
        const phone = found.phone ?? found.whatsapp;
        if (!candidate.phone && phone && normalizePhone(phone)) {
          candidate.phone = phone;
        }
        candidate.clinic_email ??= found.email;
        candidate.instagram_username ??= found.instagram;
        candidate.website_title ??= found.title || null;
        candidate.website_description ??= found.description || null;

        if (found.email || phone) enrichedCount++;
      }
    );
  }

  return {
    candidates,
    organicCount: organic.length,
    localCount: local.length,
    outOfRegionDropped,
    enrichedCount,
  };
}
