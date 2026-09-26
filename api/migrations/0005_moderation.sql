-- Migration: 0005_moderation.sql
-- Vertical 5: Reporting & Moderation

CREATE TABLE reports (
  id           SERIAL PRIMARY KEY,
  reporter_id  UUID NOT NULL REFERENCES users(id),
  target_type  TEXT NOT NULL CHECK (target_type IN ('question', 'answer', 'connect_message')),
  target_id    INTEGER NOT NULL,
  reason       TEXT NOT NULL CHECK (reason IN (
    'spam', 'harassment', 'harmful', 'off_topic', 'other'
  )),
  details      TEXT DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by  UUID REFERENCES users(id),
  reviewed_at  TIMESTAMPTZ,
  action_taken TEXT DEFAULT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX idx_reports_target ON reports(target_type, target_id);

CREATE TABLE user_sanctions (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL CHECK (type IN ('warning', 'mute', 'suspend', 'ban')),
  reason     TEXT NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  issued_by  UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sanctions_user ON user_sanctions(user_id, created_at DESC);
