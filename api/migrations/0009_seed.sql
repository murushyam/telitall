-- Migration: 0009_seed.sql
-- Seed initial system/sample data for TeliTall

-- Seed default plans if not already inserted
INSERT INTO plans (id, name, price_inr, price_usd, interval, features) VALUES
  ('free', 'Free', 0, 0, NULL,
   '{"connect_duration_min":60,"connect_daily":3,"laya_hourly":20}'),
  ('premium', 'Premium', 149, 2, 'month',
   '{"connect_duration_min":180,"connect_daily":10,"laya_hourly":100}'),
  ('expert_pro', 'Expert Pro', 299, 4, 'month',
   '{"connect_duration_min":null,"connect_daily":null,"laya_hourly":100}')
ON CONFLICT (id) DO NOTHING;

-- Seed system user for Laya AI / Official announcements
INSERT INTO users (id, email, password_hash, is_verified) VALUES
  ('00000000-0000-0000-0000-000000000001', 'system@telitall.com', '$2b$12$e/placeholder.hash.system.user', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (user_id, display_name, role, specialty, reputation) VALUES
  ('00000000-0000-0000-0000-000000000001', 'TeliTall Guide', 'moderator', 'Platform Support', 1000)
ON CONFLICT (user_id) DO NOTHING;
