# mtg-duel

Cube draft assistant for the MTGO Vintage Cube. Hosted on Vercel, gated by waitlist + invite tokens, with per-user Claude API spend caps.

## How it works

1. **Cube data** — pulled from CubeCobra and hydrated with Scryfall, committed to `data/cube.json`.
2. **Card profiles** — for each card, an archetype tag set + signpost flag + synergy partners + power tier, generated via Claude API and committed to `data/profiles.json`.
3. **Scoring engine** — heuristic ranker combining power, pool synergy, archetype openness signals, speculation/flexibility, and color discipline. Programmatic detection of fetches/duals/fast-mana so universal staples beat narrow signposts at P1P1.
4. **Claude consultant (Opus 4.7)** — re-ranks the engine's top 5 with full context. Cap-aware and per-user logged.
5. **Mock draft mode** — 8-player pod with bot opponents (engine-driven), auto-built 40-card deck, Claude-generated strategy briefing.
6. **Auth + tracking** — invite-only signup → admin approves → one-time token → user activates with chosen password. Each Claude call is recorded with token counts and cost. Daily USD cap per user (default $5).

## Local dev setup

### Prereqs
- Node 20+
- A Postgres database — recommend [Neon](https://neon.tech) (free tier)
- An Anthropic API key

### Steps

```bash
# 1. Clone and install
npm install

# 2. Copy env, fill in values
cp .env.local.example .env.local
# Set: ANTHROPIC_API_KEY, DATABASE_URL, DATABASE_URL_UNPOOLED, AUTH_SECRET,
#      ADMIN_EMAIL, ADMIN_PASSWORD

# 3. Run migrations
npm run db:migrate

# 4. Seed the bootstrap admin (you)
npm run seed:admin

# 5. Fetch the cube + generate profiles (one-time, ~5 min, ~$0.50)
npm run ingest:cube
npm run ingest:profiles

# 6. Run dev server
npm run dev
```

Sign in at [http://localhost:3000/login](http://localhost:3000/login) with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`. The admin link in the header takes you to `/admin` (user management) and `/admin/usage` (per-user spend).

## Deploying to Vercel

### One-time Vercel setup

1. Push this repo to GitHub.
2. On [vercel.com](https://vercel.com), **Import Project** from your GitHub repo. Vercel auto-detects Next.js — accept defaults; the included [vercel.json](vercel.json) sets the build command to `npm run build:vercel` (which runs `prisma migrate deploy` before `next build`).
3. Set **Environment Variables** on the Vercel project:
   | Name | Value |
   | --- | --- |
   | `ANTHROPIC_API_KEY` | Your Anthropic key |
   | `DATABASE_URL` | Neon **pooled** URL (`...?sslmode=require`) |
   | `DATABASE_URL_UNPOOLED` | Neon **direct/unpooled** URL |
   | `AUTH_SECRET` | Random 32-byte string (`openssl rand -base64 32`) |
   | `AUTH_URL` | Your deployed origin, e.g. `https://mtg-duel.vercel.app` |
   | `CUBE_ID` | (optional) `modovintage` by default |
4. **Deploy.** Migrations run automatically on each deploy via the build command.
5. **Bootstrap your admin user.** Locally with the production `DATABASE_URL` in `.env.local`, run `npm run seed:admin`. (Or just sign up via the deployed app, then connect to Neon and flip `isAdmin=true` on your row once.)

### After deploy

- `/signup` — public; users join the waitlist
- `/admin` — admin-only; approve waitlist users, see active users, set per-user `dailyUsdCap`, disable accounts
- `/admin/usage` — admin-only; per-user spend (today + 30d) and recent calls
- `/redeem?email=...&token=...` — users land here after admin shares an invite token

### Approving a new user

1. They submit `/signup`.
2. You see them on `/admin` under WAITLIST.
3. Click **Approve** — a token is shown ONCE. Copy the redeem URL or token.
4. Send it to them via your channel of choice. They redeem at `/redeem`, set their password, and are auto-signed-in.

Tokens expire after 7 days. Re-issue from the INVITED tab if they don't redeem in time.

## Project layout

```
data/                  generated cube.json + profiles.json (committed)
prisma/schema.prisma   User + InviteToken + ClaudeUsage tables
scripts/               one-shot data + seed scripts
src/app/               Next.js App Router (pages + API routes)
src/auth.ts            Auth.js v5 config (Credentials, JWT sessions)
src/middleware.ts      Auth gate for all non-public routes
src/lib/               types, scoring, consultant, strategy, db, cap, cost, claude-tracked
src/components/        UI
```

## Phasing

- [x] Phase 1 — manual + mock draft, scoring engine, Claude consultant
- [x] Phase 2a — auth (waitlist + invite tokens), per-user usage tracking, daily cap
- [ ] Phase 2b — Vercel deploy + custom domain
- [ ] Phase 3 — pack screenshot → vision → cards
- [ ] Phase 4 — final 40-card manual deck editor + sideboard
- [ ] Phase 5 — MTGO overlay / OCR
