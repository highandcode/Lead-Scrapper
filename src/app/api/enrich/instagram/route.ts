import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  scrapeInstagramProfile,
  discoverInstagram,
  searchGoogleForInstagram,
  extractEmailFromBio,
} from "@/services/scraping/instagram";
import { extractInstagramUsername, sleep } from "@/lib/utils";
import type { Lead } from "@/types";

interface EnrichResult {
  leadId: string;
  success: boolean;
  found: boolean;
  instagram?: {
    username: string;
    followers: number;
    following: number;
    posts: number;
    bio: string;
    profileUrl: string;
    hasWhatsAppCTA: boolean;
    hasLinkInBio: boolean;
    estimatedEngagementRate: number;
    pitchInsights: string[];
  };
  error?: string;
}

function buildPitchInsights(ig: {
  followers: number;
  posts: number;
  hasWhatsAppCTA: boolean;
  hasLinkInBio: boolean;
  estimatedEngagementRate: number;
  bio: string;
}): string[] {
  const insights: string[] = [];

  if (ig.followers < 500)
    insights.push("Very low followers — huge growth opportunity to pitch");
  else if (ig.followers < 2000)
    insights.push("Low followers — pitch organic growth & content strategy");
  else if (ig.followers < 10000)
    insights.push("Moderate following — pitch engagement & conversion");
  else insights.push("Strong following — pitch monetisation & lead funnels");

  if (ig.posts < 10) insights.push("Almost no posts — pitch content creation from scratch");
  else if (ig.posts < 30) insights.push("Low post count — pitch consistent content calendar");
  else if (ig.posts > 200) insights.push("High post volume — pitch content quality over quantity");

  if (!ig.hasWhatsAppCTA) insights.push("No WhatsApp CTA in bio — easy quick win to pitch");
  else insights.push("Has WhatsApp CTA — already understands direct response");

  if (!ig.hasLinkInBio) insights.push("No link in bio — pitch landing page / booking link setup");
  else insights.push("Has link in bio — check if it's a booking page or just a website");

  if (ig.estimatedEngagementRate < 2)
    insights.push("Low estimated engagement — pitch content & community strategy");
  else if (ig.estimatedEngagementRate > 5)
    insights.push("High engagement rate — good warm audience, pitch paid ads");

  return insights;
}

async function enrichSingleLead(leadId: string): Promise<EnrichResult> {
  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("id, clinic_name, city, website, instagram_username, instagram_followers, clinic_email")
    .eq("id", leadId)
    .single();

  if (error || !lead) {
    return { leadId, success: false, found: false, error: "Lead not found" };
  }

  try {
    let igData: Awaited<ReturnType<typeof scrapeInstagramProfile>> = null;

    if (lead.instagram_username) {
      igData = await scrapeInstagramProfile(lead.instagram_username);
    } else {
      const fromWebsite = lead.website
        ? extractInstagramUsername(lead.website)
        : null;

      if (fromWebsite) {
        igData = await scrapeInstagramProfile(fromWebsite);
      } else {
        const googleHandle = await searchGoogleForInstagram(
          lead.clinic_name,
          lead.city
        );
        if (googleHandle) {
          igData = await scrapeInstagramProfile(googleHandle);
        } else {
          igData = await discoverInstagram(
            lead.clinic_name,
            lead.website ?? undefined
          );
        }
      }
    }

    if (!igData?.username) {
      return { leadId, success: true, found: false };
    }

    const bioEmail = extractEmailFromBio(igData.bio ?? "");

    const updates: Partial<Lead> = {
      instagram_username: igData.username,
      instagram_bio: igData.bio,
      instagram_followers: igData.followers,
      instagram_url: igData.profileUrl,
      instagram_posts: igData.posts,
      instagram_following: igData.following,
      instagram_external_url: igData.externalUrl ?? null,
      has_whatsapp_cta: igData.hasWhatsAppCTA ?? false,
      has_link_in_bio: igData.hasLinkInBio ?? false,
      estimated_engagement_rate: igData.estimatedEngagementRate ?? null,
      ...(bioEmail && !lead.clinic_email ? { clinic_email: bioEmail } : {}),
    };

    await supabaseAdmin.from("leads").update(updates).eq("id", leadId);

    return {
      leadId,
      success: true,
      found: true,
      instagram: {
        username: igData.username!,
        followers: igData.followers ?? 0,
        following: igData.following ?? 0,
        posts: igData.posts ?? 0,
        bio: igData.bio ?? "",
        profileUrl: igData.profileUrl ?? "",
        hasWhatsAppCTA: igData.hasWhatsAppCTA ?? false,
        hasLinkInBio: igData.hasLinkInBio ?? false,
        estimatedEngagementRate: igData.estimatedEngagementRate ?? 0,
        pitchInsights: buildPitchInsights({
          followers: igData.followers ?? 0,
          posts: igData.posts ?? 0,
          hasWhatsAppCTA: igData.hasWhatsAppCTA ?? false,
          hasLinkInBio: igData.hasLinkInBio ?? false,
          estimatedEngagementRate: igData.estimatedEngagementRate ?? 0,
          bio: igData.bio ?? "",
        }),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scrape failed";
    return { leadId, success: false, found: false, error: message };
  }
}

export async function POST(request: NextRequest) {
  const { response } = await requireApiAuth();
  if (response) return response;

  const body = await request.json();
  const { leadId, leadIds } = body as {
    leadId?: string;
    leadIds?: string[];
  };

  if (!leadId && (!leadIds || leadIds.length === 0)) {
    return NextResponse.json(
      { error: "leadId or leadIds required" },
      { status: 400 }
    );
  }

  if (leadIds) {
    if (leadIds.length > 20) {
      return NextResponse.json(
        { error: "Maximum 20 leads per batch" },
        { status: 400 }
      );
    }

    const results: EnrichResult[] = [];
    for (const id of leadIds) {
      const result = await enrichSingleLead(id);
      results.push(result);
      if (results.length < leadIds.length) await sleep(1500);
    }

    const found = results.filter((r) => r.found).length;
    return NextResponse.json({
      results,
      summary: {
        total: leadIds.length,
        found,
        notFound: leadIds.length - found,
      },
    });
  }

  const result = await enrichSingleLead(leadId!);
  return NextResponse.json(result);
}
