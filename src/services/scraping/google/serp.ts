import { launchBrowser, createContext } from "./browser";
import { cleanCategoryText, CATEGORY_RATING_PREFIX } from "@/services/scraping/dedupe";
import type { SerpLocalResult, SerpOrganicResult } from "./types";

/**
 * Google SERP scraping via a real browser.
 *
 * Google renders results client-side and blocks non-browser traffic, so this
 * drives headless Chromium rather than fetching HTML. Two consequences shape
 * everything below:
 *
 *  1. Google rate-limits by IP. Requests are paced globally, and a block is
 *     raised as a typed error so callers can fall back rather than reporting
 *     "no leads found" for what is actually a throttle.
 *  2. Datacenter IPs (Vercel, AWS) are blocked far more aggressively than
 *     residential ones. Expect this path to fail when deployed and the Bing
 *     engine to carry the load there.
 */

/** Raised when Google serves a CAPTCHA / consent wall instead of results. */
export class SerpBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SerpBlockedError";
  }
}

/**
 * Minimum gap between Google page loads, process-wide. Bursts are what trigger
 * the block, so this is deliberately slow — correctness over throughput.
 */
const MIN_REQUEST_GAP_MS = Number(process.env.GOOGLE_SERP_GAP_MS ?? 6000);
let lastRequestAt = 0;

async function pace(): Promise<void> {
  const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

/** Removes the automation tells Google fingerprints. */
const STEALTH = () => {
  Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  Object.defineProperty(navigator, "languages", { get: () => ["en-IN", "en"] });
  Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  (window as unknown as { chrome: unknown }).chrome = { runtime: {} };
};

interface SearchOptions {
  gl?: string;
  hl?: string;
  limit: number;
}

function buildUrl(query: string, opts: SearchOptions & { start?: number; local?: boolean }): string {
  const p = new URLSearchParams({
    q: query,
    hl: opts.hl ?? "en",
    gl: opts.gl ?? "in",
    pws: "0",
  });
  if (opts.start) p.set("start", String(opts.start));
  if (opts.local) p.set("tbm", "lcl");
  return `https://www.google.com/search?${p}`;
}

/**
 * Run both Google passes in one browser session.
 *
 * Launching Chromium costs ~1s, so organic and local share a context rather
 * than paying that twice.
 */
export async function searchGoogle(
  query: string,
  opts: SearchOptions
): Promise<{ organic: SerpOrganicResult[]; local: SerpLocalResult[] }> {
  const browser = await launchBrowser();

  try {
    const context = await createContext(browser);
    await context.addInitScript(STEALTH);
    const page = await context.newPage();

    const isBlocked = () =>
      page.evaluate(() =>
        /unusual traffic|not a robot|detected unusual/i.test(document.body?.innerText ?? "")
      );

    // ── Organic results ────────────────────────────────────────────────
    const organic: SerpOrganicResult[] = [];
    const seenDomains = new Set<string>();

    for (let start = 0; start < 60 && organic.length < opts.limit; start += 10) {
      await pace();
      await page.goto(buildUrl(query, { ...opts, start }), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForTimeout(1500);

      if (await isBlocked()) {
        throw new SerpBlockedError(
          "Google is rate-limiting this IP. Wait a few minutes, or let the Bing engine handle it."
        );
      }

      const page_results = await page.evaluate(() => {
        const out: { title: string; url: string }[] = [];
        document.querySelectorAll("a h3").forEach((h3) => {
          const a = h3.closest("a") as HTMLAnchorElement | null;
          if (a?.href) out.push({ title: (h3 as HTMLElement).innerText.trim(), url: a.href });
        });
        return out;
      });

      if (page_results.length === 0) break;

      for (const r of page_results) {
        let domain: string;
        try {
          domain = new URL(r.url).hostname.replace(/^www\./, "");
        } catch {
          continue;
        }
        if (!domain || seenDomains.has(domain)) continue;
        seenDomains.add(domain);
        organic.push({ ...r, domain, snippet: "", rank: organic.length + 1 });
        if (organic.length >= opts.limit) break;
      }
    }

    // ── Local pack (Google Business Profiles) ──────────────────────────
    const local: SerpLocalResult[] = [];
    const seenNames = new Set<string>();

    for (let start = 0; start < 40 && local.length < opts.limit; start += 20) {
      await pace();
      await page.goto(buildUrl(query, { ...opts, start, local: true }), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForTimeout(1500);

      if (await isBlocked()) break; // organic already succeeded — keep what we have

      const page_results = await page.evaluate(() => {
        // Class names rotate; try the known containers in order of longevity.
        const selectors = [".rllt__details", '[role="article"]', ".VkpGBb", ".uMdZh"];
        const nodes = selectors
          .map((s) => Array.from(document.querySelectorAll(s)))
          .find((list) => list.length > 0) ?? [];

        return nodes.map((n) => {
          const text = (n as HTMLElement).innerText ?? "";
          const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
          const link = n.querySelector("a[href^='http']") as HTMLAnchorElement | null;
          return { text, lines, website: link?.href ?? null };
        });
      });

      if (page_results.length === 0) break;

      for (const r of page_results) {
        const name = r.lines[0];
        if (!name) continue;
        const key = name.toLowerCase();
        if (seenNames.has(key)) continue;
        seenNames.add(key);

        const rating = r.text.match(/(\d\.\d)\s*\(([\d,]+)\)/);
        const phone = r.text.match(/(?:\+91[\s-]?)?(?:0?\d{5}[\s-]?\d{5}|\d{3,5}[\s-]\d{6,8})/);

        local.push({
          name,
          rating: rating ? Number(rating[1]) : null,
          reviewCount: rating ? Number(rating[2].replace(/,/g, "")) : null,
          // Exclude the rating+category line ("4.6(75) · Marketing agency") —
          // it has a digit and is long enough to otherwise look like an address.
          address: r.lines.find((l) => /\d/.test(l) && l.length > 12 && !CATEGORY_RATING_PREFIX.test(l)) ?? null,
          phone: phone?.[0] ?? null,
          website: r.website,
          category: cleanCategoryText(r.lines[1]),
          rank: local.length + 1,
        });
        if (local.length >= opts.limit) break;
      }
    }

    return { organic, local };
  } finally {
    await browser.close();
  }
}
