-- ============================================================
-- AUTH SCHEMA — Clinic Lead Intelligence Platform
-- Run this in Supabase SQL Editor AFTER schema.sql
-- ============================================================

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'user'
                CHECK (role IN ('admin', 'user')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ============================================================
-- UPDATED_AT TRIGGER FOR PROFILES
-- ============================================================
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY — PROFILES
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Helper: read caller's role without triggering RLS (prevents infinite recursion)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  USING (get_my_role() = 'admin');

-- Users can update their own profile (name, avatar only — not role)
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = get_my_role());

-- Admins can update any profile (including role changes)
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  USING (get_my_role() = 'admin');

-- Service role has full access (backend)
CREATE POLICY "profiles_service_role"
  ON profiles FOR ALL
  TO service_role
  USING (true);

-- ============================================================
-- ADD user_id TO LEADS (multi-user support)
-- ============================================================
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);

-- ============================================================
-- ROW LEVEL SECURITY — LEADS (multi-user)
-- ============================================================

-- Drop the old catch-all policy
DROP POLICY IF EXISTS "Service role full access leads" ON leads;

-- Users can manage their own leads
CREATE POLICY "leads_manage_own"
  ON leads FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Service role bypass (used by backend API with supabaseAdmin)
CREATE POLICY "leads_service_role"
  ON leads FOR ALL
  TO service_role
  USING (true);

-- ============================================================
-- ROW LEVEL SECURITY — SEARCH SESSIONS
-- ============================================================
DROP POLICY IF EXISTS "Service role full access sessions" ON search_sessions;

ALTER TABLE search_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE POLICY "sessions_manage_own"
  ON search_sessions FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "sessions_service_role"
  ON search_sessions FOR ALL
  TO service_role
  USING (true);

-- ============================================================
-- HELPER: promote a user to admin (run manually as needed)
-- Usage: SELECT make_user_admin('user@example.com');
-- ============================================================
CREATE OR REPLACE FUNCTION make_user_admin(user_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET role = 'admin' WHERE email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
