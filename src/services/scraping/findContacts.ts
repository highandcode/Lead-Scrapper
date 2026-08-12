import { crawlSiteForContacts } from "./google/contacts";
import { classifyLeadSite, type LeadVerdict } from "./companyClassifier";
import { scrapeInstagramProfile, extractEmailFromBio } from "./instagram";
import { extractPhoneFromText } from "./contactEnrichment";
import { searchGoogle, SerpBlockedError } from "./google/serp";
import type { Lead } from "@/types";

/**
 * "Find contacts" for leads that have no phone number.
 *
 * The ladder, cheapest and most reliable rung first:
 *
 *   1. The lead's own website  — crawled homepage → contact/about pages.
 *   2. Its social handles      — the Instagram profile found on that website,
 *                                whose bio very often carries the number the
 *                                site itself only shows in an image.
 *   3. Google                  — only to FIND a website for a lead that has
 *                                none at all, never as a general search.
 *
 * Rung 3 is last for a reason worth stating: searchGoogle drives a real
 * headless Chromium and paces itself to one page load every 6 seconds
 * process-wide (see serp.ts), and it is the step Google blocks. Running it per
 * lead would make a 50-lead batch take five minutes of pure waiting and would
 * likely end in a CAPTCHA. Leads sourced from Google's organic results already
 * carry their website, so this rung only exists for Business Profile rows that
 * never had one — a minority — and it is opt-in and separately capped.
 */

export interface FindContactsOptions {
  /** The niche being prospected, e.g. "PR Agency" — passed to the classifier. */
  niche?: string;
  /**
   * Look up a website on Google for leads that have none. Off by default: see
   * the note above on why this rung is expensive and block-prone.
   */
  resolveMissingWebsite?: boolean;
  /** Hard cap on Google lookups in one run, regardless of how many leads lack a site. */
  maxWebsiteLookups?: number;
  /** Drop leads whose site turns out to be a directory/publisher rather than a business. */
  classify?: boolean;
  /** Try the Instagram profile when the website yields no phone. Costs Apify credits. */
  useSocialFallback?: boolean;
  timeoutMs?: number;
}

export type FindContactsStatus =
  | "enriched"
  | "nothing_found"
  | "not_a_company"
  | "no_website"
  | "failed";

export interface FindContactsOutcome {
  leadId: string;
  leadName: string;
  status: FindContactsStatus;
  /** Only the fields that actually changed — the caller writes exactly these. */
  updates: Partial<Lead>;
  /** Where a phone number was finally found, for trust when reviewing the batch. */
  source: "website" | "instagram" | null;
  reason: string;
  verdict?: LeadVerdict;
}

/** A lead counts as "has a phone" if either number column is filled. */
export function leadHasPhone(lead: Pick<Lead, "phone" | "whatsapp_phone">): boolean {
  return Boolean(lead.phone?.trim() || lead.whatsapp_phone?.trim());
}

/**
 * Find the business's own site on Google. Takes the first organic result that
 * isn't a platform/directory, which the classifier decides — searching
 * "<name> <city>" reliably surfaces the JustDial and LinkedIn pages for that
 * business above its own site.
 */
async function findWebsiteViaGoogle(
  lead: Pick<Lead, "clinic_name" | "city">,
  opts: FindContactsOptions
): Promise<string | null> {
  const query = [lead.clinic_name, lead.city, "official website"].filter(Boolean).join(" ");

  try {
    const { organic } = await searchGoogle(query, { limit: 5, gl: "in", hl: "en" });
    for (const result of organic) {
      const verdict = await classifyLeadSite(result.url, { niche: opts.niche, timeoutMs: opts.timeoutMs });
      if (verdict.kind !== "not_company") return result.url;
    }
    return null;
  } catch (error) {
    // A block here must not fail the whole batch — every other lead in the run
    // is still enrichable from its own website.
    if (error instanceof SerpBlockedError) {
      console.warn("[findContacts] Google blocked the website lookup:", error.message);
    } else {
      console.error("[findContacts] website lookup failed:", error);
    }
    return null;
  }
}

/** The Instagram rung: a business bio is often the only place the number is text. */
async function contactsFromInstagram(
  username: string
): Promise<{ phone: string | null; email: string | null; followers: number | null }> {
  try {
    const profile = await scrapeInstagramProfile(username);
    if (!profile) return { phone: null, email: null, followers: null };
    const bio = profile.bio ?? "";
    return {
      phone: extractPhoneFromText(bio),
      email: extractEmailFromBio(bio),
      followers: profile.followers ?? null,
    };
  } catch (error) {
    console.error(`[findContacts] Instagram lookup failed for @${username}:`, error);
    return { phone: null, email: null, followers: null };
  }
}

