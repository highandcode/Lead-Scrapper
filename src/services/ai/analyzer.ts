import { supabaseAdmin } from "@/lib/supabase";
import { analyzeWebsite, getWebsiteMetadata, NO_WEBSITE_RESULT, isDirectoryListing } from "@/services/scraping/website";
import { discoverInstagram, scrapeInstagramProfile, scrapeInstagramPosts, searchGoogleForInstagram } from "@/services/scraping/instagram";
import { generateLeadScore } from "@/services/ai/scorer";
import { generateOutreachMessages } from "@/services/ai/outreach";
import { sleep, extractInstagramUsername } from "@/lib/utils";
import type { Lead } from "@/types";

export interface AnalysisResult {
  leadId: string;
  success: boolean;
  error?: string;
}

export async function analyzeLead(leadId: string): Promise<AnalysisResult> {
  // Fetch lead
  const { data: lead, error: fetchError } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (fetchError || !lead) {
    return { leadId, success: false, error: "Lead not found" };
  }

  const updates: Partial<Lead> = {};

  try {
    // Step 1: Website analysis
    let instagramFromWebsiteHtml: string | null = null;
    const hasExistingAnalysis = lead.website_analysis && Object.keys(lead.website_analysis).length > 0;
    const needsDirectoryOverride =
      lead.website &&
      isDirectoryListing(lead.website) &&
      !lead.website_analysis?.directoryListing;
    if (!hasExistingAnalysis || needsDirectoryOverride) {
      if (lead.website) {
        const [websiteResult, metadata] = await Promise.all([
          analyzeWebsite(lead.website),
          getWebsiteMetadata(lead.website),
        ]);

        if (websiteResult) {
          updates.website_analysis = websiteResult.analysis;
          if (websiteResult.email) updates.clinic_email = websiteResult.email;
          instagramFromWebsiteHtml = websiteResult.instagramUsername;
        }
        if (metadata) {
          updates.website_title = metadata.title;
          updates.website_description = metadata.description;
        }
        await sleep(500);
      } else {
        updates.website_analysis = NO_WEBSITE_RESULT;
      }
    }

    // Step 2: Instagram discovery
    // Priority: 1) instagram URL in website field  2) instagram link on website HTML
    //           3) Google search top results  4) name-based guessing
    // If followers is null (scrape never succeeded) but username is set, retry the scrape below.

    if (!lead.instagram_username) {
      const knownUsername =
        (lead.website ? extractInstagramUsername(lead.website) : null) ?? instagramFromWebsiteHtml;

      let igData: Awaited<ReturnType<typeof scrapeInstagramProfile>> = null;
      let resolvedUsername = knownUsername;

      if (knownUsername) {
        igData = await scrapeInstagramProfile(knownUsername);
      } else {
        // Try Google search before falling back to name guessing
        const googleUsername = await searchGoogleForInstagram(lead.clinic_name, lead.city);
        if (googleUsername) {
          resolvedUsername = googleUsername;
          igData = await scrapeInstagramProfile(googleUsername);
        } else {
          igData = await discoverInstagram(lead.clinic_name, lead.website ?? undefined);
        }
      }

      if (igData) {
        updates.instagram_username = igData.username;
        updates.instagram_bio = igData.bio;
        updates.instagram_followers = igData.followers;
        updates.instagram_url = igData.profileUrl;
        updates.instagram_posts = igData.posts;
        updates.instagram_following = igData.following;
        updates.instagram_is_verified = igData.isVerified ?? false;
        updates.instagram_external_url = igData.externalUrl ?? null;
        updates.instagram_has_booking_link = igData.hasBookingLink ?? false;
        updates.has_whatsapp_cta = igData.hasWhatsAppCTA ?? false;
        updates.has_link_in_bio = igData.hasLinkInBio ?? false;
        updates.estimated_engagement_rate = igData.estimatedEngagementRate ?? null;

        // Scrape recent posts for content analysis
        if (igData.username) {
          await sleep(500);
          const postAnalysis = await scrapeInstagramPosts(igData.username, 12);
          if (postAnalysis) {
            postAnalysis.realEngagementRate =
              igData.followers && igData.followers > 0
                ? parseFloat(((postAnalysis.avgLikes + postAnalysis.avgComments) / igData.followers * 100).toFixed(2))
                : 0;
            updates.instagram_enrichment = postAnalysis;
          }
        }
      } else if (resolvedUsername) {
        // Scrape failed (private/deleted) but we know the handle
        updates.instagram_username = resolvedUsername;
        updates.instagram_url = `https://www.instagram.com/${resolvedUsername}/`;
      }
      await sleep(1000);
    } else if (lead.instagram_username && !lead.instagram_followers) {
      const igData = await scrapeInstagramProfile(lead.instagram_username);
      if (igData) {
        updates.instagram_bio = igData.bio;
        updates.instagram_followers = igData.followers;
        updates.instagram_url = igData.profileUrl;
        updates.instagram_posts = igData.posts;
        updates.instagram_following = igData.following;
        updates.instagram_is_verified = igData.isVerified ?? false;
        updates.instagram_external_url = igData.externalUrl ?? null;
        updates.instagram_has_booking_link = igData.hasBookingLink ?? false;
        updates.has_whatsapp_cta = igData.hasWhatsAppCTA ?? false;
        updates.has_link_in_bio = igData.hasLinkInBio ?? false;
        updates.estimated_engagement_rate = igData.estimatedEngagementRate ?? null;

        if (igData.username) {
          await sleep(500);
          const postAnalysis = await scrapeInstagramPosts(igData.username, 12);
          if (postAnalysis) {
            postAnalysis.realEngagementRate =
              igData.followers && igData.followers > 0
                ? parseFloat(((postAnalysis.avgLikes + postAnalysis.avgComments) / igData.followers * 100).toFixed(2))
                : 0;
            updates.instagram_enrichment = postAnalysis;
          }
        }
      }
    }

    // Step 3: AI lead scoring
    const mergedLead = { ...lead, ...updates } as Partial<Lead>;
    const { score, breakdown, reasoning } = await generateLeadScore(mergedLead);
    updates.lead_score = score;
    updates.score_breakdown = breakdown;
    updates.score_reasoning = reasoning;

    // Step 4: Outreach message generation
    const outreach = await generateOutreachMessages(mergedLead);
    updates.outreach_instagram_dm = outreach.instagram_dm;
    updates.outreach_whatsapp = outreach.whatsapp;
    updates.outreach_email = outreach.email;
    updates.outreach_followup = outreach.followup;

    // Update status
    updates.outreach_status = "researched";

    // Save to DB
    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update(updates)
      .eq("id", leadId);

    if (updateError) {
      return { leadId, success: false, error: updateError.message };
    }

    return { leadId, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { leadId, success: false, error: message };
  }
}

export async function analyzeBatch(leadIds: string[]): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];

  for (const id of leadIds) {
    const result = await analyzeLead(id);
    results.push(result);
    await sleep(2000); // Rate limiting between leads
  }

  return results;
}
