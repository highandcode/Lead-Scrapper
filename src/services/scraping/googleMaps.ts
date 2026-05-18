import { runApifyActor, APIFY_ACTORS } from "@/lib/apify";
import { withRetry, buildSearchQuery } from "@/lib/utils";
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
        maxReviews: 0,
        exportPlaceUrls: false,
        additionalInfo: false,
        scrapeDirectories: false,
      },
      timeoutSecs: 180,
      memoryMbytes: 512,
    })
  );

  return rawResults
    .filter((r) => r.title && r.placeId)
    .filter((r) => {
      if (params.minRating && (r.totalScore ?? 0) < params.minRating) return false;
      if (params.maxRating && (r.totalScore ?? 5) > params.maxRating) return false;
      return true;
    })
    .map((r): GoogleMapsPlace => ({
      place_id: r.placeId ?? "",
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
