import 'server-only';
import type { CardWithProfile } from './types';
import { rankPack } from './scoring';

export const NUM_PLAYERS = 8;
export const PACK_SIZE = 15;
export const PACKS_PER_PLAYER = 3;

export interface MockDraftState {
  packsInRotation: string[][];
  upcomingPacks: string[][][];
  pools: string[][];
  passed: string[][];
  packNum: 1 | 2 | 3;
  pickNum: number;
  userIdx: number;
  status: 'awaiting_pick' | 'building' | 'done';
  history: Array<{
    packNum: number;
    pickNum: number;
    userPick: string;
    botPicks: Array<{ player: number; pick: string }>;
  }>;
  seed: number;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function generateMockDraft(
  cube: CardWithProfile[],
  options: { userIdx?: number; seed?: number } = {},
): MockDraftState {
  const userIdx = options.userIdx ?? 0;
  const seed = options.seed ?? Math.floor(Math.random() * 0x7fffffff);
  const rng = makeRng(seed);

  const draftable = cube.filter((c) => !c.typeLine.toLowerCase().startsWith('basic land'));
  const totalNeeded = NUM_PLAYERS * PACKS_PER_PLAYER * PACK_SIZE;
  if (draftable.length < totalNeeded) {
    throw new Error(
      `Not enough cards: cube has ${draftable.length}, need ${totalNeeded}. ` +
        `Make sure profiles + cube are loaded.`,
    );
  }

  const shuffled = shuffle(draftable.map((c) => c.name), rng);
  const allPacks: string[][] = [];
  for (let i = 0; i < NUM_PLAYERS * PACKS_PER_PLAYER; i++) {
    allPacks.push(shuffled.slice(i * PACK_SIZE, (i + 1) * PACK_SIZE));
  }

  const packsByPackNum: string[][][] = [];
  for (let p = 0; p < PACKS_PER_PLAYER; p++) {
    packsByPackNum.push(allPacks.slice(p * NUM_PLAYERS, (p + 1) * NUM_PLAYERS));
  }

  return {
    packsInRotation: packsByPackNum[0],
    upcomingPacks: packsByPackNum.slice(1),
    pools: Array.from({ length: NUM_PLAYERS }, () => []),
    passed: Array.from({ length: NUM_PLAYERS }, () => []),
    packNum: 1,
    pickNum: 1,
    userIdx,
    status: 'awaiting_pick',
    history: [],
    seed,
  };
}

function rotate<T>(arr: T[], direction: 'left' | 'right'): T[] {
  if (arr.length === 0) return arr;
  const out = new Array<T>(arr.length);
  for (let i = 0; i < arr.length; i++) {
    out[i] = direction === 'left' ? arr[(i + 1) % arr.length] : arr[(i - 1 + arr.length) % arr.length];
  }
  return out;
}

function botChoosePick(
  pack: string[],
  pool: string[],
  passed: string[],
  packNum: 1 | 2 | 3,
  pickNum: number,
  byName: Map<string, CardWithProfile>,
): string {
  const packCards = pack.map((n) => byName.get(n)).filter((c): c is CardWithProfile => !!c);
  if (packCards.length === 0) return pack[0];
  const poolCards = pool.map((n) => byName.get(n)).filter((c): c is CardWithProfile => !!c);
  const passedCards = passed.map((n) => byName.get(n)).filter((c): c is CardWithProfile => !!c);
  const { ranked } = rankPack(packCards, poolCards, passedCards, packNum, pickNum);
  return ranked[0]?.cardName ?? packCards[0].name;
}

export function pickAndAdvance(
  state: MockDraftState,
  userPickName: string,
  byName: Map<string, CardWithProfile>,
): MockDraftState {
  if (state.status !== 'awaiting_pick') {
    throw new Error(`Cannot pick in status ${state.status}`);
  }
  const userPack = state.packsInRotation[state.userIdx];
  if (!userPack.includes(userPickName)) {
    throw new Error(`User pick ${userPickName} is not in current pack`);
  }

  // 1. Compute everyone's picks
  const picks: string[] = new Array(NUM_PLAYERS);
  for (let p = 0; p < NUM_PLAYERS; p++) {
    const pack = state.packsInRotation[p];
    if (p === state.userIdx) {
      picks[p] = userPickName;
    } else {
      picks[p] = botChoosePick(pack, state.pools[p], state.passed[p], state.packNum, state.pickNum, byName);
    }
  }

  // 2. Update pools, passed, deplete packs
  const newPools = state.pools.map((pool, p) => [...pool, picks[p]]);
  const newPassed = state.passed.map((passed, p) => [
    ...passed,
    ...state.packsInRotation[p].filter((n) => n !== picks[p]),
  ]);
  const depletedPacks = state.packsInRotation.map((pack, p) => pack.filter((n) => n !== picks[p]));

  // 3. Rotate (or open next pack)
  let nextPacks = depletedPacks;
  let nextPackNum: 1 | 2 | 3 = state.packNum;
  let nextPickNum = state.pickNum + 1;
  let nextStatus: MockDraftState['status'] = 'awaiting_pick';
  let nextUpcoming = state.upcomingPacks;

  const lastPickOfPack = state.pickNum >= PACK_SIZE;
  if (!lastPickOfPack) {
    const direction = state.packNum === 2 ? 'right' : 'left';
    nextPacks = rotate(depletedPacks, direction);
  } else {
    // open next pack
    if (state.packNum < 3) {
      nextPackNum = (state.packNum + 1) as 1 | 2 | 3;
      nextPickNum = 1;
      nextPacks = state.upcomingPacks[0];
      nextUpcoming = state.upcomingPacks.slice(1);
    } else {
      nextStatus = 'building';
      nextPacks = [];
      nextPickNum = 0;
    }
  }

  return {
    ...state,
    packsInRotation: nextPacks,
    upcomingPacks: nextUpcoming,
    pools: newPools,
    passed: newPassed,
    packNum: nextPackNum,
    pickNum: nextPickNum,
    status: nextStatus,
    history: [
      ...state.history,
      {
        packNum: state.packNum,
        pickNum: state.pickNum,
        userPick: userPickName,
        botPicks: picks
          .map((p, i) => ({ player: i, pick: p }))
          .filter((b) => b.player !== state.userIdx),
      },
    ],
  };
}

export function userView(state: MockDraftState) {
  return {
    pack: state.packsInRotation[state.userIdx] ?? [],
    pool: state.pools[state.userIdx] ?? [],
    seenAndPassed: state.passed[state.userIdx] ?? [],
    packNum: state.packNum,
    pickNum: state.pickNum,
    status: state.status,
    history: state.history,
  };
}
