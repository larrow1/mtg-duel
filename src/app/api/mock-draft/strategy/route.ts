import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCubeByName } from '@/lib/cube-data';
import { generateStrategy } from '@/lib/strategy';
import type { BuiltDeck } from '@/lib/deckbuilder';

export const runtime = 'nodejs';

const StrategyBody = z.object({
  deck: z.any(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = StrategyBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', detail: String(err) }, { status: 400 });
  }
  try {
    const byName = await getCubeByName();
    const overview = await generateStrategy({ deck: parsed.deck as BuiltDeck, byName });
    return NextResponse.json(overview);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
