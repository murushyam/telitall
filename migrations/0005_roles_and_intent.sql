-- 0005_roles_and_intent.sql
-- Adds role (user vs expert), intent (ask, answer, both), and specialty to profiles

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
ADD COLUMN IF NOT EXISTS intent TEXT NOT NULL DEFAULT 'both',
ADD COLUMN IF NOT EXISTS specialty TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Seed default expert guide profile
INSERT INTO profiles (user_id, display_name, reputation, role, intent, specialty)
VALUES ('admin_guide_01', 'TeliTall Guide', 100, 'expert', 'both', 'Life & Career Mentor')
ON CONFLICT (user_id) DO NOTHING;

