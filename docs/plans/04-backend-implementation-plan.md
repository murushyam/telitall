# TeliTall — Vertical Implementation Plans

> From local-only localStorage demo to production-grade multi-user platform.
> Each vertical is self-contained: it names the problem, the backend tables, the API endpoints, the real-time behavior, security rules, and the migration path from the current phone-edition code.

---

## Current State Assessment

### What exists today

| Layer | Reality |
| :--- | :--- |
| **Frontend** | Single `index.html` (72 KB) with vanilla JS. All state in `localStorage`. Renders QA, Anonymous Connect, Laya AI, Profile. |
| **Backend** | **None.** Server functions in `server.ts` exist in the repo but are part of a TanStack Start scaffold that was never deployed. The live site at `telitall.vercel.app` serves only static files from `docs/`. |
| **Auth** | Fake — passwords stored in plaintext in `localStorage`. No sessions, no tokens, no hashing. |
| **Data** | Everything lives on one device. Two users on two browsers share zero data. |
| **Connect** | Simulated peer — a random canned reply after 1.2 seconds. No real second person. |
| **Laya AI** | On-device `layaReply()` function with hardcoded pattern-matched responses. No LLM API call. |
| **Hosting** | GitHub Pages + Vercel (static). GitHub Actions auto-deploys `docs/` on push. |

### What must change for a real product

1. A **real database** shared by all users worldwide.
2. **Real authentication** with hashed passwords, sessions, and JWT tokens.
3. **Real-time Connect** — two actual strangers matched and chatting via WebSocket.
4. **Live Laya** — server-side LLM calls with the API key never exposed to the client.
5. **Moderation** — reports reviewed by humans, content hidden, repeat offenders suspended.
6. **Subscriptions** — monetization path after free-tier usage.

---

## Architecture Overview

```
                         CLIENTS
   Web App (SPA)    Android APK (WebView)    Future iOS/PWA
        |                |                     |
        +---------HTTPS + WSS-----------------+
                         |
                    API GATEWAY
              (Node.js / Express or Hono)

   REST API          WebSocket Server       Background Jobs
   /api/v1/*         (Socket.io)            (Cron / Queue)
   Auth              Connect Matching       Purge expired rooms
   Questions         Real-time Chat         Moderation queue
   Answers                                  Notification dispatch
   Votes                                    Analytics aggregation
   Laya
   Profile
   Reports
   Subscriptions
          |                 |                    |
          +---------SERVICE LAYER---------------+
          Auth Service        Connect Service
          Question Service    Laya Service
          Answer Service      Report / Moderation Svc
          Vote Service        Subscription Service
          Notification Service
                            |
                     DATA LAYER
   PostgreSQL        Redis               Object Storage (S3/R2)
   Users             Sessions            Future: profile pics
   Profiles          Rate limiting       Future: attachments
   Questions         Connect matchmaking
   Answers           Laya cache
   Votes             Pub/Sub for WS
   Reports
   Laya threads
   Subscriptions

   External APIs:
   xAI (Grok) for Laya LLM
   Razorpay for payments
   Resend/Postmark for email
   Firebase Cloud Messaging for push
```

---

## Vertical 1: Authentication and User Accounts

### Problem
Currently, passwords are stored in plaintext in localStorage. No real sessions exist. Two devices cannot share an identity.

### Database Schema

```sql
-- Migration: 0001_auth.sql

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE profiles (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL DEFAULT 'Member',
  role          TEXT NOT NULL DEFAULT 'user'
                CHECK (role IN ('user', 'expert')),
  intent        TEXT NOT NULL DEFAULT 'both'
                CHECK (intent IN ('ask', 'answer', 'both')),
  specialty     TEXT DEFAULT '',
  reputation    INTEGER NOT NULL DEFAULT 0 CHECK (reputation >= 0),
  bio           TEXT DEFAULT '',
  avatar_url    TEXT DEFAULT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_reputation ON profiles(reputation DESC);

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  ip_address    INET,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_user  ON sessions(user_id);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE email_verifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT FALSE
);
```

