import { supabaseAdmin } from "@/lib/supabase";
import type { PaginatedLeads } from "@/types";

const PAGE_SIZE = 20;

/**
 * How long the page render will wait for the seed rows. Kept short on purpose:
 * `LeadsTable` re-fetches on mount regardless, so a slow database costs an
 * empty first paint rather than a page that hangs until the platform kills it.
 */
const SEED_TIMEOUT_MS = 6_000;

const EMPTY: PaginatedLeads = {
  leads: [],
  total: 0,
  page: 1,
  pageSize: PAGE_SIZE,
  totalPages: 0,
};

/**
 * First page of leads for a server-rendered table, queried directly rather than
 * through an HTTP self-fetch.
 *
 * A failure here degrades to an empty table instead of a 500 — the client-side
 * table re-fetches on mount and can report the problem properly. But it is
 * logged rather than swallowed: an empty table and a broken connection look
 * identical on screen, and only one of them is worth investigating.
 */
export async function loadInitialLeads(dataSource?: string): Promise<PaginatedLeads> {
  try {
    let query = supabaseAdmin.from("leads").select("*", { count: "exact" });
    if (dataSource) query = query.eq("data_source", dataSource);

    const { data: leads, count, error } = await query
      .order("lead_score", { ascending: false, nullsFirst: false })
      .range(0, PAGE_SIZE - 1)
      .abortSignal(AbortSignal.timeout(SEED_TIMEOUT_MS));

    if (error) throw error;

    return {
      leads: leads ?? [],
      total: count ?? 0,
      page: 1,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
    };
  } catch (error) {
    console.error(
      `[leads] initial load failed${dataSource ? ` for ${dataSource}` : ""}:`,
      error
    );
    return EMPTY;
  }
}
