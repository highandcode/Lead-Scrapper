-- Run this in your Supabase SQL editor
-- Adds a whatsapp_templates table — admin-managed message templates that
-- users pick from to send a WhatsApp message to a lead (currently used by
-- the Google Leads section).

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- content supports {{name}}, {{phone}}, {{city}}, {{category}} placeholders,
-- resolved client-side against a lead before opening WhatsApp.

CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Auth/authorization is enforced in the Next.js API routes (requireApiAuth /
-- requireApiRole), same as the leads and search_sessions tables — RLS here
-- just mirrors their permissive "service role handles it" policy.
CREATE POLICY "Service role full access whatsapp_templates" ON whatsapp_templates
  FOR ALL USING (true);

-- Seed a default template so the list isn't empty for users before an admin
-- adds their own. Dated ahead of NOW() so it always sorts first (the API
-- orders by created_at ascending) regardless of what gets added later.
INSERT INTO whatsapp_templates (name, content, created_at)
SELECT
  'Introduction',
  'Hi {{name}}, hope you''re doing well! I came across your business in {{city}} and wanted to reach out — we help businesses like yours grow with better online visibility and more leads. Would you be open to a quick chat this week?',
  '2026-08-01T00:00:00+00:00'
WHERE NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE name = 'Introduction');
