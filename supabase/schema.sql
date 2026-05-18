-- ============================================================
-- Clinic Lead Intelligence System — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- LEADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Google Maps Data
  clinic_name TEXT NOT NULL,
  category TEXT,
  city TEXT,
  address TEXT,
  phone TEXT,
  website TEXT,
  google_maps_url TEXT,
  rating DECIMAL(2,1),
  review_count INTEGER DEFAULT 0,
  place_id TEXT UNIQUE,

  -- Instagram Data
  instagram_username TEXT,
  instagram_bio TEXT,
  instagram_followers INTEGER,
  instagram_url TEXT,
  instagram_posts INTEGER,
  instagram_following INTEGER,
  has_whatsapp_cta BOOLEAN DEFAULT FALSE,
  has_link_in_bio BOOLEAN DEFAULT FALSE,
  estimated_engagement_rate DECIMAL(5,2),

  -- Website Analysis
  website_title TEXT,
  website_description TEXT,
  website_analysis JSONB DEFAULT '{}',
  clinic_email TEXT,

  -- AI Scoring
  lead_score INTEGER CHECK (lead_score >= 0 AND lead_score <= 100),
  score_breakdown JSONB DEFAULT '{}',
  score_reasoning TEXT,

  -- AI Outreach Messages
  outreach_instagram_dm TEXT,
  outreach_whatsapp TEXT,
  outreach_email TEXT,
  outreach_followup TEXT,

  -- Pipeline Status
  outreach_status TEXT DEFAULT 'new' CHECK (
    outreach_status IN ('new', 'researched', 'contacted', 'replied', 'meeting_set', 'closed', 'not_interested', 'not_on_wa_or_gmail')
  ),
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,

  -- Meta
  search_query TEXT,
  data_source TEXT DEFAULT 'google_maps',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEARCH SESSIONS TABLE (track searches for analytics)
-- ============================================================
CREATE TABLE IF NOT EXISTS search_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city TEXT NOT NULL,
  niche TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  leads_found INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_outreach_status ON leads(outreach_status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_clinic_name ON leads USING gin(to_tsvector('english', clinic_name));

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (disable for MVP, enable for multi-tenant)
-- ============================================================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_sessions ENABLE ROW LEVEL SECURITY;

-- Allow all operations from service role (backend)
CREATE POLICY "Service role full access leads" ON leads
  FOR ALL USING (true);

CREATE POLICY "Service role full access sessions" ON search_sessions
  FOR ALL USING (true);