### API Endpoints

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | /api/v1/auth/signup | No | Create account. Hash password with bcrypt (cost 12). Send verification email. Return session token. |
| POST | /api/v1/auth/signin | No | Verify email + password. Return session token. |
| POST | /api/v1/auth/signout | Yes | Invalidate session token. |
| POST | /api/v1/auth/verify-email | Yes | Accept 6-digit code. Set email_verified = true. |
| POST | /api/v1/auth/forgot-password | No | Send password reset email with time-limited link. |
| POST | /api/v1/auth/reset-password | No | Accept reset token + new password. |
| GET  | /api/v1/auth/me | Yes | Return current user profile. |

### Security Rules
- Passwords hashed with **bcrypt** (cost 12), never stored or transmitted in plaintext.
- Session tokens are random 256-bit values. Only the SHA-256 hash is stored in the DB.
- Sessions expire after 30 days. Sliding expiration on each authenticated request.
- Rate limit: 5 signup attempts per IP per hour, 10 signin attempts per IP per 15 minutes.
- Email verification required before posting questions/answers (reading is allowed immediately).

### Migration Path from Current Code
1. The `db.accounts` array in localStorage is replaced by the `users` table.
2. The `db.currentUser` object is replaced by a JWT/session cookie returned on login.
3. The `onSignUp()` and `onSignIn()` functions become `fetch('/api/v1/auth/signup')` and `fetch('/api/v1/auth/signin')`.
4. All subsequent API calls include the session token in an Authorization Bearer header or a secure HttpOnly cookie.

---

## Vertical 2: Questions and Answers (Core QA)

### Problem
Questions and answers exist only in one browser localStorage. Nobody else can see or answer them.

### Database Schema

```sql
-- Migration: 0002_qa.sql

CREATE TABLE questions (
  id           SERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL,
  author_role  TEXT DEFAULT 'user',
  author_specialty TEXT DEFAULT '',
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 8 AND 140),
  body         TEXT NOT NULL CHECK (char_length(body) BETWEEN 20 AND 4000),
  category     TEXT NOT NULL CHECK (category IN (
    'relationships','life','career','education','mathematics',
    'technology','business','health','home','other'
  )),
  kind         TEXT NOT NULL CHECK (kind IN ('experience', 'knowledge')),
  is_hidden    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  edited_at    TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_questions_created ON questions(created_at DESC);
CREATE INDEX idx_questions_category ON questions(category);
CREATE INDEX idx_questions_kind ON questions(kind);
CREATE INDEX idx_questions_user ON questions(user_id);

CREATE TABLE answers (
  id           SERIAL PRIMARY KEY,
  question_id  INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL,
  author_role  TEXT DEFAULT 'user',
  author_specialty TEXT DEFAULT '',
  body         TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 4000),
  helpful      INTEGER NOT NULL DEFAULT 0 CHECK (helpful >= 0),
  is_best      BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  edited_at    TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_answers_question ON answers(question_id);
CREATE INDEX idx_answers_user ON answers(user_id);

CREATE TABLE helpful_votes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_id  INTEGER NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, answer_id)
);
```

### API Endpoints

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | /api/v1/questions | Yes | List questions. Query params: category, kind, search, page, limit. |
| POST | /api/v1/questions | Yes | Create a question. Awards +1 rep. |
| GET | /api/v1/questions/:id | Yes | Get question detail + answers (sorted: best first, then by helpful). |
| PUT | /api/v1/questions/:id | Yes | Edit own question. Sets edited_at. |
| DELETE | /api/v1/questions/:id | Yes | Delete own question. Cascade deletes answers. |
| POST | /api/v1/questions/:id/answers | Yes | Post an answer. Awards +2 rep. |
| PUT | /api/v1/answers/:id | Yes | Edit own answer. |
| POST | /api/v1/answers/:id/helpful | Yes | Mark helpful (idempotent, rejected for own answers). Awards +1 rep. |
| POST | /api/v1/answers/:id/accept | Yes | Accept as best. Only the question asker. Awards +5 rep, previous best loses -5 rep. |

### Server Validation Rules

- Title: 8 to 140 characters
- Body: 20 to 4000 characters (questions), 10 to 4000 (answers)
- Category: Must be one of the 10 valid IDs
- Kind: Must be 'experience' or 'knowledge'
- Vote: Cannot vote on own answer; unique constraint prevents double-voting
- Accept: Only the question author can accept; only one best per question
- Delete: Only owner; cascades answers via FK

### Reputation Engine (Server-Side)

