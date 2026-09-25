-- Full-text search on questions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION questions_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.body, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS questions_search_trigger ON questions;
CREATE TRIGGER questions_search_trigger
  BEFORE INSERT OR UPDATE OF title, body ON questions
  FOR EACH ROW EXECUTE FUNCTION questions_search_update();

-- Backfill existing rows
UPDATE questions SET search_vector = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS questions_search_idx ON questions USING gin(search_vector);

-- Edit tracking
ALTER TABLE questions ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE answers ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Content reports for moderation
CREATE TABLE IF NOT EXISTS reports (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  target_type text NOT NULL,
  target_id integer NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_type_chk CHECK (target_type IN ('question', 'answer')),
  CONSTRAINT reports_status_chk CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  CONSTRAINT reports_unique UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at DESC);
