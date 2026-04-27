'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CardSearch } from './CardSearch';
import { RecommendationPanel } from './RecommendationPanel';
import { PoolSidebar } from './PoolSidebar';
import { TrajectoryPanel } from './TrajectoryPanel';
import type {
  ArchetypeSignposts,
  ClientCard,
  CubeMeta,
  Divergence,
  DraftSession,
  RecommendApiResponse,
} from './types-client';

const STORAGE_KEY = 'mtg-duel:draft-v1';

const emptySession = (): DraftSession => ({
  pool: [],
  seenAndPassed: [],
  history: [],
  packNum: 1,
  pickNum: 1,
  currentPack: [],
  divergences: [],
});

function loadSession(): DraftSession {
  if (typeof window === 'undefined') return emptySession();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySession();
    const parsed = JSON.parse(raw) as Partial<DraftSession>;
    return { ...emptySession(), ...parsed, divergences: parsed.divergences ?? [] };
  } catch {
    return emptySession();
  }
}

function saveSession(s: DraftSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function DraftBoard() {
  const [session, setSession] = useState<DraftSession>(emptySession());
  const [cube, setCube] = useState<ClientCard[]>([]);
  const [meta, setMeta] = useState<CubeMeta | null>(null);
  const [archetypeSignposts, setArchetypeSignposts] = useState<ArchetypeSignposts>({});
  const [rec, setRec] = useState<RecommendApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useConsultant, setUseConsultant] = useState(true);
  const expectedPickRef = useRef<string | null>(null);

  useEffect(() => {
    setSession(loadSession());
    fetch('/api/cube')
      .then((r) => r.json())
      .then((d) => {
        setCube(d.cards ?? []);
        setMeta(d.meta ?? null);
        setArchetypeSignposts(d.archetypeSignposts ?? {});
      })
      .catch((err) => setError(`Failed to load cube: ${err}`));
  }, []);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const cubeByName = useMemo(() => new Map(cube.map((c) => [c.name, c])), [cube]);

  const exclude = useMemo(
    () => new Set([...session.pool, ...session.seenAndPassed, ...session.currentPack]),
    [session],
  );

  const draftDone = session.packNum > 3;

  function addToPack(name: string) {
    setSession((s) => ({ ...s, currentPack: [...s.currentPack, name] }));
    setRec(null);
  }

  function removeFromPack(name: string) {
    setSession((s) => ({ ...s, currentPack: s.currentPack.filter((n) => n !== name) }));
    setRec(null);
  }

  async function requestRecommendation() {
    if (session.currentPack.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pool: session.pool,
          seenAndPassed: session.seenAndPassed,
          pack: session.currentPack,
          packNum: session.packNum,
          pickNum: session.pickNum,
          useConsultant,
          divergences: session.divergences,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `${res.status}`);
      }
      const data = (await res.json()) as RecommendApiResponse;
      setRec(data);
      expectedPickRef.current = data.consultant?.pickName ?? data.ranked[0]?.cardName ?? null;
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function confirmPick(name: string) {
    const expected = expectedPickRef.current;
    expectedPickRef.current = null;
    setSession((s) => {
      if (!s.currentPack.includes(name)) return s;
      const passed = s.currentPack.filter((n) => n !== name);
      const nextPick = s.pickNum + 1;
      const advancesPack = nextPick > 15;

      let newDivergences = s.divergences;
      if (expected && expected !== name) {
        const recCard = cubeByName.get(expected);
        const chosenCard = cubeByName.get(name);
        newDivergences = [
          ...s.divergences,
          {
            packNum: s.packNum,
            pickNum: s.pickNum,
            recommended: expected,
            chosen: name,
            recommendedArchetypes: recCard?.archetypes ?? [],
            chosenArchetypes: chosenCard?.archetypes ?? [],
          },
        ];
      }

      return {
        pool: [...s.pool, name],
        seenAndPassed: [...s.seenAndPassed, ...passed],
        history: [
          ...s.history,
          { packNum: s.packNum, pickNum: s.pickNum, pickedName: name, passedNames: passed },
        ],
        packNum: advancesPack ? ((s.packNum + 1) as 1 | 2 | 3) : s.packNum,
        pickNum: advancesPack ? 1 : nextPick,
        currentPack: [],
        divergences: newDivergences,
      };
    });
    setRec(null);
  }

  function reset() {
    if (!confirm('Start a new draft? This wipes the current pool.')) return;
    setSession(emptySession());
    setRec(null);
    expectedPickRef.current = null;
  }

  return (
    <div className="mx-auto max-w-7xl">
      <Header
        session={session}
        meta={meta}
        useConsultant={useConsultant}
        setUseConsultant={setUseConsultant}
        onReset={reset}
      />

      {!meta?.hasProfiles && meta && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          No card profiles loaded. Recommendations will be weak. Run{' '}
          <code className="rounded bg-black/30 px-1">npm run ingest:profiles</code>.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {!draftDone ? (
            <PackEntry
              session={session}
              cube={cube}
              cubeByName={cubeByName}
              exclude={exclude}
              loading={loading}
              onAdd={addToPack}
              onRemove={removeFromPack}
              onRecommend={requestRecommendation}
              onConfirmPick={confirmPick}
            />
          ) : (
            <DraftDone session={session} cubeByName={cubeByName} />
          )}

          {rec && !draftDone && (
            <RecommendationPanel
              result={rec}
              cubeByName={cubeByName}
              onConfirmPick={confirmPick}
            />
          )}
          <TrajectoryPanel divergences={session.divergences} />
        </div>

        <PoolSidebar
          pool={session.pool}
          seenAndPassed={session.seenAndPassed}
          cubeByName={cubeByName}
          archetypeSignposts={archetypeSignposts}
        />
      </div>
    </div>
  );
}

function Header({
  session,
  meta,
  useConsultant,
  setUseConsultant,
  onReset,
}: {
  session: DraftSession;
  meta: CubeMeta | null;
  useConsultant: boolean;
  setUseConsultant: (v: boolean) => void;
  onReset: () => void;
}) {
  const draftDone = session.packNum > 3;
  return (
    <div className="mb-6 flex items-center justify-between gap-4 border-b border-neutral-800 pb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">mtg-duel</h1>
        <div className="mt-0.5 text-sm text-neutral-400">
          {meta ? `${meta.cubeName} · ${meta.cardCount} cards` : 'Loading cube…'}
          {meta?.hasProfiles && <span className="ml-2 text-emerald-400">profiles ✓</span>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-mono">
          {draftDone ? (
            <span className="text-emerald-400">draft complete · {session.pool.length} cards</span>
          ) : (
            <>
              P{session.packNum} <span className="text-neutral-500">·</span> p{session.pickNum}{' '}
              <span className="text-neutral-500">·</span> pool {session.pool.length}
            </>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
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
      </div>
    </div>
  );
}

function PackEntry({
  session,
  cube,
  cubeByName,
  exclude,
  loading,
  onAdd,
  onRemove,
  onRecommend,
  onConfirmPick,
}: {
  session: DraftSession;
  cube: ClientCard[];
  cubeByName: Map<string, ClientCard>;
  exclude: Set<string>;
  loading: boolean;
  onAdd: (n: string) => void;
  onRemove: (n: string) => void;
  onRecommend: () => void;
  onConfirmPick: (n: string) => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Pack {session.packNum}, pick {session.pickNum}
        </h2>
        <span className="text-sm text-neutral-500">
          {session.currentPack.length} card{session.currentPack.length === 1 ? '' : 's'} in pack
        </span>
      </div>

      <CardSearch
        cube={cube}
        exclude={exclude}
        onPick={onAdd}
        placeholder="Add a card from the pack…"
      />

      {session.currentPack.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {session.currentPack.map((name) => {
            const c = cubeByName.get(name);
            return (
              <div
                key={name}
                className="group relative rounded-lg border border-neutral-800 bg-neutral-900 p-2"
              >
                {c?.imageNormal ? (
                  <img src={c.imageNormal} alt={name} className="w-full rounded-md" />
                ) : (
                  <div className="flex h-32 items-center justify-center text-xs text-neutral-500">
                    {name}
                  </div>
                )}
                <div className="mt-2 truncate text-xs">{name}</div>
                <div className="mt-1 flex gap-1">
                  <button
                    onClick={() => onConfirmPick(name)}
                    className="flex-1 rounded bg-emerald-700 px-2 py-1 text-[11px] hover:bg-emerald-600"
                  >
                    Pick
                  </button>
                  <button
                    onClick={() => onRemove(name)}
                    className="rounded border border-neutral-700 px-2 py-1 text-[11px] hover:border-neutral-400"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          disabled={loading || session.currentPack.length === 0}
          onClick={onRecommend}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {loading ? 'Thinking…' : 'Get pick recommendation'}
        </button>
      </div>
    </div>
  );
}

function DraftDone({
  session,
  cubeByName,
}: {
  session: DraftSession;
  cubeByName: Map<string, ClientCard>;
}) {
  return (
    <div className="rounded-xl border border-emerald-700/40 bg-emerald-700/5 p-6">
      <h2 className="text-xl font-semibold text-emerald-300">Draft complete</h2>
      <p className="mt-1 text-sm text-neutral-400">
        {session.pool.length} cards picked across {session.history.length} picks. The deckbuilder
        UI lands in Phase 3 — for now, here's the pool.
      </p>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {session.pool.map((name) => {
          const c = cubeByName.get(name);
          return (
            <div key={name} className="aspect-[5/7] overflow-hidden rounded">
              {c?.imageSmall ? (
                <img src={c.imageSmall} alt={name} loading="lazy" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                  {name}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
