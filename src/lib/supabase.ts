import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Every server-side query leaves through one long-lived connection pool that
 * outlives the request which opened it. A scrape can leave that pool idle for
 * minutes; by the time the next page load reuses a socket, the other end may
 * have dropped it, and the query stalls with nothing to report.
 *
 * Undici lets a stalled request sit for its 300s default before giving up —
 * long past any serverless limit, so the page dies with a platform timeout
 * instead of a message. Bound it: a query that has not produced headers in ten
 * seconds is not going to be useful.
 *
 * Retrying is deliberately left to postgrest-js, which already re-issues failed
 * idempotent requests up to four times with backoff. A second retry layer here
 * would multiply against it — twelve attempts and a minutes-long wait before
 * the caller ever sees the error.
 */
const REQUEST_TIMEOUT_MS = 10_000;

async function boundedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new Error(`Supabase request timed out after ${REQUEST_TIMEOUT_MS}ms`)
      ),
    REQUEST_TIMEOUT_MS
  );

  // postgrest-js re-issues each attempt through a fresh call, so a caller
  // deadline that already expired has to be honoured up front — subscribing to
  // an -already- aborted signal never fires, and every retry would then run the
  // full timeout again, blowing straight past the deadline it was given.
  const callerSignal = init?.signal ?? null;
  if (callerSignal?.aborted) controller.abort(callerSignal.reason);
  const forwardAbort = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener("abort", forwardAbort, { once: true });

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", forwardAbort);
  }
}

// Client for browser-side usage
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side API routes (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: { fetch: boundedFetch },
});
