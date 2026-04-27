'use client';
import type { ArchetypeSignposts, ClientCard } from './types-client';

interface Props {
  pool: string[];
  seenAndPassed?: string[];
  cubeByName: Map<string, ClientCard>;
  archetypeSignposts?: ArchetypeSignposts;
  showArchetypes?: boolean;
}

export function PoolSidebar({
  pool,
  seenAndPassed = [],
  cubeByName,
  archetypeSignposts,
  showArchetypes = true,
}: Props) {
  const colors: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const name of pool) {
    const c = cubeByName.get(name);
    if (!c) continue;
    for (const ci of c.colorIdentity) colors[ci] = (colors[ci] ?? 0) + 1;
  }
  const archCounts: Record<string, number> = {};
  for (const name of pool) {
    const c = cubeByName.get(name);
    if (!c) continue;
    for (const a of c.archetypes) archCounts[a] = (archCounts[a] ?? 0) + 1;
  }
  const topArchetypes = Object.entries(archCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // The leaning archetype for the required-signposts panel
  const leaning = topArchetypes[0]?.[0];

  return (
    <aside className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 lg:sticky lg:top-4 lg:self-start">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Pool ({pool.length})
      </h3>
      <div className="mb-3 flex gap-2 text-xs">
        {(['W', 'U', 'B', 'R', 'G'] as const).map((c) => (
          <div key={c} className="flex items-center gap-1">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                {
                  W: 'bg-yellow-200',
                  U: 'bg-blue-400',
                  B: 'bg-neutral-800 border border-neutral-500',
                  R: 'bg-red-500',
                  G: 'bg-green-500',
                }[c]
              }`}
            />
            <span className="text-neutral-300">{colors[c]}</span>
          </div>
        ))}
      </div>

      {showArchetypes && topArchetypes.length > 0 && (
        <div className="mb-3 space-y-1">
          {topArchetypes.map(([a, n]) => (
            <div key={a} className="flex items-center justify-between text-xs">
              <span className="truncate text-neutral-300">{a}</span>
              <span className="text-neutral-500">{n}</span>
            </div>
          ))}
        </div>
      )}

      {leaning && archetypeSignposts && archetypeSignposts[leaning]?.length > 0 && (
        <RequiredSignposts
          archetypeId={leaning}
          signposts={archetypeSignposts[leaning]}
          pool={pool}
          seenAndPassed={seenAndPassed}
          cubeByName={cubeByName}
        />
      )}

      <div className="mt-3 grid grid-cols-3 gap-1 lg:max-h-[60vh] lg:overflow-y-auto">
        {pool.map((name) => {
          const c = cubeByName.get(name);
          return (
            <div
              key={name}
              title={name}
              className="aspect-[5/7] overflow-hidden rounded-sm bg-neutral-900"
            >
              {c?.imageSmall ? (
                <img src={c.imageSmall} alt={name} className="w-full" loading="lazy" />
              ) : (
                <div className="flex h-full items-center justify-center text-[9px] text-neutral-500">
                  {name}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function RequiredSignposts({
  archetypeId,
  signposts,
  pool,
  seenAndPassed,
  cubeByName,
}: {
  archetypeId: string;
  signposts: string[];
  pool: string[];
  seenAndPassed: string[];
  cubeByName: Map<string, ClientCard>;
}) {
  const poolSet = new Set(pool);
  const passedSet = new Set(seenAndPassed);
  // Sort: owned first, then seen-and-passed, then unseen
  const ordered = [...signposts].sort((a, b) => statusRank(a) - statusRank(b));
  function statusRank(name: string) {
    if (poolSet.has(name)) return 0;
    if (passedSet.has(name)) return 1;
    return 2;
  }
  const ownedCount = signposts.filter((n) => poolSet.has(n)).length;

  return (
    <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          {archetypeId} signposts
        </span>
        <span className="text-[10px] text-amber-300/70">
          {ownedCount}/{signposts.length}
        </span>
      </div>
      <ul className="space-y-0.5">
        {ordered.map((name) => {
          const owned = poolSet.has(name);
          const passed = passedSet.has(name);
          const c = cubeByName.get(name);
          return (
            <li
              key={name}
              title={passed ? 'Already passed in a previous pack' : owned ? 'In your pool' : 'Not yet seen'}
              className={`flex items-center gap-1.5 text-[11px] ${
                owned
                  ? 'text-emerald-300'
                  : passed
                  ? 'text-neutral-500 line-through'
                  : 'text-neutral-300'
              }`}
            >
              <span className="w-3 text-center">
                {owned ? '✓' : passed ? '✗' : '○'}
              </span>
              <span className="truncate">{name}</span>
              {c?.powerTier && (
                <span className="ml-auto text-[9px] text-neutral-500">{c.powerTier}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
