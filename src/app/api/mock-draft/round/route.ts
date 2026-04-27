import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCubeByName } from '@/lib/cube-data';
import { pickAndAdvance, type MockDraftState } from '@/lib/mock-draft';

export const runtime = 'nodejs';

const RoundBody = z.object({
  state: z.any(),
  userPick: z.string(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = RoundBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', detail: String(err) }, { status: 400 });
  }
  try {
    const byName = await getCubeByName();
    const next = pickAndAdvance(parsed.state as MockDraftState, parsed.userPick, byName);
    return NextResponse.json(next);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
