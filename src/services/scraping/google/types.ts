/** Shared result shapes across every SERP engine. */

export interface SerpOrganicResult {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  rank: number;
}

export interface SerpLocalResult {
  name: string;
  rating: number | null;
  reviewCount: number | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  rank: number;
}

/** Which engine actually served a result set. Surfaced to the UI. */
export type SerpEngineName = "google";

export interface SerpResults {
  organic: SerpOrganicResult[];
  local: SerpLocalResult[];
  engine: SerpEngineName;
}
