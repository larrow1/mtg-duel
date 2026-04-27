import { NextResponse } from 'next/server';
import { getCube, getCubeMeta } from '@/lib/cube-data';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const [cube, meta] = await Promise.all([getCube(), getCubeMeta()]);
    // Slim payload for client-side typeahead, image lookup, and signpost lookups.
    const slim = cube.map((c) => ({
      name: c.name,
      manaCost: c.manaCost,
      typeLine: c.typeLine,
      colorIdentity: c.colorIdentity,
      imageSmall: c.imageSmall,
      imageNormal: c.imageNormal,
      powerTier: c.profile.powerTier,
      archetypes: c.profile.archetypes,
      isSignpost: c.profile.isSignpost,
      signpostFor: c.profile.signpostFor,
    }));
    // Inverse map: archetypeId -> [card names that signpost it]
    const archetypeSignposts: Record<string, string[]> = {};
    for (const c of cube) {
      if (!c.profile.isSignpost) continue;
      for (const aid of c.profile.signpostFor) {
        (archetypeSignposts[aid] ??= []).push(c.name);
      }
    }
    return NextResponse.json({ cards: slim, meta, archetypeSignposts });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
