-- 0004_ephemeral_chats.sql
-- Supports 1-hour self-destructing anonymous stranger chats by experience topic

CREATE TABLE IF NOT EXISTS ephemeral_rooms (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS ephemeral_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES ephemeral_rooms(id) ON DELETE CASCADE,
  sender_alias TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ephemeral_rooms_expires ON ephemeral_rooms(expires_at);
CREATE INDEX IF NOT EXISTS idx_ephemeral_messages_room ON ephemeral_messages(room_id, created_at);
