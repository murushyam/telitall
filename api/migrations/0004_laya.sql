-- Migration: 0004_laya.sql
-- Vertical 4: Laya AI threads and messages

CREATE TABLE laya_threads (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_laya_threads_user ON laya_threads(user_id, updated_at DESC);

CREATE TABLE laya_messages (
  id         SERIAL PRIMARY KEY,
  thread_id  INTEGER NOT NULL REFERENCES laya_threads(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_laya_messages_thread ON laya_messages(thread_id, created_at);
