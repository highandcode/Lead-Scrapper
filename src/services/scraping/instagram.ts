import { runApifyActor, APIFY_ACTORS } from "@/lib/apify";
import { withRetry, guessInstagramUsername, extractInstagramUsername } from "@/lib/utils";
import type { InstagramAnalysis, InstagramPostAnalysis } from "@/types";

// ─── Apify response types ───────────────────────────────────────────────────

interface ApifyInstagramProfile {
  username?: string;
  biography?: string;
  followersCount?: number;
  followers_count?: number;
  followsCount?: number;
  follows_count?: number;
  postsCount?: number;
  posts_count?: number;
  mediaCount?: number;
  media_count?: number;
  isVerified?: boolean;
  is_verified?: boolean;
  isPrivate?: boolean;
  externalUrl?: string;
  external_url?: string;
  externalUrls?: Array<{ url?: string; title?: string }> | string[];
}

interface ApifyInstagramPost {
  caption?: string;
  likesCount?: number;
  likes_count?: number;
  commentsCount?: number;
  comments_count?: number;
  timestamp?: string;
  takenAt?: string;
  taken_at?: string;
}

// ─── Field resolvers ────────────────────────────────────────────────────────

function resolveFollowers(p: ApifyInstagramProfile): number {
  return p.followersCount ?? p.followers_count ?? 0;
}

function resolveFollowing(p: ApifyInstagramProfile): number {
  return p.followsCount ?? p.follows_count ?? 0;
}

function resolvePosts(p: ApifyInstagramProfile): number {
  return p.postsCount ?? p.posts_count ?? p.mediaCount ?? p.media_count ?? 0;
}

function resolveVerified(p: ApifyInstagramProfile): boolean {
  return p.isVerified ?? p.is_verified ?? false;
}

function resolveExternalUrl(p: ApifyInstagramProfile): string | null {
  if (p.externalUrl?.trim()) return p.externalUrl.trim();
  if (p.external_url?.trim()) return p.external_url.trim();
  if (Array.isArray(p.externalUrls) && p.externalUrls.length > 0) {
    const first = p.externalUrls[0];
    if (typeof first === "string") return first || null;
    if (typeof first === "object" && first.url) return first.url;
  }
  return null;
}

// ─── Email extraction from bio ───────────────────────────────────────────────

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

export function extractEmailFromBio(bio: string): string | null {
  if (!bio) return null;
  const match = bio.match(EMAIL_RE);
  return match ? match[0].toLowerCase() : null;
}

// ─── Booking link detection ─────────────────────────────────────────────────

const BOOKING_PATTERNS = [
  /calendly\.com/i,
  /booksy\.com/i,
  /practo\.com/i,
  /lybrate\.com/i,
  /zocdoc\.com/i,
  /typeform\.com/i,
  /jotform\.com/i,
  /appointment/i,
  /booking/i,
  /book-now/i,
  /bookanapp/i,
  /schedule/i,
  /consult/i,
];

export function detectBookingLink(url: string | null): boolean {
  if (!url) return false;
  return BOOKING_PATTERNS.some((p) => p.test(url));
}

// ─── Bio signal detection ────────────────────────────────────────────────────

function detectWhatsAppCTA(bio: string): boolean {
  if (!bio) return false;
  return [
    /whatsapp/i,
    /wa\.me/i,
    /\+91[\s\-.]?\d{10}/,
    /\b91[\s\-.]?\d{10}\b/,
    /\b[6-9]\d{9}\b/,
    /chat\s*with\s*us/i,
    /message\s*us\s*on\s*whatsapp/i,
    /dm\s*for\s*appointment/i,
    /contact\s*on\s*wa/i,
  ].some((p) => p.test(bio));
}

function estimateEngagement(followers: number): number {
  if (followers === 0) return 0;
  if (followers < 1_000) return 8;
  if (followers < 5_000) return 5;
  if (followers < 10_000) return 3.5;
  if (followers < 50_000) return 2.5;
  if (followers < 100_000) return 1.8;
  return 1.2;
}

// ─── Post content analysis ───────────────────────────────────────────────────

