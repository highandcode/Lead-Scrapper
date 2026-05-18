import type { Lead } from "@/types";

export function leadsToCSV(leads: Lead[]): string {
  const headers = [
    "Clinic Name",
    "Category",
    "City",
    "Address",
    "Phone",
    "Website",
    "Google Rating",
    "Review Count",
    "Lead Score",
    "Instagram Username",
    "Instagram Followers",
    "Instagram URL",
    "Has WhatsApp",
    "Has Link in Bio",
    "Outreach Status",
    "Website Weaknesses",
    "Pitchable Services",
    "Instagram DM",
    "WhatsApp Message",
    "Notes",
    "Google Maps URL",
    "Created At",
  ];

  const escape = (val: unknown): string => {
    if (val == null) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = leads.map((l) => [
    escape(l.clinic_name),
    escape(l.category),
    escape(l.city),
    escape(l.address),
    escape(l.phone),
    escape(l.website),
    escape(l.rating),
    escape(l.review_count),
    escape(l.lead_score),
    escape(l.instagram_username),
    escape(l.instagram_followers),
    escape(l.instagram_url),
    escape(l.has_whatsapp_cta ? "Yes" : "No"),
    escape(l.has_link_in_bio ? "Yes" : "No"),
    escape(l.outreach_status),
    escape(l.website_analysis?.weaknesses?.join("; ") ?? ""),
    escape(l.website_analysis?.pitchableServices?.join("; ") ?? ""),
    escape(l.outreach_instagram_dm?.replace(/\n/g, " ") ?? ""),
    escape(l.outreach_whatsapp?.replace(/\n/g, " ") ?? ""),
    escape(l.notes),
    escape(l.google_maps_url),
    escape(l.created_at),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
