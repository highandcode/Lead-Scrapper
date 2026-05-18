"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Instagram, MessageCircle, Mail, RotateCcw,
  Copy, Check, Loader2, Sparkles, Send, ExternalLink, Lightbulb
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import toast from "react-hot-toast";
import type { Lead } from "@/types";

interface OutreachPanelProps {
  lead: Lead;
  onRefresh?: (updated: Lead) => void;
}

function cleanPhone(phone: string): string {
  return phone.replace(/[\s\-\+\(\)]/g, "");
}

function parseEmail(raw: string): { subject: string; body: string } {
  const subjectMatch = raw.match(/^SUBJECT:\s*(.+)/im);
  const subject = subjectMatch?.[1]?.trim() ?? "Following up";
  const body = raw.replace(/^SUBJECT:.*\n*/im, "").trim();
  return { subject, body };
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.style.cssText = "position:fixed;opacity:0;pointer-events:none";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

function CopyButton({ text, onCopy }: { text: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await copyToClipboard(text);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
    </Button>
  );
}

function MessageCard({
  content,
  label,
  actions,
}: {
  content: string;
  label: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="flex items-center gap-2">
          <CopyButton text={content} />
          {actions}
        </div>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/3 p-4">
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

export default function OutreachPanel({ lead, onRefresh }: OutreachPanelProps) {
  const [generating, setGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [showSuggestion, setShowSuggestion] = useState(false);

  const hasMessages =
    lead.outreach_instagram_dm ||
    lead.outreach_whatsapp ||
    lead.outreach_email ||
    lead.outreach_followup;

  async function generateMessages(customSuggestion?: string) {
    setGenerating(true);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, suggestion: customSuggestion }),
      });
      if (!res.ok) throw new Error();
      toast.success(customSuggestion ? "Regenerated with your suggestion!" : "Outreach messages generated!");
      if (onRefresh) {
        const updated = await fetch(`/api/leads/${lead.id}`).then((r) => r.json());
        onRefresh(updated);
      }
    } catch {
      toast.error("Failed to generate messages");
    } finally {
      setGenerating(false);
    }
  }

  function openWhatsApp(message: string) {
    const rawPhone = lead.whatsapp_phone ?? lead.phone;
    if (!rawPhone) {
      toast.error("No phone number for this lead");
      return;
    }
    const phone = cleanPhone(rawPhone);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  function openInstagram() {
    if (!lead.instagram_username) {
      toast.error("No Instagram found for this lead — run analysis first");
      return;
    }
    window.open(`https://www.instagram.com/${lead.instagram_username}/`, "_blank");
  }

  async function copyAndOpenInstagram(message: string) {
    await copyToClipboard(message);
    toast.success("DM copied! Opening Instagram profile...");
    setTimeout(() => openInstagram(), 800);
  }

  function openEmail(rawEmail: string) {
    const { subject, body } = parseEmail(rawEmail);
    const to = lead.clinic_email ? `mailto:${lead.clinic_email}` : "mailto:";
    const mailto = `${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, "_self");
  }

  function openGmail(rawEmail: string) {
    const { subject, body } = parseEmail(rawEmail);
    const to = lead.clinic_email ? `&to=${encodeURIComponent(lead.clinic_email)}` : "";
    const url = `https://mail.google.com/mail/?view=cm${to}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank");
  }

  if (!hasMessages) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-20 gap-5 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-blue-400" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Generate Outreach Messages</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            AI will create personalized Instagram DMs, WhatsApp messages, emails, and follow-ups for {lead.clinic_name}.
          </p>
        </div>
        <Button variant="gradient" onClick={() => generateMessages()} disabled={generating}>
          {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate with AI</>}
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Personalized Outreach</h3>
          <p className="text-xs text-muted-foreground mt-0.5">AI-crafted messages for {lead.clinic_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSuggestion((v) => !v)}
            className={showSuggestion ? "border-amber-500/40 text-amber-400" : ""}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Suggest
          </Button>
          <Button variant="outline" size="sm" onClick={() => generateMessages()} disabled={generating}>
            {generating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Regenerating...</> : <><RotateCcw className="w-3.5 h-3.5" /> Regenerate</>}
          </Button>
        </div>
      </div>

      {/* Suggestion box */}
      <AnimatePresence>
        {showSuggestion && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="text-xs font-medium text-amber-300">Custom suggestion for AI</p>
              </div>
              <textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder={`e.g. "Mention they haven't posted in 3 months"\n"Focus on their low Instagram engagement"\n"Reference that we helped a dental clinic in Delhi"`}
                rows={3}
                className="w-full rounded-lg bg-black/30 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground/50 px-3 py-2 resize-none focus:outline-none focus:border-amber-500/40 transition-colors"
              />
              <Button
                variant="gradient"
                size="sm"
                className="w-full"
                disabled={generating || !suggestion.trim()}
                onClick={() => {
                  generateMessages(suggestion.trim());
                  setShowSuggestion(false);
                  setSuggestion("");
                }}
              >
                {generating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Regenerating...</>
                  : <><Sparkles className="w-3.5 h-3.5" /> Regenerate with this suggestion</>
                }
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs defaultValue="whatsapp">
        <TabsList className="w-full">
          <TabsTrigger value="whatsapp" className="flex-1 gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="instagram" className="flex-1 gap-1.5">
            <Instagram className="w-3.5 h-3.5" /> Instagram DM
          </TabsTrigger>
          <TabsTrigger value="email" className="flex-1 gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Email
          </TabsTrigger>
          <TabsTrigger value="followup" className="flex-1 gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Follow-Up
          </TabsTrigger>
        </TabsList>

        {/* WhatsApp */}
        <TabsContent value="whatsapp">
          {lead.outreach_whatsapp ? (
            <>
              <MessageCard
                content={lead.outreach_whatsapp}
                label="WhatsApp Message"
                actions={
                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={() => openWhatsApp(lead.outreach_whatsapp!)}
                    disabled={!lead.whatsapp_phone && !lead.phone}
                    title={lead.whatsapp_phone ? `Send to ${lead.whatsapp_phone} (verified)` : lead.phone ? `Send to ${lead.phone}` : "No phone number available"}
                  >
                    <Send className="w-3.5 h-3.5" /> Open in WhatsApp
                  </Button>
                }
              />
              {lead.whatsapp_phone ? (
                <p className="text-xs text-emerald-400 mt-2">
                  → Sending to verified WhatsApp <span className="font-mono">+{lead.whatsapp_phone}</span>
                </p>
              ) : lead.phone ? (
                <p className="text-xs text-muted-foreground mt-2">
                  → Will open WhatsApp Web with message pre-filled for <span className="text-foreground font-mono">{lead.phone}</span>
                </p>
              ) : (
                <p className="text-xs text-orange-400 mt-2">⚠ No phone number scraped for this lead</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">No WhatsApp message generated yet.</p>
          )}
        </TabsContent>

        {/* Instagram */}
        <TabsContent value="instagram">
          {lead.outreach_instagram_dm ? (
            <>
              <MessageCard
                content={lead.outreach_instagram_dm}
                label="Instagram DM"
                actions={
                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={() => copyAndOpenInstagram(lead.outreach_instagram_dm!)}
                    title={lead.instagram_username ? `Open @${lead.instagram_username}` : "No Instagram found"}
                  >
                    <Instagram className="w-3.5 h-3.5" /> Copy & Open Profile
                  </Button>
                }
              />
              {lead.instagram_username ? (
                <p className="text-xs text-muted-foreground mt-2">
                  → Copies DM to clipboard and opens <span className="text-pink-400">@{lead.instagram_username}</span> — paste in DM box
                </p>
              ) : (
                <p className="text-xs text-orange-400 mt-2">⚠ No Instagram found — run analysis first to discover their profile</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">No Instagram DM generated yet.</p>
          )}
        </TabsContent>

        {/* Email */}
        <TabsContent value="email">
          {lead.outreach_email ? (
            <>
              <MessageCard
                content={lead.outreach_email}
                label="Cold Email"
                actions={
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEmail(lead.outreach_email!)}>
                      <Mail className="w-3.5 h-3.5" /> Mail App
                    </Button>
                    <Button variant="gradient" size="sm" onClick={() => openGmail(lead.outreach_email!)}>
                      <ExternalLink className="w-3.5 h-3.5" /> Gmail
                    </Button>
                  </div>
                }
              />
              {lead.clinic_email ? (
                <p className="text-xs text-muted-foreground mt-2">
                  → Will send to <span className="text-foreground font-mono">{lead.clinic_email}</span>
                </p>
              ) : (
                <p className="text-xs text-orange-400 mt-2">
                  ⚠ No email found on their website — add manually in the To field
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">No email generated yet.</p>
          )}
        </TabsContent>

        {/* Follow-up */}
        <TabsContent value="followup">
          {lead.outreach_followup ? (
            <>
              <MessageCard
                content={lead.outreach_followup}
                label="Follow-Up (Day 5–7)"
                actions={
                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={() => openWhatsApp(lead.outreach_followup!)}
                    disabled={!lead.whatsapp_phone && !lead.phone}
                  >
                    <Send className="w-3.5 h-3.5" /> Open in WhatsApp
                  </Button>
                }
              />
              {(lead.whatsapp_phone || lead.phone) && (
                <p className="text-xs text-muted-foreground mt-2">
                  → Send this 5–7 days after no reply to your first WhatsApp message
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">No follow-up generated yet.</p>
          )}
        </TabsContent>
      </Tabs>

      <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-4">
        <p className="text-xs text-amber-300/80">
          <span className="font-semibold">Reminder:</span> Always review and personalize before sending. These are AI-generated starting points.
        </p>
      </div>
    </motion.div>
  );
}
