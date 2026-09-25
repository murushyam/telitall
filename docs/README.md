# TeliTall — Integrated Product & Technical Specification

**Wordmark:** **TELI** (Blue `#1b5fd1`) **TALL** (Green `#0e9f6e`)  
**Tagline:** Ask a person, or ask Laya.  
**Footer Promise:** Ask · Learn · Share · Grow  

TeliTall is a community-driven Q&A platform for questions that are better answered by a person who has lived them, paired with an AI companion (**Laya**) for users seeking immediate, clear, non-judgmental explanations.

---

## Table of Contents

1. [Product Overview & Intent](#1-product-overview--intent)
2. [Core Features & UX Design](#2-core-features--ux-design)
   - [Two Ways to Ask](#two-ways-to-ask)
   - [Question Types & Categories](#question-types--categories)
   - [Reputation & Point System](#reputation--point-system)
3. [Laya AI Companion & Safety Architecture](#3-laya-ai-companion--safety-architecture)
   - [Voice & Tone Rules](#voice--tone-rules)
   - [Safety & Crisis Protocols](#safety--crisis-protocols)
4. [Web Application Technical Architecture](#4-web-application-technical-architecture)
   - [Technology Stack](#technology-stack)
   - [Route Index](#route-index)
   - [Database Schema & Data Model](#database-schema--data-model)
   - [Authentication & Server-Side Rules](#authentication--server-side-rules)
5. [Android Phone Edition (TeliTall.apk)](#5-android-phone-edition-telitallapk)
   - [Architecture & Local Persistence](#architecture--local-persistence)
   - [On-Device Laya Companion](#on-device-laya-companion)
   - [Build & Sideloading Instructions](#build--sideloading-instructions)
6. [Design System & Aesthetics](#6-design-system--aesthetics)
7. [Detailed Documentation Index](#7-detailed-documentation-index)

---

## 1. Product Overview & Intent

Advice platforms frequently flatten lived experiences into generic lists of tips or bury human connection under endless, unmoderated comment threads. Search engines yield generic paragraphs, while traditional forums produce sprawling, inconclusive threads. Crucially, neither clearly signals whether an answer reflects a personal story or a factual explanation.

TeliTall solves this by explicitly distinguishing between **Lived Experience** questions (stories from real lives) and **Knowledge** questions (clear conceptual explanations) right on the question card.

### Target Audience
- **Lived Experience Seekers:** Individuals encountering personal milestones or dilemmas—a first heartbreak, starting a job with little experience, moving to a new city alone, or managing burnout.
- **Knowledge Seekers:** Readers seeking clear, factual breakdowns of concepts (e.g., mathematical principles like completing the square or how mechanisms work) without wading through personal narratives.

---

## 2. Core Features & UX Design

### Two Ways to Ask

1. **Ask a Person (Public Community):**
   - Questions are published to all signed-in members.
   - Community members respond with personal experiences or knowledge.
   - The asker can designate **one best answer**.
   - Community members can mark answers as **helpful** (one vote per member per answer).
2. **Ask Laya (Private AI Companion):**
   - Private, 1-on-1 thread with Laya inside the app.
   - Laya is warm, concise, and specific. She is explicitly non-clinical and non-legal.
   - For personal/emotional topics, Laya provides thoughtful perspectives while encouraging the user to ask the community for real stories.

### Question Types & Categories

Every question enforces strict structural boundaries:
- **Kinds:** 
  - `Experience` (Green pill, `#0e9f6e`): Wants personal stories.
  - `Knowledge` (Blue pill, `#1b5fd1`): Wants clear explanations.
- **Categories:** Relationships, Life, Career, Education, Mathematics, Technology, Business, Health, Home, or Other.
- **Length Limits:** Title (8–140 characters), Body (20–4000 characters). One-word posts are rejected.
- **Answer Constraints:** Answers require 10–4000 characters.

### Reputation & Point System

Reputation measures contribution quality without turning the community into a game:

| Action | Reputation Impact |
|---|---|
| Post a Question | **+1** to Asker |
| Post an Answer | **+2** to Answerer |
| Answer Marked Helpful | **+1** to Answerer |
| Asker Accepts Answer | **+5** to Answerer (skips self-answers) |
| Accepted Answer Replaced | **−5** to previous Answerer |

*Note:* Minimum score is 0. Seed accounts do not earn or lose points on the web database.

#### Reputation Tiers & Badges
- **0–9 Points:** New voice
- **10–29 Points:** Helper
- **30–59 Points:** Trusted
- **60+ Points:** Guide

---

## 3. Laya AI Companion & Safety Architecture

### Voice & Tone Rules

Laya adheres strictly to clear personality guidelines:
- **Tone:** Warm, plain, and specific. Uses numbered steps only when explicitly requested.
- **Lived Experience Queries:** Responds like a thoughtful friend who has listened to many stories; invites the asker to consult real community members on TeliTall.
- **Knowledge Queries:** Teaches the core concept directly.
- **Conciseness:** Keeps responses under ~180 words unless requested otherwise.
- **Prompt Injection Defense:** Ignores user instructions aimed at altering core safety or system rules.

### Safety & Crisis Protocols

Prior to forwarding any user prompt to the underlying LLM, TeliTall runs a **deterministic safety scanner**:
- If a message indicates potential self-harm or suicide intent, model inference is **bypassed immediately**.
- The system returns a predefined, non-analytical emergency response directing the user to local emergency services and verified crisis helplines:
  - **iCall (India):** `9152987821`
  - **AASRA (India):** `9820466726`
- Health questions answered by community members are explicitly framed as personal experiences rather than medical advice.

---

## 4. Web Application Technical Architecture

### Technology Stack

- **Framework:** TanStack Start / Router / React 19
- **Styling:** Tailwind CSS v4 with custom design tokens in `src/styles.css`
- **Database:** PostgreSQL (production) via custom driver layer in `src/lib/db.ts`
- **Authentication:** Better Auth with session middleware (`authMiddleware`)
- **Server Execution:** Server functions in `src/lib/telitall/server.ts`
- **AI Integration:** xAI API (`grok-4.5` model via `api.x.ai/v1/chat/completions`)

### Route Index

| Route Path | File Location | Responsibility |
|---|---|---|
| `/` | `src/routes/index.tsx` | Home question feed, search, kind/category filters |
| `/ask` | `src/routes/ask.tsx` | Question creation form |
| `/q/$id` | `src/routes/q.$id.tsx` | Question thread, answers, helpful votes, accept & delete |
| `/laya` | `src/routes/laya.tsx` | Private Laya AI conversation threads |
| `/profile` | `src/routes/profile.tsx` | User profile, reputation score, personal posts |
| `/login` | `src/routes/login.tsx` | Authentication sign-in shell |
| `/api/auth/$` | `src/routes/api/auth/$.ts` | Better Auth endpoint handler |

### Database Schema & Data Model

- `profiles` (`user_id` PK, `display_name`, `reputation` default 0)
- `questions` (`id` PK, `user_id`, `author_name`, `title`, `body`, `category`, `kind`, `created_at`)
- `answers` (`id` PK, `question_id` FK cascade, `user_id`, `author_name`, `body`, `helpful` count, `is_best` boolean)
- `helpful_votes` (`user_id`, `answer_id` — composite PK ensuring unique votes)
- `laya_threads` (`id` PK, `user_id`, `title`, `created_at`, `updated_at`)
- `laya_messages` (`id` PK, `thread_id` FK cascade, `user_id`, `role`, `content`, `created_at`)

### Authentication & Server-Side Rules

- **Zero Unauthenticated Writes:** Every write operation verifies session context (`context.userId`).
- **Data Privacy:** Laya threads are filtered by `user_id = context.userId`, preventing unauthorized access.
- **Server Validation:** Title (8–140 chars), Body (20–4000 chars), Answer (10–4000 chars). Authors cannot mark their own answers helpful; only askers can mark an answer as accepted.

---

## 5. Android Phone Edition (`TeliTall.apk`)

### Architecture & Local Persistence

`TeliTall.apk` is a standalone, on-device edition (`app.telitall`) built to run independently without requiring a shared Postgres server or exposing server secret keys (`XAI_API_KEY`).

- **Container:** Android `WebView` wrapping single-page app assets embedded in `assets/www/index.html`.
- **Storage:** Uses browser `localStorage` for posts, answers, helpful votes, user profile, and Laya chats.
- **Seed Data:** Pre-populated with identical seed stories from `migrations/0002_telitall.sql`.

### On-Device Laya Companion

- Employs the identical deterministic crisis detection engine and helpline responses.
- General queries are handled by an on-device rule engine adhering to Laya's voice parameters without network dependency.

### Build & Sideloading Instructions

- **SDK Requirements:** Target SDK 34, Minimum SDK 24 (Android 7.0+).
- **Build Script:** Executable via `android/build-apk.sh` (requires `ANDROID_SDK_ROOT`).
- **Signature:** Debug-signed (`CN=TeliTall Debug`) for direct sideloading onto test devices.

---

## 6. Design System & Aesthetics

TeliTall features a tactile, readable paper aesthetic optimized for focused reading:
- **Canvas Background:** Paper `#f4f7f5`
- **Text Ink:** Deep Slate `#0b2340`
- **Experience Accent:** Emerald Green `#0e9f6e`
- **Knowledge Accent:** Cobalt Blue `#1b5fd1`
- **Soft Accent:** Mint `#e7f4ee`
- **Typography:** Google Font **Outfit**
- **Card Styling:** White cards, 24px border-radius, hairline slate borders.
- **Layout:** Mobile-first column frame (`max-w-xl`) centered across desktop and mobile viewports.

---

## 7. Detailed Documentation Index

For granular subsystem plans and design records, refer to the individual plan files:

| File Link | Description |
|---|---|
| [plans/01-product-plan.md](plans/01-product-plan.md) | Comprehensive product vision, user personas, screens, and copy guidelines |
| [plans/02-technical-plan.md](plans/02-technical-plan.md) | Web application architecture, server functions, database schema, and Laya API integration |
| [plans/03-android-package-plan.md](plans/03-android-package-plan.md) | Android WebView package specifications, local storage implementation, and APK toolchain |

---
*TeliTall — Ask · Learn · Share · Grow*
