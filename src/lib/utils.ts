import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Returns a wa.me URL for any Indian phone number format.
// Pass whatsapp_phone first (real number), falls back to phone (JD tracking number).
// An optional prefilled `text` is appended as the wa.me `text` query param.
export function toWhatsAppUrl(
  whatsappPhone: string | null | undefined,
  fallbackPhone?: string | null,
  text?: string
): string | null {
  const raw = whatsappPhone || fallbackPhone;
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const number =
    digits.startsWith("91") && digits.length === 12 ? digits
    : digits.length === 10 && /^[6-9]/.test(digits) ? `91${digits}`
    : digits;
  const suffix = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${number}${suffix}`;
}

// Placeholders a WhatsApp template's content may contain — resolved against
// a lead's fields before the message is sent. Kept deliberately generic
// (name/phone/city/category) since templates aren't limited to clinic leads.
export function resolveTemplate(
  content: string,
  fields: { name?: string | null; phone?: string | null; city?: string | null; category?: string | null }
): string {
  return content
    .replace(/\{\{\s*name\s*\}\}/gi, fields.name || "")
    .replace(/\{\{\s*phone\s*\}\}/gi, fields.phone || "")
    .replace(/\{\{\s*city\s*\}\}/gi, fields.city || "")
    .replace(/\{\{\s*category\s*\}\}/gi, fields.category || "");
}

// Retry with exponential backoff
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        await sleep(baseDelayMs * Math.pow(2, attempt));
      }
    }
  }
  throw lastError!;
}

export function getLeadScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

export function getLeadScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/20 border-emerald-500/30";
  if (score >= 60) return "bg-yellow-500/20 border-yellow-500/30";
  if (score >= 40) return "bg-orange-500/20 border-orange-500/30";
  return "bg-red-500/20 border-red-500/30";
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    researched: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    contacted: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    replied: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    meeting_set: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    closed: "bg-green-500/20 text-green-400 border-green-500/30",
    not_interested: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    not_on_wa_or_gmail: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return colors[status] ?? colors.new;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export function extractInstagramUsername(url: string): string | null {
  try {
    const match = url.match(/instagram\.com\/([a-zA-Z0-9._]+)\/?/);
    const username = match?.[1];
    const reserved = ["p", "reel", "stories", "explore", "accounts", "tv"];
    if (!username || reserved.includes(username)) return null;
    return username;
  } catch {
    return null;
  }
}

export function guessInstagramUsername(clinicName: string, website?: string): string[] {
  const base = clinicName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "");

  const candidates = [base, `${base}clinic`, `${base}official`, `dr${base}`];

  if (website) {
    try {
      const domain = extractDomain(website).split(".")[0];
      if (domain !== "instagram") candidates.push(domain);
    } catch {
      // ignore
    }
  }

  return Array.from(new Set(candidates)).slice(0, 5);
}

export function buildSearchQuery(city: string, niche: string): string {
  return `${niche} ${city}`;
}

export function truncate(str: string, maxLen: number): string {
  return str.length <= maxLen ? str : `${str.slice(0, maxLen)}…`;
}

export function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0] ?? "")
      .filter(Boolean)
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (email?.[0] ?? "?").toUpperCase();
}