| Action | Points |
| :--- | :--- |
| Question posted | author +1 |
| Answer posted | author +2 |
| Answer marked helpful | answer_author +1 |
| Answer accepted as best | answer_author +5 (skipped if same as question_author) |
| Best replaced | old_best_author -5 (skipped if same as question_author) |

Floor: 0 (never goes negative). Seed users (id starts with 'seed:'): never modified.

### Pagination Strategy
- Cursor-based pagination using `created_at` + `id` as compound cursor.
- Default page size: 20 questions.
- Search uses ts_vector full-text search on title and body.

---

## Vertical 3: Anonymous Connect (Real-Time Peer Chat)

### Problem
The current Connect is fake. One user, one bot reply. Real Connect needs two strangers matched in real-time.

### How It Works (Revised Design)

1. **User opens Connect tab** and enters a topic or picks a common situation.
2. **Matchmaking** — the server looks for another user waiting on a similar topic. If found, pair them. If not, place in waiting queue (max wait: 5 minutes).
3. **Paired** — a room is created with a 1-hour TTL. Both users get anonymous aliases (Companion #XXX).
4. **Chat** — real-time messages via WebSocket. All messages are ephemeral (in Redis only, never persisted to Postgres).
5. **Timer expires** — room is destroyed. Both users see the session ended screen with options to start a new free chat or subscribe.

### Database Schema

```sql
-- Migration: 0003_connect.sql

-- No persistent table for rooms or messages.
-- Rooms live in Redis only (ephemeral by design).

-- Waiting queue analytics (optional, for product metrics):
CREATE TABLE connect_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  topic       TEXT NOT NULL,
  started_at  TIMESTAMPTZ DEFAULT now(),
  ended_at    TIMESTAMPTZ DEFAULT NULL,
  was_matched BOOLEAN DEFAULT FALSE,
  duration_seconds INTEGER DEFAULT NULL
);
```

### Redis Data Structures

- **Waiting queue** (sorted set, score = timestamp): `connect:waiting` stores user_id:topic entries
- **Active room** (hash, TTL = 3600 seconds): `connect:room:<room_id>` stores user_a, user_b, aliases, topic, timestamps
- **Messages** (list, same TTL as room): `connect:messages:<room_id>` stores sender_alias, content, timestamp
- **User to Room mapping** (for reconnection): `connect:user:<user_id>` maps to room_id with TTL 3600

### WebSocket Events

| Direction | Event | Payload |
| :--- | :--- | :--- |
| Client to Server | connect:join | { topic: string } |
| Server to Client | connect:waiting | { position: number, estimatedWait: string } |
| Server to Client | connect:matched | { roomId, peerAlias, topic, expiresAt } |
| Client to Server | connect:message | { roomId, content } |
| Server to Client | connect:message | { senderAlias, content, timestamp } |
| Server to Client | connect:typing | { senderAlias } |
| Client to Server | connect:leave | { roomId } |
| Server to Client | connect:expired | { roomId, message } |
| Server to Client | connect:peer_left | { roomId } |

### Timer Logic
- **The 1-hour timer starts when both users are matched** (not when User A joins the queue).
- A background job checks Redis every 30 seconds for expired rooms and emits connect:expired to both connected sockets.
- After expiration, the client shows "Start a New Free Chat" and "Subscribe for Extended Sessions" buttons.

### Safety
- Messages are filtered through the same CRISIS regex. Crisis messages trigger the crisis reply and are not forwarded to the peer.
- A basic profanity filter flags but does not block (the community is about real stories, not sanitized language).
- Either user can "Wipe and End" at any time, which destroys the room and all messages in Redis instantly.

---

## Vertical 4: Laya AI (LLM-Powered Companion)

### Problem
The phone edition uses hardcoded responses. The production Laya needs a real LLM call with the API key secured on the server.

### Database Schema

```sql
-- Migration: 0004_laya.sql

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
```

### API Endpoints

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | /api/v1/laya/threads | Yes | List user threads (newest first). |
| POST | /api/v1/laya/threads | Yes | Create a new thread. |
| GET | /api/v1/laya/threads/:id | Yes | Get thread + messages. Rejected if thread does not belong to user. |
| POST | /api/v1/laya/threads/:id/ask | Yes | Send a message to Laya. Returns Laya response. |
| DELETE | /api/v1/laya/threads/:id | Yes | Delete thread + all messages (cascade). |

### LLM Call Flow

1. **Server Validation**: Prompt length 2 to 2000 chars. Rate limit: 20 Laya calls/user/hour. Crisis regex check: if match, return CRISIS_REPLY without calling the LLM.
2. **LLM Request**: Provider xAI (api.x.ai), Model grok-4.5, API Key XAI_API_KEY (env var, server-only), System prompt LAYA_SYSTEM (voice rules), Context last 10 messages from thread, Temp 0.6, Max tokens 500, Timeout 40s, 1 retry on HTTP 429 or 5xx.
3. **Post-processing**: Truncate response to 4000 chars. Store user message + assistant message. Update thread.updated_at. Return response to client.

### Key Security Rules
- XAI_API_KEY is a server-side environment variable. Never baked into the APK, never sent to the browser.
- Each user is rate-limited to 20 Laya calls per hour (free tier). Premium subscribers get 100/hour.
- Thread ownership is enforced: WHERE user_id = context.userId on every read/write.

---

## Vertical 5: Reporting and Moderation

### Problem
Reports are stored in localStorage and never reviewed. No content can be hidden. No users can be sanctioned.

### Database Schema

```sql
-- Migration: 0005_moderation.sql

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
  expires_at TIMESTAMPTZ DEFAULT NULL,  -- NULL = permanent
  issued_by  UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sanctions_user ON user_sanctions(user_id, created_at DESC);
```

### API Endpoints

| Method | Path | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| POST | /api/v1/reports | Yes | Any | Submit a report. |
| GET | /api/v1/admin/reports | Yes | Admin | List pending reports with pagination. |
| PUT | /api/v1/admin/reports/:id | Yes | Admin | Review: dismiss, hide content, or sanction user. |
| POST | /api/v1/admin/sanctions | Yes | Admin | Issue warning/mute/suspend/ban. |
| GET | /api/v1/admin/sanctions/:userId | Yes | Admin | View sanction history for a user. |

### Auto-Moderation Rules
- **3 reports on the same content** auto-hides it (set is_hidden = true) pending admin review.
- **Content from a muted user** is auto-held for review before appearing in the feed.
- **Banned users** have all API calls return 403 Forbidden.
- **Spam detection** if a user posts more than 5 questions in 10 minutes, auto-mute for 1 hour.

---

## Vertical 6: Subscriptions and Monetization

### Problem
The product has no revenue model. Connect sessions expire after 1 hour with no upsell. Experts have no incentive structure.

### Tier Design

| Feature | Free | Premium (Rs 149/mo) | Expert Pro (Rs 299/mo) |
| :--- | :--- | :--- | :--- |
| Ask / Answer questions | Unlimited | Unlimited | Unlimited |
| Anonymous Connect | 1-hour sessions | 3-hour sessions | Unlimited duration |
| Connect sessions/day | 3 | 10 | Unlimited |
| Laya AI calls/hour | 20 | 100 | 100 |
| Priority expert matching | No | Yes | Yes |
| Verified Expert badge | No | No | Yes (with credential check) |
| Direct expert booking | No | Yes | Yes (appear in directory) |
| Saved chat highlights | No | Yes | Yes |
| Ad-free experience | No | Yes | Yes |

### Database Schema

```sql
-- Migration: 0006_subscriptions.sql

CREATE TABLE plans (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  price_inr    INTEGER NOT NULL DEFAULT 0,
  price_usd    INTEGER NOT NULL DEFAULT 0,
  interval     TEXT DEFAULT 'month',
  features     JSONB DEFAULT '{}'
);

INSERT INTO plans VALUES
  ('free', 'Free', 0, 0, NULL,
   '{"connect_duration_min":60,"connect_daily":3,"laya_hourly":20}'),
  ('premium', 'Premium', 149, 2, 'month',
   '{"connect_duration_min":180,"connect_daily":10,"laya_hourly":100}'),
  ('expert_pro', 'Expert Pro', 299, 4, 'month',
   '{"connect_duration_min":null,"connect_daily":null,"laya_hourly":100}');

CREATE TABLE subscriptions (
  id               SERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES users(id),
  plan_id          TEXT NOT NULL REFERENCES plans(id),
  status           TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  payment_provider TEXT DEFAULT 'razorpay',
  provider_sub_id  TEXT DEFAULT NULL,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end   TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subs_user ON subscriptions(user_id, status);

CREATE TABLE payments (
  id               SERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES users(id),
  subscription_id  INTEGER REFERENCES subscriptions(id),
  amount_inr       INTEGER NOT NULL,
  currency         TEXT DEFAULT 'INR',
  provider         TEXT DEFAULT 'razorpay',
  provider_payment_id TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

### API Endpoints

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | /api/v1/plans | Yes | List available plans with pricing. |
| POST | /api/v1/subscriptions/checkout | Yes | Create Razorpay order. Return checkout URL/token. |
| POST | /api/v1/subscriptions/webhook | No* | Razorpay webhook for payment confirmation. (*Verified by signature.) |
| GET | /api/v1/subscriptions/current | Yes | Get user current plan + features. |
| POST | /api/v1/subscriptions/cancel | Yes | Cancel at end of billing period. |

### Connect Session Expiry Flow

When a free-tier user 1-hour Connect session expires, the client shows:
- "Start a New Free Chat (X remaining today)" button
- "Upgrade to Premium - Rs 149/month" with benefits listed (3-hour sessions, 10 chats/day, priority expert matching)

---

## Vertical 7: Notifications and Engagement

### Problem
Users post a question and have no way to know when someone answers.

### Database Schema

```sql
-- Migration: 0007_notifications.sql

CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
    'new_answer', 'answer_accepted', 'answer_helpful',
    'connect_match', 'report_resolved', 'system'
  )),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB DEFAULT '{}',
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notif_user ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE push_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform   TEXT NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
  token      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Notification Triggers

