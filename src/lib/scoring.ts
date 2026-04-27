import type {
  ArchetypeId,
  ArchetypeSignal,
  CardWithProfile,
  Divergence,
  PowerTier,
  Recommendation,
  ScoreBreakdown,
} from './types';
import { ARCHETYPES } from './archetypes';

const DIVERGENCE_BOOST = 1.5;
const SPEC_FLEX_CAP = 8;
const FIXING_LAND_FLEX_FLOOR = 6;
const SIGNPOST_NO_SIGNAL_GUARD = 0.5;

// ---- Programmatic detection of universally-good card categories ----------
// Profile data from the AI bootstrap is uneven (e.g. Polluted Delta tagged tier A
// with empty archetypes, while Bloodstained Mire is tier S). These checks run
// against typeLine + oracleText so the engine doesn't depend on profile quality.

const BASIC_LAND_TYPES = ['plains', 'island', 'swamp', 'mountain', 'forest'];

export function isFixingLand(card: CardWithProfile): boolean {
  const t = card.typeLine.toLowerCase();
  if (!t.includes('land')) return false;
  const o = (card.oracleText ?? '').toLowerCase();
  // Fetch lands: "search your library" + names a basic land type
  if (
    o.includes('search your library') &&
    BASIC_LAND_TYPES.some((b) => o.includes(b))
  ) {
    return true;
  }
  // Original duals + shock lands: typeline carries two basic land types
  const typeMatches = BASIC_LAND_TYPES.filter((b) => t.includes(b)).length;
  if (typeMatches >= 2) return true;
  // Shocklands: pay 2 life clause
  if (o.includes('pay 2 life') && o.includes('add')) return true;
  // Generic two-color lands: "Add {X} or {Y}"
  if (/\{[wubrg]\}[^.]{0,40}or[^.]{0,40}\{[wubrg]\}/i.test(card.oracleText ?? '')) return true;
  return false;
}

