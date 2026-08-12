// ============================================================
// Auth & User Types
// ============================================================

export type UserRole = "admin" | "user";

export interface UserPermissions {
  pages: {
    dashboard: boolean;
    leads: boolean;
    search: boolean;
    justdial: boolean;
    jdLeads: boolean;
    googleSearch: boolean;
    googleLeads: boolean;
    export: boolean;
  };
  actions: {
    leadsWrite: boolean;   // can import / add leads
    leadsDelete: boolean;  // can delete leads
    analyze: boolean;      // can run AI analysis
    viewScore: boolean;    // can see the AI lead score (table column + detail page)
  };
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  pages: {
    dashboard: true,
    leads: true,
    search: true,
    justdial: true,
    jdLeads: true,
    googleSearch: true,
    googleLeads: true,
    export: true,
  },
  actions: {
    leadsWrite: true,
    leadsDelete: false,
    analyze: true,
    viewScore: true,
  },
};

/** Admin-managed WhatsApp message template — placeholders are resolved
 * against a Lead's fields before opening WhatsApp (see resolveTemplate). */
export interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  permissions: UserPermissions | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Core Domain Types
// ============================================================

export type OutreachStatus =
  | "new"
  | "researched"
  | "contacted"
  | "replied"
  | "meeting_set"
  | "closed"
  | "not_interested"
  | "not_on_wa_or_gmail";

export interface WebsiteAnalysis {
  domainParked?: boolean;
  fetchFailed?: boolean;
  noWebsite?: boolean;
  directoryListing?: boolean;
  hasLandingPage: boolean;
  hasLeadForm: boolean;
  hasWhatsAppButton: boolean;
  hasBookingSystem: boolean;
  hasChatbot: boolean;
  hasMetaPixel: boolean;
  hasMobileOptimization: boolean;
  hasSSL: boolean;
  designQuality: "poor" | "average" | "good" | "excellent";
  loadingSpeed: "slow" | "average" | "fast";
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  pitchableServices: string[];
}

export interface InstagramPostAnalysis {
  avgLikes: number;
  avgComments: number;
  realEngagementRate: number;
  postTypes: {
    beforeAfter: boolean;
    testimonials: boolean;
    educational: boolean;
    promotional: boolean;
    whatsappInPosts: boolean;
  };
  postingFrequencyDays: number | null;
  lastPostDate: string | null;
  sampleCaptions: string[];
}

export interface InstagramAnalysis {
  username: string;
  followers: number;
  posts: number;
  following: number;
  bio: string;
  profileUrl: string;
  isVerified: boolean;
  externalUrl: string | null;
  hasBookingLink: boolean;
  hasWhatsAppCTA: boolean;
  hasLinkInBio: boolean;
  estimatedEngagementRate: number;
  contentQuality: "poor" | "average" | "good" | "excellent";
  postingFrequency: "inactive" | "rare" | "regular" | "frequent";
  postAnalysis: InstagramPostAnalysis | null;
  weaknesses: string[];
  opportunities: string[];
}

export interface ScoreBreakdown {
  websiteScore: number;
  instagramScore: number;
  conversionScore: number;
  automationScore: number;
  overallPotential: number;
  reasoning: string;
}

export interface Lead {
  id: string;
  clinic_name: string;
  category: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;          // JustDial call-tracking number (may be redirect)
  whatsapp_phone: string | null; // Clinic's actual WhatsApp number (extracted from listing page)
  website: string | null;
  google_maps_url: string | null;
  rating: number | null;
  review_count: number | null;
  place_id: string | null;

  // Instagram
  instagram_username: string | null;
  instagram_bio: string | null;
  instagram_followers: number | null;
  instagram_url: string | null;
  instagram_posts: number | null;
  instagram_following: number | null;
  instagram_is_verified: boolean;
  instagram_external_url: string | null;
  instagram_has_booking_link: boolean;
  instagram_enrichment: InstagramPostAnalysis | null;
  has_whatsapp_cta: boolean;
  has_link_in_bio: boolean;
  estimated_engagement_rate: number | null;

  // Website
  website_title: string | null;
  website_description: string | null;
  website_analysis: WebsiteAnalysis | null;
  clinic_email: string | null;

  // AI
  lead_score: number | null;
  score_breakdown: ScoreBreakdown | null;
  score_reasoning: string | null;

  // Outreach
  outreach_instagram_dm: string | null;
  outreach_whatsapp: string | null;
  outreach_email: string | null;
  outreach_followup: string | null;

  // Pipeline
  outreach_status: OutreachStatus;
  notes: string | null;
  last_contacted_at: string | null;
  search_query: string | null;
  data_source: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// API Request/Response Types
// ============================================================

export interface SearchParams {
  city: string;
  niche: string;
  minRating?: number;
  maxRating?: number;
  minFollowers?: number;
  maxFollowers?: number;
  limit?: number;
  /** ISO 3166-1 alpha-2, defaults to "in". Constrains results to one country. */
  countryCode?: string;
}

export interface ScrapeResult {
  success: boolean;
  data?: Partial<Lead>;
  error?: string;
}

export interface GoogleMapsPlace {
  /** null when the source omitted an id — see place_id handling in dedupe.ts */
  place_id: string | null;
  clinic_name: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  review_count: number;
  google_maps_url: string;
  city: string;
}

export interface JustDialPlace {
  place_id: string;
  clinic_name: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  review_count: number;
  justdial_url: string;
  city: string;
}

export interface LeadFilters {
  search?: string;
  city?: string;
  category?: string;
  outreach_status?: OutreachStatus;
  minScore?: number;
  maxScore?: number;
  hasWebsite?: boolean;
  hasInstagram?: boolean;
  hasWhatsApp?: boolean;
  /**
   * "has" = a number in either phone or whatsapp_phone; "missing" = both null.
   * Tri-state rather than a one-way boolean like the flags above, because
   * "leads I still need a number for" is a view you switch to, not a flag you
   * turn on — and it is the set the Find Contacts run works from.
   */
  phone?: "has" | "missing";
  data_source?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "lead_score" | "created_at" | "rating" | "clinic_name";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface PaginatedLeads {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  totalLeads: number;
  analyzedLeads: number;
  contactedLeads: number;
  avgLeadScore: number;
  highScoreLeads: number;
  newThisWeek: number;
}
