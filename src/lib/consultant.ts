import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type {
  ArchetypeSignal,
  CardWithProfile,
  ConsultantOutput,
  Divergence,
  Recommendation,
} from './types';
import { ARCHETYPES, ARCHETYPE_BY_ID } from './archetypes';
import { callClaudeTracked } from './claude-tracked';

const MODEL = process.env.CONSULTANT_MODEL || 'claude-opus-4-7';

const SYSTEM_PROMPT = `You are an expert MTGO Vintage Cube drafter. You help a drafter pick the best card from the top candidates the scoring engine has surfaced for the current pack.

Your job each pick:
1. Read the drafter's pool, the pack candidates with their scores and archetype tags, the current pick position, and the archetype signals.
2. Choose ONE card from the candidates. You may diverge from the engine's #1 if you have a strong reason — say so explicitly.
3. Explain in 1-2 sentences WHY this pick fits, naming the archetype direction it commits to or keeps open.

============================================================
PICK PHILOSOPHY: stay open early, commit late.
============================================================

EARLY (P1P1 to ~P1P4): pick power and flexibility.
You don't yet know your colors or what's open. Take cards that work in the most decks.

P1P1 priority hierarchy (most to least takeable):
1. Power 9 / Mox / Sol Ring / Mana Crypt / Black Lotus / Time Walk / Ancestral — auto-take.
2. Original duals (Underground Sea, Tropical Island, Tundra, Volcanic Island, Bayou, Plateau, Savannah, Taiga, Badlands, Scrubland) — fix mana with zero commitment.
3. Fetch lands (Polluted Delta, Scalding Tarn, Verdant Catacombs, Misty Rainforest, Flooded Strand, Bloodstained Mire, Wooded Foothills, Windswept Heath, Arid Mesa, Marsh Flats) — fetch shocks/duals, fit any 2+ color deck.
4. Bomb planeswalkers (Jace TMS, Liliana of the Veil, Karn Liberated, Ugin, Wrenn and Six, Teferi Hero of Dominaria, Dack Fayden, Tezzeret).
5. Premium broadly-good staples (Force of Will, Wasteland, Snapcaster Mage, Mind Twist, Tinker, Demonic Tutor).
6. Premium cheap removal/answers (Lightning Bolt, Swords to Plowshares, Path to Exile, Counterspell).
7. Archetype-flexible threats (Tarmogoyf, Dark Confidant, True-Name Nemesis).
8. Bombs that are tier S but narrow (Emrakul, Griselbrand, Blightsteel, Sundering Titan) — fine if no top-tier fixing/staple is available, but their value is conditional on having enablers.
9. Narrow signposts (Sneak Attack, Show and Tell, Goblin Welder, Reanimate, Animate Dead, Splinter Twin, Recurring Nightmare) — only if categories 1–8 are unavailable.

ANTI-PATTERNS for early picks (P1P1–P1P4):
- DO NOT take a narrow signpost (Sneak Attack, Welder, Reanimate, Recurring Nightmare) over a fetch land or original/shock dual. The fetch/dual goes in any 2+ color deck; the signpost only matters if you commit to ONE archetype.
- DO NOT take a 5+ mana fatty (Emrakul, Sundering Titan) at P1P1 over fixing — without enablers it's a brick. The engine often over-rates these.
- DO NOT splash off-color cards at P1P1 just because their score is high. You haven't picked your colors yet — keep it flexible.
- DO NOT chain into a narrow archetype on a single pick. Sneak Attack at P1P1 is wishful thinking; you need 5+ supporting picks for it to matter.

If the engine ranked a narrow signpost above a fixing land at P1P1, OVERRIDE the engine. Say so in the rationale: "Engine over-weighted [signpost], but a fetch is universally better here — it goes in any deck while [signpost] needs 5+ supporting picks."

============================================================
MID DRAFT (P1P5–P3P5): read signals, settle into colors.
============================================================
- Passed signposts = that archetype is OPEN. If Sneak Attack wheels back at P1P9, the table isn't in sneak-show — take signposts now and lean in.
- By end of pack 1, lock into 2-3 colors. Don't let one off-color bomb pull you into a 4th color unless it's truly broken.
- Fetches/duals supporting your colors are still excellent. Off-color fixing loses sharply.

============================================================
LATE DRAFT (P3P5–P3P15): synergy and curve over raw power.
============================================================
- Don't take your 5th 6+ mana threat just because it's tier S. Curve gaps and role-players matter more.
- If a card doesn't go in your deck, take a sideboard piece, a hate card against the table, or pass-for-curve filler.
- A late-pack synergy piece (Welder if you're in artifacts, Looting if reanimator) is worth more than an off-archetype tier-A card.

============================================================
GENERAL
============================================================
- "Reanimator/Show targets" (Emrakul, Griselbrand, Iona, Archon of Cruelty): worth little without enablers. Without an Entomb/Reanimate/Show in your pool by P1P5, treat them as B-tier.
- Color commitment: respect the pool. By P2 you should know your colors; deviating is rare.
- Watch the divergences section — if the drafter has overridden you toward an archetype, weight that heavily; they may be reading the table better than the engine.

The full archetype catalog (use these IDs verbatim if naming a direction):
${ARCHETYPES.map((a) => `- ${a.id}: ${a.name}`).join('\n')}

Always call the submit_pick tool. Keep rationale tight (1-2 sentences max).`;