| Event | Recipient | Notification |
| :--- | :--- | :--- |
| New answer posted | Question author | "Ama answered your question about heartbreak" |
| Answer accepted as best | Answer author | "Your answer was accepted as the best!" |
| Answer marked helpful | Answer author | "Someone found your answer helpful (+1)" |
| Connect match found | Both users | "A companion is ready to chat about {topic}" |
| Report reviewed | Reporter | "Your report has been reviewed" |

### Delivery Channels
1. **In-app** — unread badge on the notification bell icon.
2. **Push** — Firebase Cloud Messaging for Android (via APK), Web Push for browsers.
3. **Email** — daily digest of unread notifications (opt-in).

---

## Vertical 8: Search and Discovery

### Database Additions

```sql
-- Migration: 0008_search.sql

ALTER TABLE questions ADD COLUMN search_vector tsvector;
CREATE INDEX idx_questions_search ON questions USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_question_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A')
    || setweight(to_tsvector('english', COALESCE(NEW.body, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_question_search
BEFORE INSERT OR UPDATE OF title, body ON questions
FOR EACH ROW EXECUTE FUNCTION update_question_search_vector();

ALTER TABLE questions ADD COLUMN trending_score FLOAT DEFAULT 0;
CREATE INDEX idx_questions_trending ON questions(trending_score DESC);
```

