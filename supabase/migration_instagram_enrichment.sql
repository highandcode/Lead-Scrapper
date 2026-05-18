-- Run this in your Supabase SQL editor
-- Adds richer Instagram columns to the leads table

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS instagram_is_verified     BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS instagram_external_url    TEXT,
  ADD COLUMN IF NOT EXISTS instagram_has_booking_link BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS instagram_enrichment      JSONB;

-- instagram_enrichment JSONB shape:
-- {
--   "avgLikes": 150,
--   "avgComments": 12,
--   "realEngagementRate": 2.3,
--   "postTypes": {
--     "beforeAfter": true,
--     "testimonials": false,
--     "educational": true,
--     "promotional": false,
--     "whatsappInPosts": false
--   },
--   "postingFrequencyDays": 3,
--   "lastPostDate": "2024-01-15",
--   "sampleCaptions": ["caption1", "caption2", "caption3"]
-- }
