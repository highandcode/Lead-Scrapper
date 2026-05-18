// JustDial blocks all server-side HTTP requests (returns empty HTML).
// We must use Apify Playwright to render the page and extract the WhatsApp link.
// To avoid blocking the UI, we split this into two steps:
//   1. startWhatsAppFetch()  → starts the Apify run, returns a runId immediately
//   2. extractWhatsAppFromRun() → called when the run is SUCCEEDED, returns the number

import { startApifyActorRun, getApifyRunStatus, getDatasetItems, APIFY_ACTORS } from "@/lib/apify";

const WA_PATTERNS = [
  /wa\.me\/(\d{10,13})/i,
  /whatsapp\.com\/send[?&]phone=(\d{10,13})/i,
  /api\.whatsapp\.com\/send[?&]phone=(\d{10,13})/i,
  /"whatsapp"\s*:\s*"(9[1]?[6-9]\d{9}|\d{10})"/i,
];

function normalise(digits: string): string | null {
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("091")) return `91${digits.slice(1)}`;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  return null;
}

function extractFromHtml(html: string): string | null {
  for (const pattern of WA_PATTERNS) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const result = normalise(match[1]);
      if (result) return result;
    }
  }
  return null;
}

/** Step 1: kick off the Apify Playwright run, return runId immediately. */
export async function startWhatsAppFetch(listingUrl: string): Promise<string> {
  return startApifyActorRun({
    actorId: APIFY_ACTORS.WEBSITE_CHECKER,
    input: {
      startUrls: [{ url: listingUrl }],
      maxCrawlPages: 1,
      crawlerType: "playwright:chrome",
    },
    timeoutSecs: 90,
    memoryMbytes: 1024,
  });
}

/** Step 2: poll run status; when SUCCEEDED, extract the number from rendered HTML. */
export async function pollWhatsAppRun(
  runId: string
): Promise<{ status: "pending" | "done" | "failed"; number?: string }> {
  const run = await getApifyRunStatus(runId);

  if (run.status === "RUNNING" || run.status === "READY") {
    return { status: "pending" };
  }

  if (run.status !== "SUCCEEDED") {
    return { status: "failed" };
  }

  interface CrawlerResult { html?: string; text?: string; markdown?: string }
  const items = await getDatasetItems<CrawlerResult>(run.defaultDatasetId);
  const page = items[0];
  const html = page?.html ?? page?.text ?? page?.markdown ?? "";
  const number = extractFromHtml(html);

  return { status: "done", number: number ?? undefined };
}
