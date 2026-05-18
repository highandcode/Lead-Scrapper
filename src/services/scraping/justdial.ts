import { runApifyActor, APIFY_ACTORS } from "@/lib/apify";
import { withRetry } from "@/lib/utils";
import type { JustDialPlace, SearchParams } from "@/types";

interface ApifyJustDialResult {
  name?: string;
  url?: string;
  phone?: string;
  rating?: string;
  rating_count?: string;
  address?: string;
  website?: string;
  amenities?: unknown;
}

function parseRatingCount(s?: string): number {
  if (!s) return 0;
  const match = s.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function buildJustDialUrl(city: string, niche: string): string {
  const toSlug = (s: string) =>
    s.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
  return `https://www.justdial.com/${toSlug(city)}/${toSlug(niche)}/`;
}

export async function scrapeJustDial(
  params: SearchParams
): Promise<JustDialPlace[]> {
  const limit = params.limit ?? 20;
  const maxPages = Math.ceil(limit / 10);

  const rawResults = await withRetry(() =>
    runApifyActor<ApifyJustDialResult>({
      actorId: APIFY_ACTORS.JUSTDIAL,
      input: {
        start_urls: [{ url: buildJustDialUrl(params.city, params.niche) }],
        maxPages,
      },
      timeoutSecs: 180,
      memoryMbytes: 512,
    })
  );

  return rawResults
    .filter((r) => r.name && r.url)
    .filter((r) => {
      const score = parseFloat(r.rating ?? "0");
      if (params.minRating && score < params.minRating) return false;
      if (params.maxRating && score > params.maxRating) return false;
      return true;
    })
    .slice(0, limit)
    .map((r): JustDialPlace => ({
      place_id: `jd_${r.url}`,
      clinic_name: r.name ?? "Unknown",
      category: params.niche,
      address: r.address ?? "",
      phone: r.phone ?? "",
      website: r.website ?? "",
      rating: parseFloat(r.rating ?? "0"),
      review_count: parseRatingCount(r.rating_count),
      justdial_url: r.url ?? "",
      city: params.city,
    }));
}
