import type { CardWithProfile } from './types';

export interface BuiltDeck {
  primaryColors: string[];
  archetype: string;
  spells: string[];
  nonbasicLands: string[];
  basicLands: Array<{ name: string; count: number }>;
  benched: string[];
  curve: Record<string, number>;
  pips: Record<string, number>;
}

const POWER_BASE: Record<string, number> = { S: 100, A: 70, B: 45, C: 25, D: 10 };
const BASIC_NAMES: Record<string, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
};
const TARGET_LANDS = 17;
const TARGET_SPELLS = 23;

function pickPrimaryColors(pool: CardWithProfile[]): string[] {
  const counts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const c of pool) for (const ci of c.colorIdentity) counts[ci] = (counts[ci] ?? 0) + 1;
  const sorted = (Object.entries(counts) as [string, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return [];
  let primary: string[] = [sorted[0][0]];
  if (sorted.length >= 2 && sorted[1][1] >= sorted[0][1] * 0.4) primary.push(sorted[1][0]);
  if (sorted.length >= 3 && sorted[2][1] >= sorted[1][1] * 0.6) primary.push(sorted[2][0]);
  return primary;
}

function isLand(card: CardWithProfile): boolean {
  return card.typeLine.toLowerCase().includes('land');
}

function isPlayableInColors(card: CardWithProfile, colors: string[]): boolean {
  if (card.colorIdentity.length === 0) return true;
  return card.colorIdentity.every((c) => colors.includes(c));
}

function pipsFromManaCost(manaCost: string | null): Record<string, number> {
  const out: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  if (!manaCost) return out;
  const symbols = manaCost.match(/\{([^}]+)\}/g) ?? [];
  for (const s of symbols) {
    const inner = s.slice(1, -1);
    for (const ch of 'WUBRG') if (inner.includes(ch)) out[ch]++;
  }
  return out;
}

function deckScore(card: CardWithProfile, deckOthers: CardWithProfile[]): number {
  let s = POWER_BASE[card.profile.powerTier] ?? POWER_BASE.B;
  for (const o of deckOthers) {
    if (
      card.profile.synergyPartners.includes(o.name) ||
      o.profile.synergyPartners.includes(card.name)
    ) {
      s += 10;
    }
    const shared = card.profile.archetypes.filter((a) => o.profile.archetypes.includes(a)).length;
    s += shared * 2;
  }
  return s;
}

function pickSpells(spells: CardWithProfile[], target: number): CardWithProfile[] {
  // Greedy: at each step pick the spell with highest deckScore against the running deck.
  const pool = [...spells];
  const chosen: CardWithProfile[] = [];
  while (chosen.length < target && pool.length > 0) {
    pool.sort((a, b) => deckScore(b, chosen) - deckScore(a, chosen));
    chosen.push(pool.shift()!);
  }
  return chosen;
}

export function buildDeck(pool: CardWithProfile[]): BuiltDeck {
  const primary = pickPrimaryColors(pool);
  const playable = pool.filter((c) => isPlayableInColors(c, primary));

  const nonbasicLands = playable.filter(isLand);
  const spellsPool = playable.filter((c) => !isLand(c));

  const chosenSpells = pickSpells(spellsPool, TARGET_SPELLS);
  const chosenSet = new Set(chosenSpells.map((c) => c.name));

  // Lands: keep up to TARGET_LANDS - 5 nonbasics so we always have some basics for color flex
  const maxNonbasics = Math.min(nonbasicLands.length, TARGET_LANDS - 4);
  const sortedNonbasics = [...nonbasicLands].sort(
    (a, b) =>
      (POWER_BASE[b.profile.powerTier] ?? 0) - (POWER_BASE[a.profile.powerTier] ?? 0),
  );
  const chosenNonbasics = sortedNonbasics.slice(0, maxNonbasics);
  const chosenNonbasicSet = new Set(chosenNonbasics.map((c) => c.name));

  // Pip counts from chosen spells, used to allocate basics
  const pips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const c of chosenSpells) {
    const p = pipsFromManaCost(c.manaCost);
    for (const k of Object.keys(pips)) pips[k] += p[k];
  }

  const basicSlots = Math.max(0, TARGET_LANDS - chosenNonbasics.length);
  const colorsForBasics = primary.length > 0 ? primary : ['W'];
  const totalPips = colorsForBasics.reduce((s, c) => s + (pips[c] ?? 0), 0);
  const basicLands: Array<{ name: string; count: number }> = colorsForBasics.map((c) => ({
    name: BASIC_NAMES[c] ?? 'Wastes',
    count:
      totalPips > 0 ? Math.round(basicSlots * ((pips[c] ?? 0) / totalPips)) : 0,
  }));
  // Rounding fix
  let sum = basicLands.reduce((s, b) => s + b.count, 0);
  if (basicSlots > 0 && basicLands.length > 0) {
    while (sum < basicSlots) {
      basicLands.sort((a, b) => b.count - a.count)[0].count++;
      sum++;
    }
    while (sum > basicSlots) {
      basicLands.sort((a, b) => b.count - a.count)[0].count--;
      sum--;
    }
  }
  const filteredBasics = basicLands.filter((b) => b.count > 0);

  const curve: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6+': 0 };
  for (const c of chosenSpells) {
    if (c.cmc <= 1) curve['1']++;
    else if (c.cmc === 2) curve['2']++;
    else if (c.cmc === 3) curve['3']++;
    else if (c.cmc === 4) curve['4']++;
    else if (c.cmc === 5) curve['5']++;
    else curve['6+']++;
  }

  const archCounts: Record<string, number> = {};
  for (const c of chosenSpells) {
    for (const a of c.profile.archetypes) archCounts[a] = (archCounts[a] ?? 0) + 1;
  }
  const archetype =
    Object.entries(archCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unclassified';

  const benched = pool
    .filter((c) => !chosenSet.has(c.name) && !chosenNonbasicSet.has(c.name))
    .map((c) => c.name);

  return {
    primaryColors: primary,
    archetype,
    spells: chosenSpells.map((c) => c.name),
    nonbasicLands: chosenNonbasics.map((c) => c.name),
    basicLands: filteredBasics,
    benched,
    curve,
    pips,
  };
}
