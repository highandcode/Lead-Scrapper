import type { LeadFilters, OutreachStatus } from "@/types";

/**
 * Shared filter handling for the leads list and the CSV export.
 *
 * Both endpoints must interpret the same query params identically — otherwise
 * an export silently returns a different set than the table it was triggered
 * from. Parse and apply filters through here rather than re-implementing them.
 */

/** Read the shared lead filter params off a request's query string. */
export function parseLeadFilters(searchParams: URLSearchParams): LeadFilters {
  const num = (key: string) => {
    const raw = searchParams.get(key);
    if (raw == null || raw === "") return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const phone = searchParams.get("phone");

  return {
    search: searchParams.get("search") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    outreach_status:
      (searchParams.get("outreach_status") as OutreachStatus) ?? undefined,
    minScore: num("minScore"),
    maxScore: num("maxScore"),
    hasWebsite: searchParams.get("hasWebsite") === "true" ? true : undefined,
    hasInstagram: searchParams.get("hasInstagram") === "true" ? true : undefined,
    phone: phone === "has" || phone === "missing" ? phone : undefined,
    data_source: searchParams.get("data_source") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    sortBy: (searchParams.get("sortBy") as LeadFilters["sortBy"]) ?? "created_at",
    sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") ?? "desc",
  };
}

/**
 * Structural shape of the Supabase query builder methods used below — keeps
 * this module free of Postgrest generics while still being type-checked.
 */
interface FilterableQuery<Q> {
  ilike(column: string, pattern: string): Q;
  eq(column: string, value: unknown): Q;
  gte(column: string, value: unknown): Q;
  lte(column: string, value: unknown): Q;
  not(column: string, operator: string, value: unknown): Q;
  is(column: string, value: unknown): Q;
  or(filters: string): Q;
}

interface SortableQuery<Q> {
  order(column: string, options: { ascending: boolean; nullsFirst: boolean }): Q;
}

/** Apply every WHERE clause implied by `filters`. */
export function applyLeadFilters<Q extends FilterableQuery<Q>>(
  query: Q,
  filters: LeadFilters
): Q {
  let q = query;

  if (filters.search) q = q.ilike("clinic_name", `%${filters.search}%`);
  if (filters.city) q = q.ilike("city", `${filters.city}%`);
  if (filters.category) q = q.ilike("category", `%${filters.category}%`);
  if (filters.outreach_status) q = q.eq("outreach_status", filters.outreach_status);
  if (filters.minScore != null) q = q.gte("lead_score", filters.minScore);
  if (filters.maxScore != null) q = q.lte("lead_score", filters.maxScore);
  if (filters.hasWebsite) q = q.not("website", "is", null);
  if (filters.hasInstagram) q = q.not("instagram_username", "is", null);

  // Both number columns count. A JustDial lead often has only whatsapp_phone,
  // so testing `phone` alone would put reachable leads in the "no phone" pile
  // and send Find Contacts off hunting for a number already on the record.
  if (filters.phone === "missing") q = q.is("phone", null).is("whatsapp_phone", null);
  if (filters.phone === "has") q = q.or("phone.not.is.null,whatsapp_phone.not.is.null");
  if (filters.data_source) q = q.eq("data_source", filters.data_source);
  if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
  if (filters.dateTo) q = q.lte("created_at", `${filters.dateTo}T23:59:59.999`);

  return q;
}

/** Apply the ORDER BY implied by `filters`. */
export function applyLeadSort<Q extends SortableQuery<Q>>(
  query: Q,
  filters: LeadFilters
): Q {
  return query.order(filters.sortBy ?? "created_at", {
    ascending: filters.sortOrder === "asc",
    nullsFirst: false,
  });
}

/**
 * Serialise filters back into query params — used by the client so the export
 * link carries exactly the filters the table is currently showing.
 */
export function leadFiltersToParams(filters: LeadFilters): URLSearchParams {
  const p = new URLSearchParams();

  if (filters.search) p.set("search", filters.search);
  if (filters.city) p.set("city", filters.city);
  if (filters.category) p.set("category", filters.category);
  if (filters.outreach_status) p.set("outreach_status", filters.outreach_status);
  if (filters.minScore != null) p.set("minScore", String(filters.minScore));
  if (filters.maxScore != null) p.set("maxScore", String(filters.maxScore));
  if (filters.hasWebsite) p.set("hasWebsite", "true");
  if (filters.hasInstagram) p.set("hasInstagram", "true");
  if (filters.phone) p.set("phone", filters.phone);
  if (filters.data_source) p.set("data_source", filters.data_source);
  if (filters.dateFrom) p.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) p.set("dateTo", filters.dateTo);
  if (filters.sortBy) p.set("sortBy", filters.sortBy);
  if (filters.sortOrder) p.set("sortOrder", filters.sortOrder);

  return p;
}
