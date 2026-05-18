-- Run this in your Supabase SQL editor
-- Adds a whatsapp_phone column to store the clinic's actual WhatsApp number
-- (separate from the JustDial call-tracking redirect number in `phone`)

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