export function isFastMana(card: CardWithProfile): boolean {
  if (card.cmc > 1) return false;
  const t = card.typeLine.toLowerCase();
  if (!t.includes('artifact')) return false;
  // Match "add" followed within ~40 chars by a mana symbol (any color, including
  // colorless {C}) or the word "mana". Catches Sol Ring, Mana Crypt, Moxen,
  // Black Lotus, Mana Vault, Mox Diamond, Lotus Petal, etc.
  return /\badd\b[^.]{0,40}(\{|mana)/i.test(card.oracleText ?? '');
}

export function effectivePowerTier(card: CardWithProfile): PowerTier {
  // Universal fixing should never sit below S in cube — too many decks want it.
  if (isFixingLand(card)) return 'S';
  // Fast mana (Sol Ring, Mox, Crypt, Lotus) — promote if profile under-tiered it.
  if (isFastMana(card)) {
    if (card.profile.powerTier === 'B' || card.profile.powerTier === 'C' || card.profile.powerTier === 'D') {
      return 'A';
    }
  }
  return card.profile.powerTier;
}

const POWER_BASE: Record<string, number> = { S: 100, A: 70, B: 45, C: 25, D: 10 };

const PARTNER_BONUS = 30;
const SHARED_ARCHETYPE_BONUS = 6;

interface DraftContext {
  pool: CardWithProfile[];
  seenAndPassed: CardWithProfile[];
  pickPosition: number;
  divergences?: Divergence[];
}

export function pickPosition(packNum: 1 | 2 | 3, pickNum: number): number {
  return (packNum - 1) * 15 + pickNum;
}

function progressFraction(pickPos: number): number {
  const total = 45;
  return Math.min(1, Math.max(0, (pickPos - 1) / (total - 1)));
}

function weights(pickPos: number) {
  const p = progressFraction(pickPos);
  return {
    power: 1.0 - 0.4 * p,
    synergy: 0.3 + 1.2 * p,
    archetype: 0.5 + 0.7 * p,
    speculation: 1 - p,
  };
}

export function computeArchetypeSignals(ctx: DraftContext): ArchetypeSignal[] {
  const commitment: Map<ArchetypeId, number> = new Map();
  for (const c of ctx.pool) {
    const tierWeight = POWER_BASE[c.profile.powerTier] / 100;
    for (const a of c.profile.archetypes) {
      commitment.set(a, (commitment.get(a) ?? 0) + tierWeight);
    }
  }

  // Divergence boost: when the user picked something different from our recommendation,
  // archetypes the chosen card moved them toward (relative to the rec) get extra commitment.
  // Smooths over cases where the user is read-the-table ahead of the engine.
  if (ctx.divergences) {
    for (const d of ctx.divergences) {
      const movedToward = d.chosenArchetypes.filter(
        (a) => !d.recommendedArchetypes.includes(a),
      );
      for (const a of movedToward) {
        commitment.set(a, (commitment.get(a) ?? 0) + DIVERGENCE_BOOST);
      }
    }
  }

  // Openness signal: signposts we've SEEN AND PASSED indicate the archetype is under-drafted
  // (the late signpost wheeled = neighbors don't want it). Conversely, signposts that
  // disappear early aren't open. We approximate with a count of passed signposts.
  const passedSignposts: Map<ArchetypeId, number> = new Map();
  for (const c of ctx.seenAndPassed) {
    if (!c.profile.isSignpost) continue;
    for (const a of c.profile.signpostFor) {
      passedSignposts.set(a, (passedSignposts.get(a) ?? 0) + 1);
    }
  }

  return ARCHETYPES.map((a) => ({
    archetypeId: a.id,
    commitment: commitment.get(a.id) ?? 0,
    openness: passedSignposts.get(a.id) ?? 0,
  }));
}

function synergyScore(card: CardWithProfile, pool: CardWithProfile[]): number {
  if (pool.length === 0) return 0;
  let raw = 0;
  for (const p of pool) {
    if (
      card.profile.synergyPartners.includes(p.name) ||
      p.profile.synergyPartners.includes(card.name)
    ) {
      raw += PARTNER_BONUS;
    }
    const shared = card.profile.archetypes.filter((a) => p.profile.archetypes.includes(a)).length;
    raw += shared * SHARED_ARCHETYPE_BONUS;
  }
  // Diminishing returns: sqrt-scale so a 12-card pool isn't 4x as dense as a 3-card pool
  return Math.sqrt(raw) * 8;
}

function archetypeScore(
  card: CardWithProfile,
  signals: ArchetypeSignal[],
  pickPos: number,
): number {
  const sigByArch: Map<string, ArchetypeSignal> = new Map(signals.map((s) => [s.archetypeId, s]));
  const p = progressFraction(pickPos);

  let total = 0;
  for (const aid of card.profile.archetypes) {
    const s = sigByArch.get(aid);
    if (!s) continue;
    // Doubling down on what we're committed to
    total += s.commitment * (8 + 14 * p);
    // Pivot toward open archetypes (early-mid draft)
    total += s.openness * (3 + 6 * (1 - p));
  }
  // Signpost cards get a bonus only when there's actual signal:
  // either the archetype is open (passed signposts) or we're committed to it.
  // Without this guard, narrow signposts like Sneak Attack get a free +8 at
  // P1P1 and beat universally-good cards like fetch lands.
  if (card.profile.isSignpost) {
    for (const aid of card.profile.signpostFor) {
      const s = sigByArch.get(aid);
      if (!s) continue;
      const hasSignal = s.openness > 0 || s.commitment >= SIGNPOST_NO_SIGNAL_GUARD;
      if (hasSignal) total += 8 + s.openness * 4;
    }
  }
  return total;
}

function colorPenalty(card: CardWithProfile, pool: CardWithProfile[], pickPos: number): number {
  if (pool.length < 4) return 0;
  if (card.colorIdentity.length === 0) return 0;
  const counts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const p of pool) for (const c of p.colorIdentity) counts[c] = (counts[c] ?? 0) + 1;
  const topColors = (Object.entries(counts) as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .filter(([, n]) => n > 0)
    .slice(0, 2)
    .map(([c]) => c);
  const offColors = card.colorIdentity.filter((c) => !topColors.includes(c)).length;
  if (offColors === 0) return 0;
  const p = progressFraction(pickPos);
  return -offColors * (10 + 25 * p);
}

function speculationScore(card: CardWithProfile, pickPos: number): number {
  // P1P1 (and very early): boost cards that keep options open.
  // Flexibility = archetype breadth from profile tags, capped to avoid runaway
  // (e.g. Sol Ring tagged with 20 archetypes shouldn't crush everything).
  // Universal cards (fetches, duals, fast mana) get a floor — they go in any
  // deck regardless of how the AI tagged them in profile.json.
  const p = progressFraction(pickPos);
  let flex = card.profile.archetypes.length;
  if (isFixingLand(card) || isFastMana(card)) flex = Math.max(flex, FIXING_LAND_FLEX_FLOOR);
  flex = Math.min(flex, SPEC_FLEX_CAP);
  return (1 - p) * flex * 4;
}

export function scoreCard(
  card: CardWithProfile,
  ctx: DraftContext,
  signals: ArchetypeSignal[],
): Recommendation {
  const w = weights(ctx.pickPosition);
  const tier = effectivePowerTier(card);
  const breakdown: ScoreBreakdown = {
    power: w.power * (POWER_BASE[tier] ?? POWER_BASE.B),
    synergy: w.synergy * synergyScore(card, ctx.pool),
    archetypeOpenness: w.archetype * archetypeScore(card, signals, ctx.pickPosition),
    speculation: w.speculation * speculationScore(card, ctx.pickPosition),
  };
  const colorPen = colorPenalty(card, ctx.pool, ctx.pickPosition);
  const score =
    breakdown.power +
    breakdown.synergy +
    breakdown.archetypeOpenness +
    breakdown.speculation +
    colorPen;

  // surface the archetypes contributing most to the score
  const sigByArch: Map<string, ArchetypeSignal> = new Map(signals.map((s) => [s.archetypeId, s]));
  const topArchetypes = [...card.profile.archetypes].sort((a, b) => {
    const sa = (sigByArch.get(a)?.commitment ?? 0) + (sigByArch.get(a)?.openness ?? 0);
    const sb = (sigByArch.get(b)?.commitment ?? 0) + (sigByArch.get(b)?.openness ?? 0);
    return sb - sa;
  });

  return {
    cardName: card.name,
    score: Math.round(score * 10) / 10,
    breakdown: {
      power: Math.round(breakdown.power * 10) / 10,
      synergy: Math.round(breakdown.synergy * 10) / 10,
      archetypeOpenness: Math.round(breakdown.archetypeOpenness * 10) / 10,
      speculation: Math.round(breakdown.speculation * 10) / 10,
    },
    topArchetypes: topArchetypes.slice(0, 3),
  };
}

export function rankPack(
  pack: CardWithProfile[],
  pool: CardWithProfile[],
  seenAndPassed: CardWithProfile[],
  packNum: 1 | 2 | 3,
  pickNum: number,
  divergences?: Divergence[],
): { ranked: Recommendation[]; signals: ArchetypeSignal[] } {
  const ctx: DraftContext = {
    pool,
    seenAndPassed,
    pickPosition: pickPosition(packNum, pickNum),
    divergences,
  };
  const signals = computeArchetypeSignals(ctx);
  const ranked = pack
    .map((c) => scoreCard(c, ctx, signals))
    .sort((a, b) => b.score - a.score);
  return { ranked, signals };
}
