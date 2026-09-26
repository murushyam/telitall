-- Migration: 0006_subscriptions.sql
-- Vertical 6: Subscriptions & Monetization

CREATE TABLE plans (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  price_inr    INTEGER NOT NULL DEFAULT 0,
  price_usd    INTEGER NOT NULL DEFAULT 0,
  interval     TEXT DEFAULT 'month',
  features     JSONB DEFAULT '{}'
);

INSERT INTO plans (id, name, price_inr, price_usd, interval, features) VALUES
  ('free',       'Free',       0,   0,   NULL,    '{"connect_duration_min":60,"connect_daily":3,"laya_hourly":20}'),
  ('premium',    'Premium',    149, 2,   'month', '{"connect_duration_min":180,"connect_daily":10,"laya_hourly":100}'),
  ('expert_pro', 'Expert Pro', 299, 4,   'month', '{"connect_duration_min":null,"connect_daily":null,"laya_hourly":100}');

CREATE TABLE subscriptions (
  id                   SERIAL PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES users(id),
  plan_id              TEXT NOT NULL REFERENCES plans(id),
  status               TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  payment_provider     TEXT DEFAULT 'razorpay',
  provider_sub_id      TEXT DEFAULT NULL,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end   TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subs_user   ON subscriptions(user_id, status);
CREATE INDEX idx_subs_expiry ON subscriptions(current_period_end) WHERE status = 'active';

CREATE TABLE payments (
  id                  SERIAL PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES users(id),
  subscription_id     INTEGER REFERENCES subscriptions(id),
  amount_inr          INTEGER NOT NULL,
  currency            TEXT DEFAULT 'INR',
  provider            TEXT DEFAULT 'razorpay',
  provider_payment_id TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_user ON payments(user_id, created_at DESC);
