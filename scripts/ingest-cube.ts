/**
 * Fetch the cube list from CubeCobra and hydrate every card via Scryfall.
 * Writes data/cube.json. Run via: npm run ingest:cube
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Card, CubeData } from '../src/lib/types';

const CUBE_ID = process.env.CUBE_ID || 'modovintage';
const CUBECOBRA_PLAINTEXT = `https://cubecobra.com/cube/download/plaintext/${CUBE_ID}`;
const SCRYFALL_COLLECTION = 'https://api.scryfall.com/cards/collection';
const BATCH_SIZE = 75;
const DELAY_MS = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchCardNames(): Promise<string[]> {
  console.log(`Fetching cube list from ${CUBECOBRA_PLAINTEXT}`);
  const res = await fetch(CUBECOBRA_PLAINTEXT);
  if (!res.ok) throw new Error(`CubeCobra returned ${res.status}`);
  const text = await res.text();
  const names = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const unique = Array.from(new Set(names));
  console.log(`  ${names.length} entries, ${unique.length} unique`);
  return unique;
}

interface ScryfallCard {
  id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  colors?: string[];
  color_identity: string[];
  type_line: string;
  oracle_text?: string;
  image_uris?: { small: string; normal: string };
  card_faces?: Array<{
    name: string;
    mana_cost?: string;
    type_line?: string;
    oracle_text?: string;
    colors?: string[];
    image_uris?: { small: string; normal: string };
  }>;
}

function toCard(sc: ScryfallCard): Card {
  const front = sc.card_faces?.[0];
  const imageSmall = sc.image_uris?.small ?? front?.image_uris?.small ?? '';
  const imageNormal = sc.image_uris?.normal ?? front?.image_uris?.normal ?? '';
  const oracleText =
    sc.oracle_text ??
    (sc.card_faces ? sc.card_faces.map((f) => `${f.name}: ${f.oracle_text ?? ''}`).join('\n//\n') : '');
  return {
    scryfallId: sc.id,
    name: sc.name,
    manaCost: sc.mana_cost ?? front?.mana_cost ?? null,
    cmc: sc.cmc,
    colors: sc.colors ?? front?.colors ?? [],
    colorIdentity: sc.color_identity,
    typeLine: sc.type_line,
    oracleText,
    imageSmall,
    imageNormal,
  };
}

async function fetchBatch(names: string[]): Promise<{ found: ScryfallCard[]; notFound: string[] }> {
  const res = await fetch(SCRYFALL_COLLECTION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ identifiers: names.map((name) => ({ name })) }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Scryfall ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: ScryfallCard[]; not_found?: Array<{ name?: string }> };
  return {
    found: json.data,
    notFound: (json.not_found ?? []).map((n) => n.name ?? '').filter(Boolean),
  };
}

async function main() {
  const names = await fetchCardNames();
  const cards: Card[] = [];
  const missing: string[] = [];

  for (let i = 0; i < names.length; i += BATCH_SIZE) {
    const batch = names.slice(i, i + BATCH_SIZE);
    process.stdout.write(`  batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(names.length / BATCH_SIZE)}\r`);
    const { found, notFound } = await fetchBatch(batch);
    for (const sc of found) cards.push(toCard(sc));
    missing.push(...notFound);
    await sleep(DELAY_MS);
  }
  process.stdout.write('\n');

  // Retry split / double-faced cards using the front face only
  const retry = missing.filter((n) => n.includes(' // ')).map((n) => n.split(' // ')[0]);
  const stillMissing = missing.filter((n) => !n.includes(' // '));
  if (retry.length > 0) {
    console.log(`Retrying ${retry.length} split cards using front-face names…`);
    const { found } = await fetchBatch(retry);
    for (const sc of found) cards.push(toCard(sc));
    const foundNames = new Set(found.map((c) => c.name.split(' // ')[0]));
    for (const r of retry) if (!foundNames.has(r)) stillMissing.push(`${r} (split)`);
  }

  if (stillMissing.length) {
    console.warn(`Missing ${stillMissing.length} cards from Scryfall:`);
    for (const m of stillMissing) console.warn(`  - ${m}`);
  }

  cards.sort((a, b) => a.name.localeCompare(b.name));

  const data: CubeData = {
    cards,
    meta: {
      cubeId: CUBE_ID,
      cubeName: 'MTGO Vintage Cube',
      fetchedAt: new Date().toISOString(),
      cardCount: cards.length,
    },
  };

  const outDir = join(process.cwd(), 'data');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, 'cube.json');
  await writeFile(outPath, JSON.stringify(data, null, 2));
  console.log(`Wrote ${cards.length} cards to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
