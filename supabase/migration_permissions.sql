-- Run this in your Supabase SQL editor
-- Adds a permissions JSONB column to profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{
    "pages": {
      "dashboard": true,
      "leads": true,
      "search": true,
      "justdial": true,
      "jdLeads": true,
      "export": true
    },
    "actions": {
      "leadsWrite": true,
      "leadsDelete": false,
      "analyze": true
    }
  }'::jsonb;

-- Backfill any existing rows that have null (shouldn't happen with DEFAULT, but safety net)
UPDATE profiles
SET permissions = '{
  "pages": {
    "dashboard": true,
    "leads": true,
    "search": true,
    "justdial": true,
    "jdLeads": true,
    "export": true
  },
  "actions": {
    "leadsWrite": true,
    "leadsDelete": false,
    "analyze": true
  }
}'::jsonb
WHERE permissions IS NULL;