function analyzePostContent(posts: ApifyInstagramPost[]): InstagramPostAnalysis {
  if (posts.length === 0) {
    return {
      avgLikes: 0,
      avgComments: 0,
      realEngagementRate: 0,
      postTypes: {
        beforeAfter: false,
        testimonials: false,
        educational: false,
        promotional: false,
        whatsappInPosts: false,
      },
      postingFrequencyDays: null,
      lastPostDate: null,
      sampleCaptions: [],
    };
  }

  const captions = posts.map((p) => p.caption ?? "").filter(Boolean);
  const allText = captions.join(" ").toLowerCase();

  const totalLikes = posts.reduce((s, p) => s + (p.likesCount ?? p.likes_count ?? 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.commentsCount ?? p.comments_count ?? 0), 0);
  const avgLikes = Math.round(totalLikes / posts.length);
  const avgComments = Math.round(totalComments / posts.length);

  // Posting frequency from timestamps
  const timestamps = posts
    .map((p) => {
      const raw = p.timestamp ?? p.takenAt ?? p.taken_at;
      return raw ? new Date(raw).getTime() : null;
    })
    .filter((t): t is number => t !== null)
    .sort((a, b) => b - a);

  let postingFrequencyDays: number | null = null;
  let lastPostDate: string | null = null;

  if (timestamps.length >= 2) {
    const rangeMs = timestamps[0] - timestamps[timestamps.length - 1];
    postingFrequencyDays = Math.round(rangeMs / (1000 * 60 * 60 * 24) / (timestamps.length - 1));
  }
  if (timestamps.length > 0) {
    lastPostDate = new Date(timestamps[0]).toISOString().split("T")[0];
  }

  return {
    avgLikes,
    avgComments,
    realEngagementRate: 0, // filled after we know follower count
    postTypes: {
      beforeAfter: /before|after|transformation|result|baal|hair\s*loss\s*result/i.test(allText),
      testimonials: /review|patient|happy|satisfied|thank|testimonial|feedback|result/i.test(allText),
      educational: /tip|habit|why|how|learn|know|cause|facts|myths|aware/i.test(allText),
      promotional: /offer|discount|free|sale|deal|book\s*now|limited|special|flat\s*\d+%/i.test(allText),
      whatsappInPosts: /whatsapp|wa\.me|\+91\s*\d{10}/i.test(allText),
    },
    postingFrequencyDays,
    lastPostDate,
    sampleCaptions: captions.slice(0, 3).map((c) => c.slice(0, 120)),
  };
}

// ─── Scraping functions ──────────────────────────────────────────────────────

export async function scrapeInstagramProfile(
  username: string
): Promise<Partial<InstagramAnalysis> | null> {
  try {
    const profileUrl = `https://www.instagram.com/${username}/`;
    const results = await withRetry(() =>
      runApifyActor<ApifyInstagramProfile>({
        actorId: APIFY_ACTORS.INSTAGRAM_SCRAPER,
        input: {
          directUrls: [profileUrl],
          resultsType: "details",
          resultsLimit: 1,
          addParentData: false,
        },
        timeoutSecs: 90,
        memoryMbytes: 256,
      })
    );

    const profile = results[0];
    if (!profile?.username) return null;
    const followers = resolveFollowers(profile);
    const posts = resolvePosts(profile);

    const bio = profile.biography ?? "";
    const externalUrl = resolveExternalUrl(profile);
    const isVerified = resolveVerified(profile);

    return {
      username: profile.username,
      followers,
      posts,
      following: resolveFollowing(profile),
      bio,
      profileUrl: `https://www.instagram.com/${profile.username}/`,
      isVerified,
      externalUrl,
      hasBookingLink: detectBookingLink(externalUrl),
      hasWhatsAppCTA: detectWhatsAppCTA(bio),
      hasLinkInBio: externalUrl !== null,
      estimatedEngagementRate: estimateEngagement(followers),
      contentQuality: followers > 5000 ? "average" : "poor",
      postingFrequency: posts > 100 ? "frequent" : posts > 30 ? "regular" : posts > 5 ? "rare" : "inactive",
      postAnalysis: null,
      weaknesses: [],
      opportunities: [],
    };
  } catch {
    return null;
  }
}

export async function scrapeInstagramPosts(
  username: string,
  limit = 12
): Promise<InstagramPostAnalysis | null> {
  try {
    const posts = await withRetry(() =>
      runApifyActor<ApifyInstagramPost>({
        actorId: APIFY_ACTORS.INSTAGRAM_SCRAPER,
        input: {
          directUrls: [`https://www.instagram.com/${username}/`],
          resultsType: "posts",
          resultsLimit: limit,
          addParentData: false,
        },
        timeoutSecs: 120,
        memoryMbytes: 256,
      })
    );

    if (!posts.length) return null;
    return analyzePostContent(posts);
  } catch {
    return null;
  }
}

// ─── Discovery ───────────────────────────────────────────────────────────────

export async function discoverInstagram(
  clinicName: string,
  website?: string
): Promise<Partial<InstagramAnalysis> | null> {
  const candidates = guessInstagramUsername(clinicName, website);

  for (const username of candidates) {
    const result = await scrapeInstagramProfile(username);
    if (result) return result;
  }

  return null;
}

interface GoogleSearchResult {
  organicResults?: Array<{
    title?: string;
    url?: string;
    description?: string;
  }>;
}

export async function searchGoogleForInstagram(
  clinicName: string,
  city?: string | null
): Promise<string | null> {
  try {
    const query = city
      ? `${clinicName} ${city} instagram`
      : `${clinicName} instagram`;

    const pages = await runApifyActor<GoogleSearchResult>({
      actorId: APIFY_ACTORS.GOOGLE_SEARCH,
      input: {
        queries: query,
        resultsPerPage: 5,
        maxPagesPerQuery: 1,
        mobileResults: false,
      },
      timeoutSecs: 60,
      memoryMbytes: 256,
    });

    for (const page of pages) {
      for (const result of (page.organicResults ?? []).slice(0, 4)) {
        if (result.url) {
          const username = extractInstagramUsername(result.url);
          if (username) return username;
        }
        const text = `${result.title ?? ""} ${result.description ?? ""}`;
        const username = extractInstagramUsername(text);
        if (username) return username;
      }
    }
    return null;
  } catch {
    return null;
  }
}
