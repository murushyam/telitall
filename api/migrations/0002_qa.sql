-- Migration: 0002_qa.sql
-- Vertical 2: Questions & Answers

CREATE TABLE questions (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name     TEXT NOT NULL,
  author_role     TEXT DEFAULT 'user',
  author_specialty TEXT DEFAULT '',
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 8 AND 140),
  body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 20 AND 4000),
  category        TEXT NOT NULL CHECK (category IN (
    'relationships','life','career','education','mathematics',
    'technology','business','health','home','other'
  )),
  kind            TEXT NOT NULL CHECK (kind IN ('experience', 'knowledge')),
  is_hidden       BOOLEAN DEFAULT FALSE,
  view_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  edited_at       TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_questions_created  ON questions(created_at DESC);
CREATE INDEX idx_questions_category ON questions(category);
CREATE INDEX idx_questions_kind     ON questions(kind);
CREATE INDEX idx_questions_user     ON questions(user_id);
CREATE INDEX idx_questions_visible  ON questions(created_at DESC) WHERE is_hidden = FALSE;

CREATE TABLE answers (
  id              SERIAL PRIMARY KEY,
  question_id     INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name     TEXT NOT NULL,
  author_role     TEXT DEFAULT 'user',
  author_specialty TEXT DEFAULT '',
  body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 4000),
  helpful         INTEGER NOT NULL DEFAULT 0 CHECK (helpful >= 0),
  is_best         BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  edited_at       TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_answers_question ON answers(question_id);
CREATE INDEX idx_answers_user     ON answers(user_id);
CREATE INDEX idx_answers_best     ON answers(question_id) WHERE is_best = TRUE;

CREATE TABLE helpful_votes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_id  INTEGER NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, answer_id)
);
