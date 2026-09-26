-- Migration: 0003_connect.sql
-- Vertical 3: Anonymous Connect (analytics only; rooms live in Redis)

CREATE TABLE connect_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id),
  topic            TEXT NOT NULL,
  category         TEXT DEFAULT 'other',
  started_at       TIMESTAMPTZ DEFAULT now(),
  matched_at       TIMESTAMPTZ DEFAULT NULL,
  ended_at         TIMESTAMPTZ DEFAULT NULL,
  was_matched      BOOLEAN DEFAULT FALSE,
  end_reason       TEXT DEFAULT NULL CHECK (end_reason IN ('expired', 'user_left', 'peer_left', 'wiped', NULL)),
  duration_seconds INTEGER DEFAULT NULL,
  message_count    INTEGER DEFAULT 0
);

CREATE INDEX idx_connect_user     ON connect_sessions(user_id);
CREATE INDEX idx_connect_started  ON connect_sessions(started_at DESC);
CREATE INDEX idx_connect_matched  ON connect_sessions(was_matched);
