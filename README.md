# mtg-duel

Cube draft assistant for the MTGO Vintage Cube. Manual pack entry now; pack screenshots and MTGO overlay later.

## How it works

1. **Cube data** — pulled from CubeCobra and hydrated with Scryfall, then committed to `data/cube.json`.
2. **Card profiles** — for each card, an archetype tag set + signpost flag + synergy partners + power tier, generated via Claude API and committed to `data/profiles.json`.
3. **Scoring engine** — ranks picks from pool synergy, archetype openness signals (what's been passed), and raw power.
4. **Claude consultant** — for the top candidates, reasons over pool + pack + signal context and returns a final pick with a short rationale.

## Setup

```bash
npm install
cp .env.local.example .env.local
# add ANTHROPIC_API_KEY to .env.local

npm run ingest:cube      # fetch cube list (no API key needed)
npm run ingest:profiles  # bootstrap archetype tags via Claude (one-time)

npm run dev
```

Then open http://localhost:3000.

## Project layout

```
data/                  generated; cube.json + profiles.json
scripts/               one-shot data scripts
src/app/               Next.js routes
src/lib/               types, scoring, consultant
src/components/        UI
```

## Phasing

- [x] Phase 1 — manual pack entry, scoring engine, Claude consultant
- [ ] Phase 2 — pack screenshot → vision → cards
- [ ] Phase 3 — final 40-card deckbuilder + manabase
- [ ] Phase 4 — MTGO overlay / OCR
