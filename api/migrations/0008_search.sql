-- Migration: 0008_search.sql
-- Vertical 8: Full-text search and trending score

ALTER TABLE questions ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_questions_search ON questions USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_question_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A')
    || setweight(to_tsvector('english', COALESCE(NEW.body, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_question_search ON questions;
CREATE TRIGGER trg_question_search
BEFORE INSERT OR UPDATE OF title, body ON questions
FOR EACH ROW EXECUTE FUNCTION update_question_search_vector();

ALTER TABLE questions ADD COLUMN IF NOT EXISTS trending_score FLOAT DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_questions_trending ON questions(trending_score DESC);
