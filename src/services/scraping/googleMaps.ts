import { runApifyActor, APIFY_ACTORS } from "@/lib/apify";
import { withRetry, buildSearchQuery } from "@/lib/utils";
import { filterByRegion } from "@/services/scraping/geo";
import type { GoogleMapsPlace, SearchParams } from "@/types";

interface ApifyGoogleMapsResult {
  placeId?: string;
  title?: string;
  categoryName?: string;
  address?: string;
  phone?: string;
  website?: string;
  totalScore?: number;
  reviewsCount?: number;
  url?: string;
  city?: string;
  location?: { lat: number; lng: number };
}

export async function scrapeGoogleMaps(
  params: SearchParams
): Promise<GoogleMapsPlace[]> {
  const query = buildSearchQuery(params.city, params.niche);
  const limit = params.limit ?? 20;

  const rawResults = await withRetry(() =>
    runApifyActor<ApifyGoogleMapsResult>({
      actorId: APIFY_ACTORS.GOOGLE_MAPS,
      input: {
        searchStringsArray: [query],
        maxCrawledPlacesPerSearch: limit,
        language: "en",
        // Without a country constraint the actor returns worldwide matches —
        // "PR Agencies Delhi" was pulling in Delhi, New York businesses.
        countryCode: params.countryCode ?? "in",
        maxReviews: 0,
        exportPlaceUrls: false,
        additionalInfo: false,
        scrapeDirectories: false,
      },
      timeoutSecs: 180,
      memoryMbytes: 512,
    })
  );

  const inRegion = filterByRegion(
    rawResults.filter((r) => r.title && r.placeId),
    params.countryCode ?? "in"
  );

  if (inRegion.rejected.length > 0) {
    console.info(
      `[googleMaps] dropped ${inRegion.rejected.length} out-of-region result(s) for "${query}":`,
      inRegion.rejected.map((r) => `${r.title} — ${r.address}`).slice(0, 5)
    );
  }

  return inRegion.kept
    .filter((r) => {
      if (params.minRating && (r.totalScore ?? 0) < params.minRating) return false;
      if (params.maxRating && (r.totalScore ?? 5) > params.maxRating) return false;
      return true;
    })
    .map((r): GoogleMapsPlace => ({
      // null, not "" — place_id is UNIQUE, and Postgres allows repeated NULLs
      // but only one "". An empty fallback silently discards every later lead
      // that is missing a placeId.
      place_id: r.placeId || null,
      clinic_name: r.title ?? "Unknown",
      category: r.categoryName ?? params.niche,
      address: r.address ?? "",
      phone: r.phone ?? "",
      website: r.website ?? "",
      rating: r.totalScore ?? 0,
      review_count: r.reviewsCount ?? 0,
      google_maps_url: r.url ?? "",
      city: params.city,
    }));
}
