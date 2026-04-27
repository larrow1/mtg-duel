/**
 * Generate per-card archetype profiles via Claude API.
 * Reads data/cube.json, writes data/profiles.json incrementally.
 * Run via: npm run ingest:profiles
 *
 * Resumable: re-running skips cards already tagged, so a crash mid-run is fine.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type { Card, CardProfile, CubeData, ProfileData } from '../src/lib/types';
import { ARCHETYPES } from '../src/lib/archetypes';

const MODEL = process.env.PROFILE_MODEL || 'claude-sonnet-4-6';
const BATCH_SIZE = 12;
const ARCHETYPE_IDS = ARCHETYPES.map((a) => a.id);

const SYSTEM_PROMPT = `You are an expert MTGO Vintage Cube drafter tagging cards with their archetype roles.

For each card you receive, output a profile with:
- archetypes: every archetype this card actively slots into (use the IDs from the catalog below; empty if generic/colorless utility that fits everywhere — but prefer specific tags when applicable).
- isSignpost: TRUE only if seeing this card in a pack strongly tells the drafter "this archetype is open." Examples: Sneak Attack signposts sneak-show, Goblin Welder signposts artifacts, Reanimate signposts reanimator. Generic-good cards (Lightning Bolt, Swords to Plowshares) are NOT signposts.
- signpostFor: subset of archetypes the card signposts (empty if isSignpost=false).
- synergyPartners: up to 5 specific cube card names that have notable synergy with this card. Be specific — Goblin Welder pairs with Wurmcoil Engine and Mindslaver, not "artifacts in general."
- powerTier: S = bomb / format-defining (Tinker, Jace TMS, Sol Ring); A = strong staple (Lightning Bolt, Swords); B = solid role-player; C = niche/situational (only good in one archetype); D = filler.
- notes: optional, only if there's something non-obvious worth saying.

ARCHETYPE CATALOG:
${ARCHETYPES.map((a) => `- ${a.id} (${a.name}, colors: ${a.colors.join('') || 'C'}): ${a.description}`).join('\n')}

You must call the submit_profiles tool with profiles for every card in the batch, in the same order.`;

const PROFILE_TOOL: Anthropic.Tool = {
  name: 'submit_profiles',
  description: 'Submit archetype profiles for the batch of cube cards.',
  input_schema: {
    type: 'object',
    properties: {
      profiles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Exact card name as given.' },
            archetypes: {
              type: 'array',
              items: { type: 'string', enum: ARCHETYPE_IDS },
            },
            isSignpost: { type: 'boolean' },
            signpostFor: {
              type: 'array',
              items: { type: 'string', enum: ARCHETYPE_IDS },
            },
            synergyPartners: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 5,
            },
            powerTier: { type: 'string', enum: ['S', 'A', 'B', 'C', 'D'] },
            notes: { type: 'string' },
          },
          required: ['name', 'archetypes', 'isSignpost', 'signpostFor', 'synergyPartners', 'powerTier'],
        },
      },
    },
    required: ['profiles'],
  },
};

function describeCard(c: Card): string {
  return [
    `Name: ${c.name}`,
    `Mana cost: ${c.manaCost ?? '(none)'}`,
    `Type: ${c.typeLine}`,
    `Color identity: ${c.colorIdentity.join('') || 'C'}`,
    `Oracle: ${c.oracleText.replace(/\n/g, ' ')}`,
  ].join(' | ');
}

async function profileBatch(client: Anthropic, batch: Card[]): Promise<CardProfile[]> {
  const userText = `Cards to profile:\n\n${batch.map((c, i) => `[${i + 1}] ${describeCard(c)}`).join('\n\n')}`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [{ ...PROFILE_TOOL, cache_control: { type: 'ephemeral' } } as Anthropic.Tool],
    tool_choice: { type: 'tool', name: 'submit_profiles' },
    messages: [{ role: 'user', content: userText }],
  });

  const toolUse = resp.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error(`No tool_use in response: ${JSON.stringify(resp.content).slice(0, 300)}`);
  }
  const input = toolUse.input as { profiles: CardProfile[] };
  return input.profiles;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set. Add it to .env.local or your shell env.');
  }

  const cubePath = join(process.cwd(), 'data', 'cube.json');
  if (!existsSync(cubePath)) {
    throw new Error('data/cube.json not found. Run `npm run ingest:cube` first.');
  }
  const cube: CubeData = JSON.parse(await readFile(cubePath, 'utf-8'));

  const outPath = join(process.cwd(), 'data', 'profiles.json');
  let existing: Record<string, CardProfile> = {};
  if (existsSync(outPath)) {
    const prev: ProfileData = JSON.parse(await readFile(outPath, 'utf-8'));
    existing = prev.profiles;
    console.log(`Resuming: ${Object.keys(existing).length} profiles already on disk.`);
  }

  const todo = cube.cards.filter((c) => !existing[c.name]);
  console.log(`Profiling ${todo.length} of ${cube.cards.length} cards (model: ${MODEL}, batch ${BATCH_SIZE})`);

  const client = new Anthropic();
  await mkdir(join(process.cwd(), 'data'), { recursive: true });

  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);
    const idx = `${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(todo.length / BATCH_SIZE)}`;
    process.stdout.write(`  batch ${idx} (${batch.length} cards)…`);
    try {
      const profiles = await profileBatch(client, batch);
      for (const p of profiles) {
        const cleaned: CardProfile = {
          ...p,
          // sanitize: drop any archetype IDs the model invented outside the catalog
          archetypes: p.archetypes.filter((id) => ARCHETYPE_IDS.includes(id)),
          signpostFor: p.signpostFor.filter((id) => ARCHETYPE_IDS.includes(id)),
        };
        existing[cleaned.name] = cleaned;
      }
      const out: ProfileData = {
        profiles: existing,
        meta: {
          generatedAt: new Date().toISOString(),
          model: MODEL,
          cubeId: cube.meta.cubeId,
        },
      };
      await writeFile(outPath, JSON.stringify(out, null, 2));
      process.stdout.write(' ok\n');
    } catch (err) {
      process.stdout.write(' FAIL\n');
      console.error(err);
      console.error('Stopping. Re-run to resume from where it left off.');
      process.exit(1);
    }
  }

  console.log(`Done. ${Object.keys(existing).length} profiles in ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
