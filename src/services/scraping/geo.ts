/**
 * Region sanity checks for scraped results.
 *
 * Search engines happily return a business in Delhi, New York for the query
 * "PR Agencies Delhi". Since every lead is stamped with the *searched* city,
 * those strays end up mislabelled and pollute outreach lists. These checks
 * drop results that clearly sit outside the region being searched.
 */

/** "…, NY 10003" / "…, CA 90045-1234" — a US state code followed by a ZIP. */
const US_STATE_ZIP = /,\s*(A[KLRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|P[AR]|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY])\s+\d{5}(-\d{4})?\b/i;

/** "(845) 744-2113" and "845-744-2113" style — North American formatting. */
const US_PHONE = /^\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}$/;

/** Indian postal codes are six digits, usually trailing the address. */
const INDIA_PIN = /\b\d{6}\b/;

const COUNTRY_HINTS: Record<string, RegExp> = {
  in: /\b(india|bharat)\b/i,
};

export interface RegionCheckInput {
  address?: string | null;
  phone?: string | null;
}

/**
 * Returns false when a result is demonstrably outside `countryCode`.
 *
 * Deliberately conservative: it only rejects on positive evidence of another
 * country, never on the mere absence of local markers. A sparse address is
 * kept, because Google frequently returns no address at all for valid results.
 */
export function isPlausiblyInCountry(
  result: RegionCheckInput,
  countryCode = "in"
): boolean {
  const address = (result.address ?? "").trim();
  const phone = (result.phone ?? "").trim();
  const cc = countryCode.toLowerCase();

  if (cc === "in") {
    // Positive evidence of India wins outright.
    if (INDIA_PIN.test(address) || COUNTRY_HINTS.in.test(address)) return true;
    if (/^\+?91[\s-]?\d/.test(phone)) return true;

    // Positive evidence of the US rejects.
    if (US_STATE_ZIP.test(address)) return false;
    if (US_PHONE.test(phone)) return false;
  }

  return true;
}

/** Partition results into kept / rejected, for honest reporting to the caller. */
export function filterByRegion<T extends RegionCheckInput>(
  results: T[],
  countryCode = "in"
): { kept: T[]; rejected: T[] } {
  const kept: T[] = [];
  const rejected: T[] = [];

  for (const r of results) {
    (isPlausiblyInCountry(r, countryCode) ? kept : rejected).push(r);
  }

  return { kept, rejected };
}