const PICK_TOOL: Anthropic.Tool = {
  name: 'submit_pick',
  description: 'Submit the chosen pick from the candidates with a short rationale.',
  input_schema: {
    type: 'object',
    properties: {
      pickName: {
        type: 'string',
        description: 'Exact card name from the candidates list.',
      },
      rationale: {
        type: 'string',
        description: '1-2 sentences explaining why this card is the pick.',
      },
      archetypeDirection: {
        type: 'string',
        enum: [...ARCHETYPES.map((a) => a.id), ''],
        description: 'Archetype ID this pick commits to (or empty if still flexible).',
      },
    },
    required: ['pickName', 'rationale', 'archetypeDirection'],
  },
};

function describeCandidate(rec: Recommendation, card: CardWithProfile): string {
  const profile = card.profile;
  return [
    `${rec.cardName} (tier ${profile.powerTier}, score ${rec.score})`,
    `  ${card.manaCost ?? ''} ${card.typeLine}`,
    `  archetypes: ${profile.archetypes.join(', ') || '(none tagged)'}`,
    profile.isSignpost ? `  SIGNPOST for: ${profile.signpostFor.join(', ')}` : '',
    `  oracle: ${card.oracleText.replace(/\n/g, ' ').slice(0, 200)}`,
    `  breakdown: pw=${rec.breakdown.power} syn=${rec.breakdown.synergy} arch=${rec.breakdown.archetypeOpenness} spec=${rec.breakdown.speculation}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function describePool(pool: CardWithProfile[]): string {
  if (pool.length === 0) return '(empty — this is your first pick)';
  return pool
    .map((c) => `- ${c.name} [${c.profile.powerTier}] (${c.profile.archetypes.join('/') || '—'})`)
    .join('\n');
}

function describeSignals(signals: ArchetypeSignal[]): string {
  const interesting = signals
    .filter((s) => s.commitment > 0 || s.openness > 0)
    .sort((a, b) => b.commitment + b.openness * 0.5 - (a.commitment + a.openness * 0.5));
  if (interesting.length === 0) return '(no archetype signals yet)';
  return interesting
    .slice(0, 8)
    .map(
      (s) =>
        `- ${ARCHETYPE_BY_ID[s.archetypeId]?.name ?? s.archetypeId}: commitment=${s.commitment.toFixed(1)}, passed-signposts=${s.openness}`,
    )
    .join('\n');
}

interface ConsultArgs {
  userId: string;
  candidates: { recommendation: Recommendation; card: CardWithProfile }[];
  pool: CardWithProfile[];
  signals: ArchetypeSignal[];
  packNum: 1 | 2 | 3;
  pickNum: number;
  divergences?: Divergence[];
}

function describeDivergences(divs: Divergence[]): string {
  if (divs.length === 0) return '(none)';
  return divs
    .slice(-5)
    .map((d) => {
      const moved = d.chosenArchetypes
        .filter((a) => !d.recommendedArchetypes.includes(a))
        .join(', ');
      const tail = moved ? ` — toward ${moved}` : '';
      return `- P${d.packNum}P${d.pickNum}: I recommended ${d.recommended}, drafter took ${d.chosen}${tail}`;
    })
    .join('\n');
}

export async function consultPick(args: ConsultArgs): Promise<ConsultantOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY missing');
  }
  const client = new Anthropic();
  const { userId, candidates, pool, signals, packNum, pickNum, divergences } = args;

  const userText = [
    `Pack ${packNum}, pick ${pickNum}.`,
    '',
    'Current pool:',
    describePool(pool),
    '',
    'Archetype signals (commitment from your pool + drafter overrides, openness from passed signposts):',
    describeSignals(signals),
    '',
    'Recent picks where the drafter overrode my recommendation (treat these as strong evidence about their direction):',
    describeDivergences(divergences ?? []),
    '',
    `Top ${candidates.length} candidates from the engine (already ranked):`,
    candidates.map((c) => describeCandidate(c.recommendation, c.card)).join('\n\n'),
    '',
    'Choose the best pick. Call submit_pick. If recent divergences make the engine ranking stale, say so in your rationale.',
  ].join('\n');

  return callClaudeTracked({
    userId,
    endpoint: 'consultant',
    call: async () => {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [{ ...PICK_TOOL, cache_control: { type: 'ephemeral' } } as Anthropic.Tool],
        tool_choice: { type: 'tool', name: 'submit_pick' },
        messages: [{ role: 'user', content: userText }],
      });
      const toolUse = resp.content.find((b) => b.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Consultant did not return a tool_use block');
      }
      const input = toolUse.input as ConsultantOutput;
      const result: ConsultantOutput = {
        pickName: input.pickName,
        rationale: input.rationale,
        archetypeDirection: input.archetypeDirection || null,
      };
      return { message: resp, result };
    },
  });
}
