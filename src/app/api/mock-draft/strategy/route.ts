import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getCubeByName } from '@/lib/cube-data';
import { generateStrategy } from '@/lib/strategy';
import { DailyCapExceeded } from '@/lib/cap';
import type { BuiltDeck } from '@/lib/deckbuilder';

export const runtime = 'nodejs';

const StrategyBody = z.object({
  deck: z.any(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let parsed;
  try {
    parsed = StrategyBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', detail: String(err) }, { status: 400 });
  }
  try {
    const byName = await getCubeByName();
    const overview = await generateStrategy({
      userId: session.user.id,
      deck: parsed.deck as BuiltDeck,
      byName,
    });
    return NextResponse.json(overview);
  } catch (err) {
    if (err instanceof DailyCapExceeded) {
      return NextResponse.json({ error: err.message, spent: err.spent, cap: err.cap }, { status: 429 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