### Trending Algorithm

```
trending_score = (answer_count * 3 + total_helpful * 2 + view_count)
                 / (hours_since_posted + 2) ^ 1.5
```

Recalculated every 15 minutes by a background job.

### Search API

```
GET /api/v1/questions?search=first+interview&sort=relevance
Uses ts_rank() with the search_vector for ordering
```

---

## Deployment and Infrastructure Plan

### Recommended Free/Low-Cost Stack

| Component | Service | Cost |
| :--- | :--- | :--- |
| API Server | Railway / Render (Node.js) | Free tier to $5/mo |
| PostgreSQL | Neon / Supabase | Free tier (500 MB) |
| Redis | Upstash | Free tier (10K commands/day) |
| Static Frontend | Vercel (already live) | Free |
| WebSocket | Same server (Socket.io) | Included |
| LLM API | xAI (Grok) | Pay-per-use |
| Payments | Razorpay | 2% per transaction |
| Email | Resend | Free tier (100/day) |
| Push | Firebase Cloud Messaging | Free |
| Domain | telitall.com / telitall.in | ~$10/year |

### Environment Variables (Server)

```
DATABASE_URL=postgresql://user:pass@host:5432/telitall
REDIS_URL=redis://default:pass@host:6379
XAI_API_KEY=xai-xxxx
SESSION_SECRET=<random-256-bit-hex>
RAZORPAY_KEY_ID=rzp_xxxx
RAZORPAY_KEY_SECRET=<secret>
RAZORPAY_WEBHOOK_SECRET=<webhook-secret>
RESEND_API_KEY=re_xxxx
FCM_SERVER_KEY=<firebase-key>
FRONTEND_URL=https://telitall.vercel.app
NODE_ENV=production
```

