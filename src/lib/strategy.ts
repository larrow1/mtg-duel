import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { CardWithProfile } from './types';
import type { BuiltDeck } from './deckbuilder';
import { ARCHETYPES, ARCHETYPE_BY_ID } from './archetypes';
import { callClaudeTracked } from './claude-tracked';

const MODEL = process.env.STRATEGY_MODEL || 'claude-opus-4-7';

export interface StrategyOverview {
  archetype: string;
  gameplan: string;
  winConditions: string[];
  curveNotes: string;
  watchOuts: string[];
  mulliganGuidance: string;
  keyCards: string[];
}

const SYSTEM_PROMPT = `You are an expert MTGO Vintage Cube coach. The drafter has finished a draft and built a 40-card deck. Your job is to give them a focused strategy briefing they can actually use mid-game.

Be concrete and specific to THIS deck — not generic Magic advice. Reference card names by name.

Output a structured strategy with:
- archetype: short label for what this deck is (e.g., "UR Tempo with Sneak finish", "Reanimator", "Boros Aggro").
- gameplan: 1-2 sentences. How does this deck win? What's the rhythm — race, stabilize, combo, etc?
- winConditions: 2-4 specific cards or card combos that close games.
- curveNotes: 1 sentence on the curve. Are there too many top-end cards? Missing 2-drops? Dependency on hitting land drops?
- watchOuts: 2-4 things that beat this deck — specific card types, opposing archetypes, or board states.
- mulliganGuidance: 1-2 sentences. What hands keep, what hands ship?
- keyCards: 3-6 names of the most important cards in the deck.

Archetype catalog you can reference (use ID names verbatim if the deck fits one):
${ARCHETYPES.map((a) => `- ${a.id}: ${a.name}`).join('\n')}

Always call submit_strategy. Keep each field tight.`;

const STRATEGY_TOOL: Anthropic.Tool = {
  name: 'submit_strategy',
  description: 'Submit a strategy overview for the drafter\'s 40-card deck.',
  input_schema: {
    type: 'object',
    properties: {
      archetype: { type: 'string' },
      gameplan: { type: 'string' },
      winConditions: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
      curveNotes: { type: 'string' },
      watchOuts: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
      mulliganGuidance: { type: 'string' },
      keyCards: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
    },
    required: [
      'archetype',
      'gameplan',
      'winConditions',
      'curveNotes',
      'watchOuts',
      'mulliganGuidance',
      'keyCards',
    ],
  },
};

function describeCard(c: CardWithProfile): string {
  const tags = c.profile.archetypes.length ? ` [${c.profile.archetypes.join(',')}]` : '';
  return `- ${c.name} (${c.manaCost ?? '0'}, ${c.typeLine})${tags}`;
}

interface StrategyArgs {
  userId: string;
  deck: BuiltDeck;
  byName: Map<string, CardWithProfile>;
}

export async function generateStrategy(args: StrategyArgs): Promise<StrategyOverview> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');

  const { userId, deck, byName } = args;
  const spellCards = deck.spells
    .map((n) => byName.get(n))
    .filter((c): c is CardWithProfile => !!c);
  const landCards = deck.nonbasicLands
    .map((n) => byName.get(n))
    .filter((c): c is CardWithProfile => !!c);

  // Group by curve for readability
  const buckets: Record<string, CardWithProfile[]> = { '0-1': [], '2': [], '3': [], '4': [], '5': [], '6+': [] };
  for (const c of spellCards) {
    if (c.cmc <= 1) buckets['0-1'].push(c);
    else if (c.cmc === 2) buckets['2'].push(c);
    else if (c.cmc === 3) buckets['3'].push(c);
    else if (c.cmc === 4) buckets['4'].push(c);
    else if (c.cmc === 5) buckets['5'].push(c);
    else buckets['6+'].push(c);
  }

  const archetypeName = ARCHETYPE_BY_ID[deck.archetype]?.name ?? deck.archetype;

  const userText = [
    `Final deck: ${deck.spells.length} spells + ${deck.nonbasicLands.length} nonbasic lands + ${deck.basicLands.reduce((s, b) => s + b.count, 0)} basics.`,
    `Primary colors: ${deck.primaryColors.join('') || 'colorless'}`,
    `Engine-tagged top archetype: ${archetypeName}`,
    `Pip distribution: ${Object.entries(deck.pips).filter(([, n]) => n > 0).map(([c, n]) => `${c}=${n}`).join(', ') || 'none'}`,
    '',
    'SPELLS BY CURVE:',
    ...Object.entries(buckets)
      .filter(([, cs]) => cs.length > 0)
      .map(([bucket, cs]) => `\n[CMC ${bucket}] (${cs.length})\n${cs.map(describeCard).join('\n')}`),
    '',
    landCards.length > 0
      ? `NONBASIC LANDS:\n${landCards.map(describeCard).join('\n')}`
      : '(no nonbasic lands)',
    '',
    `BASIC LANDS: ${deck.basicLands.map((b) => `${b.count} ${b.name}`).join(', ') || 'none'}`,
    '',
    'Give a strategy briefing for this deck. Call submit_strategy.',
  ].join('\n');

  const client = new Anthropic();
  return callClaudeTracked({
    userId,
    endpoint: 'strategy',
    call: async () => {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [{ ...STRATEGY_TOOL, cache_control: { type: 'ephemeral' } } as Anthropic.Tool],
        tool_choice: { type: 'tool', name: 'submit_strategy' },
        messages: [{ role: 'user', content: userText }],
      });
      const toolUse = resp.content.find((b) => b.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') throw new Error('Strategy: no tool_use');
      return { message: resp, result: toolUse.input as StrategyOverview };
    },
  });
}
