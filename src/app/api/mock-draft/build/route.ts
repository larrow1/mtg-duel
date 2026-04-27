import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCubeByName } from '@/lib/cube-data';
import { buildDeck } from '@/lib/deckbuilder';
import type { CardWithProfile } from '@/lib/types';

export const runtime = 'nodejs';

const BuildBody = z.object({
  pool: z.array(z.string()),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = BuildBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', detail: String(err) }, { status: 400 });
  }
  try {
    const byName = await getCubeByName();
    const cards: CardWithProfile[] = parsed.pool
      .map((n) => byName.get(n))
      .filter((c): c is CardWithProfile => !!c);
    const deck = buildDeck(cards);
    return NextResponse.json(deck);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