export async function findContactsForLead(
  lead: Lead,
  opts: FindContactsOptions,
  budget: { websiteLookupsLeft: number }
): Promise<FindContactsOutcome> {
  const base = { leadId: lead.id, leadName: lead.clinic_name };

  try {
    // ── 1. Make sure we have a website to work from ────────────────────────
    let website = lead.website?.trim() || null;
    let websiteFromGoogle = false;

    if (!website && opts.resolveMissingWebsite && budget.websiteLookupsLeft > 0) {
      budget.websiteLookupsLeft--;
      website = await findWebsiteViaGoogle(lead, opts);
      websiteFromGoogle = website !== null;
    }

    if (!website) {
      return {
        ...base,
        status: "no_website",
        updates: {},
        source: null,
        reason: opts.resolveMissingWebsite
          ? "No website on the lead and none found on Google"
          : "No website on the lead (Google lookup is off)",
      };
    }

    // ── 2. Is this domain even a business? ────────────────────────────────
    let verdict: LeadVerdict | undefined;
    if (opts.classify !== false) {
      verdict = await classifyLeadSite(website, { niche: opts.niche, timeoutMs: opts.timeoutMs });
      if (verdict.kind === "not_company") {
        return {
          ...base,
          status: "not_a_company",
          updates: {},
          source: null,
          reason: verdict.reason,
          verdict,
        };
      }
    }

    // ── 3. Crawl the site ────────────────────────────────────────────────
    const found = await crawlSiteForContacts(website, { timeoutMs: opts.timeoutMs });

    const updates: Partial<Lead> = {};
    let source: FindContactsOutcome["source"] = null;

    // crawlSiteForContacts already normalises numbers to 91XXXXXXXXXX via
    // extractPhoneFromText, so anything non-null here is a plausible number.
    const sitePhone = found.phone ?? found.whatsapp;
    if (sitePhone) {
      updates.phone = sitePhone;
      source = "website";
    }
    if (found.whatsapp && !lead.whatsapp_phone) updates.whatsapp_phone = found.whatsapp;
    if (found.email && !lead.clinic_email) updates.clinic_email = found.email;
    if (found.instagram && !lead.instagram_username) updates.instagram_username = found.instagram;
    if (found.title && !lead.website_title) updates.website_title = found.title;
    if (found.description && !lead.website_description) updates.website_description = found.description;
    if (websiteFromGoogle) updates.website = website;

    // The classifier read the site's own branding; the lead is often still
    // named after the article that ranked ("Top 10 PR Firms in Delhi…").
    if (verdict?.companyName && verdict.companyName !== lead.clinic_name && looksLikeArticleTitle(lead.clinic_name)) {
      updates.clinic_name = verdict.companyName;
    }

    // ── 4. Social fallback, only while a phone is still missing ──────────
    const instagramHandle = found.instagram ?? lead.instagram_username;
    if (!sitePhone && opts.useSocialFallback !== false && instagramHandle) {
      const social = await contactsFromInstagram(instagramHandle);
      if (social.phone) {
        updates.phone = social.phone;
        source = "instagram";
      }
      if (social.email && !updates.clinic_email && !lead.clinic_email) updates.clinic_email = social.email;
      if (social.followers != null && lead.instagram_followers == null) {
        updates.instagram_followers = social.followers;
      }
    }

    const gotPhone = Boolean(updates.phone);
    return {
      ...base,
      status: gotPhone || Object.keys(updates).length > 0 ? "enriched" : "nothing_found",
      updates,
      source,
      reason: gotPhone
        ? `Phone found on ${source === "instagram" ? "Instagram" : "the website"}`
        : Object.keys(updates).length > 0
          ? "No phone, but other contact details were found"
          : `Nothing found (tried ${found.pagesTried.length} page(s))`,
      verdict,
    };
  } catch (error) {
    console.error(`[findContacts] failed for lead ${lead.id}:`, error);
    return {
      ...base,
      status: "failed",
      updates: {},
      source: null,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Names that came from a ranked article rather than from a business. Only these
 * get replaced by the classifier's company name — a lead correctly named
 * "Flags PR" must never be renamed just because its homepage <title> differs.
 */
function looksLikeArticleTitle(name: string): boolean {
  return (
    /^\d+\s/.test(name) ||
    /\b(top|best|leading|list of)\b.*\b(agencies|agency|companies|firms|services|brands)\b/i.test(name) ||
    /-.*-/.test(name) || // slug-style names, e.g. "PR-Agencies-in-Delhi"
    name.length > 60
  );
}

/** Run `worker` over `items` with bounded parallelism. */
export async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}
