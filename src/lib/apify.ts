import axios from "axios";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const APIFY_BASE = "https://api.apify.com/v2";

interface ApifyRunOptions {
  actorId: string;
  input: Record<string, unknown>;
  timeoutSecs?: number;
  memoryMbytes?: number;
}

// Run an Apify actor synchronously and return dataset items
export async function runApifyActor<T>(
  options: ApifyRunOptions
): Promise<T[]> {
  if (!APIFY_TOKEN) {
    throw new Error("APIFY_API_TOKEN is not configured");
  }

  const { actorId, input, timeoutSecs = 120, memoryMbytes = 256 } = options;

  // Apify actor IDs use "/" in display form but "~" in URL paths
  const actorPath = actorId.replace(/\//g, "~");
  const runUrl = `${APIFY_BASE}/acts/${actorPath}/run-sync-get-dataset-items`;

  try {
    const response = await axios.post<T[]>(
      runUrl,
      input,
      {
        params: {
          token: APIFY_TOKEN,
          timeout: timeoutSecs,
          memory: memoryMbytes,
          format: "json",
        },
        headers: { "Content-Type": "application/json" },
        timeout: (timeoutSecs + 30) * 1000,
      }
    );
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error("Apify API error", {
        status: err.response?.status,
        body: JSON.stringify(err.response?.data),
        input: JSON.stringify(input),
      });
      throw new Error(`Apify ${err.response?.status}: ${JSON.stringify(err.response?.data)}`);
    }
    throw err;
  }
}

// Get items from an existing dataset
export async function getDatasetItems<T>(datasetId: string): Promise<T[]> {
  if (!APIFY_TOKEN) throw new Error("APIFY_API_TOKEN is not configured");

  // Apify returns a plain JSON array for /items?format=json
  const response = await axios.get<T[]>(
    `${APIFY_BASE}/datasets/${datasetId}/items`,
    {
      params: { token: APIFY_TOKEN, format: "json" },
    }
  );

  return response.data;
}

// Start an actor run asynchronously — returns immediately with a runId
export async function startApifyActorRun(options: ApifyRunOptions): Promise<string> {
  if (!APIFY_TOKEN) throw new Error("APIFY_API_TOKEN is not configured");

  const { actorId, input, timeoutSecs = 120, memoryMbytes = 256 } = options;
  const actorPath = actorId.replace(/\//g, "~");

  const response = await axios.post<{ data: { id: string } }>(
    `${APIFY_BASE}/acts/${actorPath}/runs`,
    input,
    {
      params: { token: APIFY_TOKEN, timeout: timeoutSecs, memory: memoryMbytes },
      headers: { "Content-Type": "application/json" },
      timeout: 15_000,
    }
  );
  return response.data.data.id;
}

export type ApifyRunStatus = "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "TIMED-OUT" | "ABORTED";

// Check the status of an async Apify run
export async function getApifyRunStatus(
  runId: string
): Promise<{ status: ApifyRunStatus; defaultDatasetId: string }> {
  if (!APIFY_TOKEN) throw new Error("APIFY_API_TOKEN is not configured");

  const response = await axios.get<{ data: { status: ApifyRunStatus; defaultDatasetId: string } }>(
    `${APIFY_BASE}/actor-runs/${runId}`,
    { params: { token: APIFY_TOKEN }, timeout: 10_000 }
  );
  return response.data.data;
}

// Apify Actor IDs (well-known public actors)
export const APIFY_ACTORS = {
  GOOGLE_MAPS: "compass/crawler-google-places",
  JUSTDIAL: "iskander/just-dial-extractor-scraper",
  INSTAGRAM_SCRAPER: "apify/instagram-scraper",
  WEBSITE_CHECKER: "apify/website-content-crawler",
  GOOGLE_SEARCH: "apify/google-search-scraper",
} as const;
