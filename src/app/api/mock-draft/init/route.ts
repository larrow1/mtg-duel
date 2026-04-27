import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCube } from '@/lib/cube-data';
import { generateMockDraft } from '@/lib/mock-draft';

export const runtime = 'nodejs';

const InitBody = z.object({
  seed: z.number().int().optional(),
}).default({});

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as unknown;
  const { seed } = InitBody.parse(body ?? {});
  try {
    const cube = await getCube();
    const state = generateMockDraft(cube, { seed });
    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
