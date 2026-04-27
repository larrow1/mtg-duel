import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getCubeByName } from '@/lib/cube-data';
import { rankPack } from '@/lib/scoring';
import { consultPick } from '@/lib/consultant';
import { DailyCapExceeded } from '@/lib/cap';
import type { CardWithProfile, RecommendResponse } from '@/lib/types';

export const runtime = 'nodejs';

const DivergenceSchema = z.object({
  packNum: z.number().int(),
  pickNum: z.number().int(),
  recommended: z.string(),
  chosen: z.string(),
  recommendedArchetypes: z.array(z.string()),
  chosenArchetypes: z.array(z.string()),
});

const RecommendBody = z.object({
  pool: z.array(z.string()),
  seenAndPassed: z.array(z.string()),
  pack: z.array(z.string()),
  packNum: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  pickNum: z.number().int().min(1).max(15),
  useConsultant: z.boolean().optional().default(true),
  divergences: z.array(DivergenceSchema).optional().default([]),
});

function resolve(names: string[], byName: Map<string, CardWithProfile>): {
  cards: CardWithProfile[];
  missing: string[];
} {
  const cards: CardWithProfile[] = [];
  const missing: string[] = [];
  for (const n of names) {
    const c = byName.get(n);
    if (c) cards.push(c);
    else missing.push(n);
  }
  return { cards, missing };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let parsed;
  try {
    parsed = RecommendBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', detail: String(err) }, { status: 400 });
  }

  const byName = await getCubeByName();
  const pool = resolve(parsed.pool, byName);
  const seen = resolve(parsed.seenAndPassed, byName);
  const pack = resolve(parsed.pack, byName);

  if (pack.cards.length === 0) {
    return NextResponse.json({ error: 'Pack is empty or no cards resolved.', missing: pack.missing }, { status: 400 });
  }

  const { ranked, signals } = rankPack(
    pack.cards,
    pool.cards,
    seen.cards,
    parsed.packNum,
    parsed.pickNum,
    parsed.divergences,
  );

  let consultant: RecommendResponse['consultant'] = null;
  let capError: { message: string; spent: number; cap: number } | null = null;
  if (parsed.useConsultant && process.env.ANTHROPIC_API_KEY) {
    try {
      const top = ranked.slice(0, 5);
      const candidates = top.map((rec) => ({
        recommendation: rec,
        card: byName.get(rec.cardName)!,
      }));
      consultant = await consultPick({
        userId,
        candidates,
        pool: pool.cards,
        signals,
        packNum: parsed.packNum,
        pickNum: parsed.pickNum,
        divergences: parsed.divergences,
      });
    } catch (err) {
      if (err instanceof DailyCapExceeded) {
        capError = { message: err.message, spent: err.spent, cap: err.cap };
      } else {
        console.error('Consultant failed:', err);
      }
      // Non-fatal — fall back to engine ranking; UI shows the cap error if present
    }
  }

  const response: RecommendResponse = { ranked, consultant, signals };
  return NextResponse.json({
    ...response,
    capError,
    missing: {
      pool: pool.missing,
      seenAndPassed: seen.missing,
      pack: pack.missing,
    },
  });
}