---

## Implementation Priority and Timeline

```mermaid
gantt
    title TeliTall Backend Implementation Roadmap
    dateFormat YYYY-MM-DD
    axisFormat %b %d

    section Phase 1 Foundation
    V1 Auth and Accounts         :p1a, 2026-10-01, 10d
    V2 Questions and Answers     :p1b, after p1a, 10d
    Migrate frontend to API      :p1c, after p1b, 7d

    section Phase 2 Differentiation
    V3 Anonymous Connect WS      :p2a, after p1c, 14d
    V4 Laya AI live LLM          :p2b, after p1c, 7d
    V5 Reporting Moderation      :p2c, after p2b, 7d

    section Phase 3 Growth
    V6 Subscriptions             :p3a, after p2a, 10d
    V7 Notifications Push        :p3b, after p3a, 7d
    V8 Search Discovery          :p3c, after p3b, 5d

    section Phase 4 Scale
    Admin dashboard              :p4a, after p3c, 7d
    Analytics and metrics        :p4b, after p4a, 5d
    Load testing optimization    :p4c, after p4b, 5d
```

### Phase 1: Foundation (Weeks 1-4)
Ship a working multi-user app. Users worldwide share the same questions and answers.

### Phase 2: Differentiation (Weeks 5-8)
The features that make TeliTall unique: real anonymous peer matching and live AI companion.

### Phase 3: Growth (Weeks 9-12)
Revenue, retention, and re-engagement. Users have a reason to come back and pay.

### Phase 4: Scale (Weeks 13-15)
Admin tools, observability, and performance hardening before marketing push.

---

## File Structure (Backend Repository)

```
telitall-api/
  src/
    index.ts                    # Server entrypoint (Express/Hono)
    config/
      env.ts                    # Environment variable validation
      database.ts               # PostgreSQL pool (pg or postgres.js)
      redis.ts                  # Redis client (ioredis / upstash)
    middleware/
      auth.ts                   # Session verification middleware
      rate-limit.ts             # Per-endpoint rate limiting
      validate.ts               # Request body validation (zod)
      error-handler.ts          # Centralized error formatting
    services/
      auth.service.ts           # Signup, signin, sessions, password reset
      question.service.ts       # CRUD + search + pagination
      answer.service.ts         # CRUD + voting + accepting
      reputation.service.ts     # Point calculation engine
      connect.service.ts        # Matchmaking, room lifecycle
      laya.service.ts           # LLM orchestration, crisis check
      report.service.ts         # Report submission + admin review
      subscription.service.ts   # Plan management, Razorpay integration
      notification.service.ts   # In-app + push + email dispatch
    routes/
      auth.routes.ts
      question.routes.ts
      answer.routes.ts
      connect.routes.ts
      laya.routes.ts
      report.routes.ts
      subscription.routes.ts
      notification.routes.ts
      admin.routes.ts
    ws/
      index.ts                  # WebSocket server setup
      connect.handler.ts        # Connect matchmaking + chat events
      auth.ws.ts                # WS authentication handshake
    jobs/
      purge-expired-rooms.ts    # Every 30s: clean up expired Connect rooms
      trending-score.ts         # Every 15m: recalculate trending scores
      notification-digest.ts    # Daily: send email digests
      session-cleanup.ts        # Hourly: purge expired sessions
    types/
      api.ts                    # Request/response type definitions
      db.ts                     # Database row types
  migrations/
    0001_auth.sql
    0002_qa.sql
    0003_connect.sql
    0004_laya.sql
    0005_moderation.sql
    0006_subscriptions.sql
    0007_notifications.sql
    0008_search.sql
    0009_seed.sql               # Seed questions, answers, profiles
  tests/
    auth.test.ts
    questions.test.ts
    connect.test.ts
    laya.test.ts
    integration/
      full-flow.test.ts
  package.json
  tsconfig.json
  .env.example
  Dockerfile
  docker-compose.yml            # Local dev: Postgres + Redis
  README.md
```

---

> **This plan is a blueprint, not committed code.** Each vertical can be implemented independently. The frontend (index.html) needs to be refactored from localStorage calls to fetch() API calls, but the UI structure, components, and styling remain the same.
