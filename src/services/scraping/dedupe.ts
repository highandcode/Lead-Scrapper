import { supabaseAdmin } from "@/lib/supabase";

/**
 * Lead de-duplication.
 *
 * `leads.place_id` is UNIQUE, but that alone is not enough:
 *
 *  1. JustDial listing URLs carry the originating search in their query string,
 *     so the *same* listing yields a different id per niche searched. Strip the
 *     query before using a URL as an identifier.
 *  2. The same clinic found via Google Maps and via JustDial has structurally
 *     different ids (`ChIJ…` vs `jd_…`) and can never collide, so we also match
 *     on normalised phone and on name+city.
 */

/** Placeholder values scrapers emit in place of a real phone number. */
const PHONE_PLACEHOLDERS = new Set(["show number", "n/a", "na", "-", ""]);

/**
 * Strip the query string and fragment from a listing URL so the same listing
 * produces one stable id regardless of which search surfaced it.
 */
export function stableListingUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.replace(/\/+$/, "");
  } catch {
    // Not a parseable URL — fall back to cutting at the first `?` or `#`.
    return url.split(/[?#]/)[0].replace(/\/+$/, "");
  }
}

/**
 * Reduce a scraped phone to a comparable form: digits only, last 10.
 * Returns null when the value is a placeholder or too short to identify anyone.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (PHONE_PLACEHOLDERS.has(phone.trim().toLowerCase())) return null;

  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/** Reduce a clinic name to a comparable form. */
export function normalizeName(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Identity key for the same business in the same city. */
export function nameCityKey(
  name: string | null | undefined,
  city: string | null | undefined
): string {
  return `${normalizeName(name)}|${normalizeName(city)}`;
}

/** The shape `filterNewLeads` needs off a candidate row. */
export interface DedupeCandidate {
  place_id?: string | null;
  clinic_name?: string | null;
  city?: string | null;
  phone?: string | null;
}

interface ExistingRow {
  place_id: string | null;
  clinic_name: string | null;
  city: string | null;
  phone: string | null;
}

/**
 * PostgREST passes `in.(…)` filters in the query string, and JustDial place_ids
 * are full listing URLs (~200 chars). Sending a whole batch at once overflows
 * the request line and comes back as a bare 400, so chunk by character budget.
 */
const PLACE_ID_QUERY_BUDGET = 2000;

async function selectByPlaceIds(placeIds: string[]): Promise<ExistingRow[]> {
  if (placeIds.length === 0) return [];

  const chunks: string[][] = [];
  let current: string[] = [];
  let size = 0;

  for (const id of placeIds) {
    // +3 for the encoded quoting/comma PostgREST adds per element.
    if (current.length > 0 && size + id.length + 3 > PLACE_ID_QUERY_BUDGET) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(id);
    size += id.length + 3;
  }
  if (current.length > 0) chunks.push(current);

  const results = await Promise.all(
    chunks.map((chunk) =>
      supabaseAdmin
        .from("leads")
        .select("place_id, clinic_name, city, phone")
        .in("place_id", chunk)
    )
  );

  const rows: ExistingRow[] = [];
  for (const { data, error } of results) {
    if (error) throw error;
    rows.push(...((data ?? []) as ExistingRow[]));
  }
  return rows;
}

export interface DedupeReport<T> {
  /** Candidates not already present, and unique within the batch. */
  fresh: T[];
  /** Dropped because an equivalent lead already exists in the database. */
  existingCount: number;
  /** Dropped because the same lead appeared twice in this batch. */
  inBatchCount: number;
}

/**
 * Drop candidates that already exist in `leads`, and collapse repeats within
 * the batch itself. Matches on place_id, then normalised phone, then name+city.
 */
export async function filterNewLeads<T extends DedupeCandidate>(
  candidates: T[],
  city: string
): Promise<DedupeReport<T>> {
  if (candidates.length === 0) {
    return { fresh: [], existingCount: 0, inBatchCount: 0 };
  }

  const placeIds = candidates
    .map((c) => c.place_id)
    .filter((id): id is string => Boolean(id));

  // Two scoped lookups rather than one table scan: anything sharing a place_id,
  // plus everything already known in the city being searched.
  const [existingByPlaceId, byCity] = await Promise.all([
    selectByPlaceIds(placeIds),
    supabaseAdmin
      .from("leads")
      .select("place_id, clinic_name, city, phone")
      .ilike("city", `${city}%`),
  ]);

  if (byCity.error) throw byCity.error;

  const seenPlaceIds = new Set<string>();
  const seenPhones = new Set<string>();
  const seenNameCity = new Set<string>();

  for (const row of [...existingByPlaceId, ...(byCity.data ?? [])]) {
    if (row.place_id) seenPlaceIds.add(row.place_id);
    const phone = normalizePhone(row.phone);
    if (phone) seenPhones.add(phone);
    seenNameCity.add(nameCityKey(row.clinic_name, row.city));
  }

  const fresh: T[] = [];
  let existingCount = 0;
  let inBatchCount = 0;

  for (const candidate of candidates) {
    const phone = normalizePhone(candidate.phone);
    const nameCity = nameCityKey(candidate.clinic_name, candidate.city);
    const placeId = candidate.place_id || null;

    const alreadyInDb =
      (placeId != null && seenPlaceIds.has(placeId)) ||
      (phone != null && seenPhones.has(phone)) ||
      seenNameCity.has(nameCity);

    if (alreadyInDb) {
      // Distinguish "was already stored" from "repeated inside this batch" so
      // the caller can report both honestly.
      const fromThisBatch = fresh.some(
        (f) =>
          (placeId != null && f.place_id === placeId) ||
          (phone != null && normalizePhone(f.phone) === phone) ||
          nameCityKey(f.clinic_name, f.city) === nameCity
      );
      if (fromThisBatch) inBatchCount++;
      else existingCount++;
      continue;
    }

    fresh.push(candidate);
    if (placeId) seenPlaceIds.add(placeId);
    if (phone) seenPhones.add(phone);
    seenNameCity.add(nameCity);
  }

  return { fresh, existingCount, inBatchCount };
}
