-- 0005_roles_and_intent.sql
-- Adds role (user vs expert), intent (ask, answer, both), and specialty to profiles

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
ADD COLUMN IF NOT EXISTS intent TEXT NOT NULL DEFAULT 'both',
ADD COLUMN IF NOT EXISTS specialty TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
