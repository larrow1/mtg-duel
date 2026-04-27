'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MockPackView } from './MockPackView';
import { PoolSidebar } from './PoolSidebar';
import { RecommendationPanel } from './RecommendationPanel';
import { DeckBuilderView, type BuiltDeckClient } from './DeckBuilderView';
import { StrategyView, type StrategyOverviewClient } from './StrategyView';
import { TrajectoryPanel } from './TrajectoryPanel';
import { UserMenu } from './UserMenu';
import type {
  ArchetypeSignposts,
  ClientCard,
  CubeMeta,
  Divergence,
  RecommendApiResponse,
} from './types-client';

const STORAGE_KEY = 'mtg-duel:mock-draft-v1';

interface MockDraftStateClient {
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

interface SavedSession {
  state: MockDraftStateClient | null;
  deck: BuiltDeckClient | null;
  strategy: StrategyOverviewClient | null;
  divergences: Divergence[];
}

function loadSaved(): SavedSession {
  const empty: SavedSession = { state: null, deck: null, strategy: null, divergences: [] };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return empty;
  }
}

function saveSession(s: SavedSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function MockDraftBoard() {
  const [state, setState] = useState<MockDraftStateClient | null>(null);
  const [cube, setCube] = useState<ClientCard[]>([]);
  const [meta, setMeta] = useState<CubeMeta | null>(null);
  const [archetypeSignposts, setArchetypeSignposts] = useState<ArchetypeSignposts>({});
  const [rec, setRec] = useState<RecommendApiResponse | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [deck, setDeck] = useState<BuiltDeckClient | null>(null);
  const [strategy, setStrategy] = useState<StrategyOverviewClient | null>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [divergences, setDivergences] = useState<Divergence[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useConsultant, setUseConsultant] = useState(true);
  const [autoRecommend, setAutoRecommend] = useState(true);
  const recRequestKeyRef = useRef<string>('');
  // The "expected" pick from the most recent recommendation; used to detect divergence on user pick.
  const expectedPickRef = useRef<string | null>(null);

  useEffect(() => {
    fetch('/api/cube')
      .then((r) => r.json())
      .then((d) => {
        setCube(d.cards ?? []);
        setMeta(d.meta ?? null);
        setArchetypeSignposts(d.archetypeSignposts ?? {});
      })
      .catch((err) => setError(`Failed to load cube: ${err}`));
    const saved = loadSaved();
    setState(saved.state);
    setDeck(saved.deck);
    setStrategy(saved.strategy);
    setDivergences(saved.divergences);
  }, []);

  useEffect(() => {
    saveSession({ state, deck, strategy, divergences });
  }, [state, deck, strategy, divergences]);

  const cubeByName = useMemo(() => new Map(cube.map((c) => [c.name, c])), [cube]);

  const userPool = state?.pools[state.userIdx] ?? [];
  const userPack = state?.packsInRotation[state.userIdx] ?? [];
  const userPassed = state?.passed[state.userIdx] ?? [];

  // Auto-fetch recommendation when pack changes
  useEffect(() => {
    if (!state || state.status !== 'awaiting_pick' || !autoRecommend) return;
    if (userPack.length === 0) return;
    const key = `${state.packNum}-${state.pickNum}-${userPack.length}-${useConsultant ? 'c' : 'n'}`;
    if (recRequestKeyRef.current === key) return;
    recRequestKeyRef.current = key;
    requestRecommendation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.packNum, state?.pickNum, state?.status, autoRecommend, useConsultant]);

  // Auto-build deck when entering building phase
  useEffect(() => {
    if (state?.status === 'building' && !deck) {
      buildDeckFromPool();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status]);

  async function startDraft() {
    setError(null);
    setRec(null);
    setDeck(null);
    setStrategy(null);
    try {
      const r = await fetch('/api/mock-draft/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `${r.status}`);
      const next = (await r.json()) as MockDraftStateClient;
      setState(next);
    } catch (err) {
      setError(String(err));
    }
  }

  async function requestRecommendation() {
    if (!state) return;
    setRecLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pool: state.pools[state.userIdx],
          seenAndPassed: state.passed[state.userIdx],
          pack: state.packsInRotation[state.userIdx],
          packNum: state.packNum,
          pickNum: state.pickNum,
          useConsultant,
          divergences,
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `${r.status}`);
      const data = (await r.json()) as RecommendApiResponse;
      setRec(data);
      expectedPickRef.current = data.consultant?.pickName ?? data.ranked[0]?.cardName ?? null;
    } catch (err) {
      setError(`Recommendation failed: ${err}`);
    } finally {
      setRecLoading(false);
    }
  }

  async function pickCard(name: string) {
    if (!state) return;
    setError(null);
    // Detect divergence: user picked something other than what we recommended.
    const expected = expectedPickRef.current;
    if (expected && expected !== name) {
      const recCard = cubeByName.get(expected);
      const chosenCard = cubeByName.get(name);
      const div: Divergence = {
        packNum: state.packNum,
        pickNum: state.pickNum,
        recommended: expected,
        chosen: name,
        recommendedArchetypes: recCard?.archetypes ?? [],
        chosenArchetypes: chosenCard?.archetypes ?? [],
      };
      setDivergences((d) => [...d, div]);
    }
    expectedPickRef.current = null;
    setRec(null);
    try {
      const r = await fetch('/api/mock-draft/round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, userPick: name }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `${r.status}`);
      const next = (await r.json()) as MockDraftStateClient;
      setState(next);
    } catch (err) {
      setError(`Round failed: ${err}`);
    }
  }

  async function buildDeckFromPool() {
    if (!state) return;
    setError(null);
    try {
      const r = await fetch('/api/mock-draft/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pool: state.pools[state.userIdx] }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `${r.status}`);
      const built = (await r.json()) as BuiltDeckClient;
      setDeck(built);
    } catch (err) {
      setError(`Deck build failed: ${err}`);
    }
  }

  async function lockInAndGetStrategy() {
    if (!deck) return;
    setStrategyLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/mock-draft/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deck }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `${r.status}`);
      const overview = (await r.json()) as StrategyOverviewClient;
      setStrategy(overview);
    } catch (err) {
      setError(`Strategy failed: ${err}`);
    } finally {
      setStrategyLoading(false);
    }
  }

  function reset() {
    if (!confirm('Start a new mock draft? This wipes the current pool, deck, and strategy.')) return;
    setState(null);
    setRec(null);
    setDeck(null);
    setStrategy(null);
    setDivergences([]);
    recRequestKeyRef.current = '';
    expectedPickRef.current = null;
  }

  const draftDone = state?.status === 'building' || state?.status === 'done';
  const recommendedPick = rec?.consultant?.pickName ?? rec?.ranked[0]?.cardName;

  return (
    <div className="mx-auto max-w-7xl">
      <Header
        state={state}
        meta={meta}
        useConsultant={useConsultant}
        setUseConsultant={setUseConsultant}
        autoRecommend={autoRecommend}
        setAutoRecommend={setAutoRecommend}
        onReset={reset}
      />

      {!meta?.hasProfiles && meta && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          No card profiles loaded. Bots and recommendations will be weak. Run{' '}
          <code className="rounded bg-black/30 px-1">npm run ingest:profiles</code>.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {!state ? (
        <StartScreen onStart={startDraft} />
      ) : state.status === 'awaiting_pick' ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Pack {state.packNum}, pick {state.pickNum} of 15
                </h2>
                <span className="text-sm text-neutral-500">
                  {userPack.length} card{userPack.length === 1 ? '' : 's'} in pack
                </span>
              </div>
              <MockPackView
                pack={userPack}
                cubeByName={cubeByName}
                highlightName={recommendedPick ?? null}
                onPick={pickCard}
              />
            </div>

            {recLoading && (
              <div className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-400">
                Thinking…
              </div>
            )}
            {rec && (
              <RecommendationPanel
                result={rec}
                cubeByName={cubeByName}
                onConfirmPick={pickCard}
              />
            )}
            {!rec && !recLoading && !autoRecommend && (
              <button
                onClick={requestRecommendation}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Get recommendation
              </button>
            )}
            <TrajectoryPanel divergences={divergences} />
          </div>

          <PoolSidebar
            pool={userPool}
            seenAndPassed={userPassed}
            cubeByName={cubeByName}
            archetypeSignposts={archetypeSignposts}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {deck ? (
            <>
              <DeckBuilderView
                deck={deck}
                cubeByName={cubeByName}
                onLockIn={lockInAndGetStrategy}
                onRebuild={buildDeckFromPool}
                locking={strategyLoading}
              />
              {strategy && <StrategyView strategy={strategy} cubeByName={cubeByName} />}
            </>
          ) : (
            <div className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-6 text-sm text-neutral-400">
              Building your deck…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Header({
  state,
  meta,
  useConsultant,
  setUseConsultant,
  autoRecommend,
  setAutoRecommend,
  onReset,
}: {
  state: MockDraftStateClient | null;
  meta: CubeMeta | null;
  useConsultant: boolean;
  setUseConsultant: (v: boolean) => void;
  autoRecommend: boolean;
  setAutoRecommend: (v: boolean) => void;
  onReset: () => void;
}) {
  const userPool = state?.pools[state.userIdx] ?? [];
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">mtg-duel</h1>
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-200">
            ← home
          </Link>
        </div>
        <div className="mt-0.5 text-sm text-neutral-400">
          mock draft · {meta ? `${meta.cubeName} · ${meta.cardCount} cards` : 'loading…'}
          {meta?.hasProfiles && <span className="ml-2 text-emerald-400">profiles ✓</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-mono">
          {!state ? (
            <span className="text-neutral-500">not started</span>
          ) : state.status === 'awaiting_pick' ? (
            <>
              P{state.packNum} <span className="text-neutral-500">·</span> p{state.pickNum}{' '}
              <span className="text-neutral-500">·</span> pool {userPool.length}
            </>
          ) : (
            <span className="text-emerald-400">draft complete · {userPool.length} cards</span>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={autoRecommend}
            onChange={(e) => setAutoRecommend(e.target.checked)}
            className="accent-emerald-500"
          />
          Auto-rec
        </label>
        <label className="flex items-center gap-1.5 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={useConsultant}
            onChange={(e) => setUseConsultant(e.target.checked)}
            className="accent-amber-500"
          />
          Claude
        </label>
        <button
          onClick={onReset}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-400"
        >
          Reset
        </button>
        <UserMenu />
      </div>
    </div>
  );
}

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-8">
      <h2 className="text-xl font-semibold">Mock draft</h2>
      <p className="mt-2 max-w-2xl text-sm text-neutral-400">
        You'll draft against 7 bots that share the same scoring engine. The app generates 24 packs
        (3 per player), passes them around the table, and asks you to pick from your pack each turn.
        Recommendations update automatically. At the end, you'll get an auto-built 40-card deck and
        a Claude-written strategy briefing.
      </p>
      <button
        onClick={onStart}
        className="mt-5 rounded-lg bg-white px-5 py-3 font-medium text-black hover:bg-neutral-200"
      >
        Start mock draft
      </button>
    </div>
  );
}
