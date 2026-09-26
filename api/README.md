# TeliTall API Server

Production-grade backend for **TeliTall** (Where You Tell, We Listen, We Connect).

Built with **Hono**, **PostgreSQL** (`postgres.js`), **Redis** (`ioredis`), **Socket.io** for real-time WebSocket communication, **bcrypt** password encryption, and **Zod** schema validation.

---

## Architecture Overview

| Vertical | Tech Stack | Storage / Runtime |
| :--- | :--- | :--- |
| **V1 Auth & Users** | Hono + bcrypt (cost 12) + SHA-256 tokens | PostgreSQL `users`, `profiles`, `sessions` |
| **V2 Questions & Answers** | REST API + Category filtering + Cursor pagination | PostgreSQL `questions`, `answers`, `helpful_votes` |
| **V3 Anonymous Connect** | WebSocket (Socket.io) + FIFO queues | Redis (ephemeral matchmaking & active rooms) |
| **V4 Laya AI Companion** | Crisis keyword detection + xAI Grok API | PostgreSQL `laya_threads`, `laya_messages` |
| **V5 Moderation & Reports** | Report workflows + auto-hide trigger (3+ flags) | PostgreSQL `reports` |
| **V6 Subscriptions** | Plans + Razorpay checkout & webhook verification | PostgreSQL `plans`, `subscriptions`, `payments` |
| **V7 Notifications** | In-app alerts + Push tokens | PostgreSQL `notifications`, `push_tokens` |
| **V8 Search & Discovery** | Full-text search (tsvector + GIN) + Trending score | PostgreSQL `search_vector`, GIN index, triggers |

---

## Getting Started

### 1. Requirements
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### 2. Quickstart with Docker Compose
```bash
cd api
docker-compose up -d
```
The API server will be available at `http://localhost:4000` with PostgreSQL and Redis automatically wired.

### 3. Manual Local Setup
```bash
cd api
npm install

# Copy environment variables
cp .env.example .env

# Run database migrations
npm run migrate

# Start development server with live reload
npm run dev
```

---

## Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | API listen port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `SESSION_SECRET` | Secret used for cryptographic hashes | `telitall-secret...` |
| `FRONTEND_URL` | Frontend URL for CORS | `https://telitall.vercel.app` |
| `XAI_API_KEY` | Optional xAI Grok API key for Laya AI | `""` |
| `RAZORPAY_KEY_ID` | Razorpay public key ID | `""` |
| `RAZORPAY_KEY_SECRET`| Razorpay secret key | `""` |

---

## Deployment (Zero Cost Free Tier)

1. **Database**: Spin up a free serverless PostgreSQL instance on [Neon](https://neon.tech) or [Supabase](https://supabase.com).
2. **Redis**: Spin up a free Redis instance on [Upstash](https://upstash.com).
3. **API Server**: Deploy this `api/` directory on [Railway](https://railway.app) or [Render](https://render.com). Set the environment variables in the dashboard.
4. **Deploy Command**: `npm run build && npm run migrate && npm start`.
