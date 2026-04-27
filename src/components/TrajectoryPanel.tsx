'use client';
import type { Divergence } from './types-client';

interface Props {
  divergences: Divergence[];
}

export function TrajectoryPanel({ divergences }: Props) {
  if (divergences.length === 0) return null;

  // Aggregate "moved toward" archetype counts across all divergences
  const moved: Record<string, number> = {};
  for (const d of divergences) {
    const delta = d.chosenArchetypes.filter((a) => !d.recommendedArchetypes.includes(a));
    for (const a of delta) moved[a] = (moved[a] ?? 0) + 1;
  }
  const topDirections = Object.entries(moved)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
          Your trajectory
        </span>
        <span className="text-[11px] text-emerald-300/80">
          {divergences.length} override{divergences.length === 1 ? '' : 's'}
        </span>
      </div>

      {topDirections.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {topDirections.map(([a, n]) => (
            <span
              key={a}
              className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200"
            >
              → {a} ({n})
            </span>
          ))}
        </div>
      )}

      <ul className="space-y-0.5 text-[11px] text-neutral-300">
        {divergences.slice(-4).reverse().map((d, i) => {
          const delta = d.chosenArchetypes.filter((a) => !d.recommendedArchetypes.includes(a));
          return (
            <li key={i} className="truncate">
              <span className="text-neutral-500">P{d.packNum}P{d.pickNum}:</span>{' '}
              <span className="text-emerald-300">{d.chosen}</span>{' '}
              <span className="text-neutral-500">over</span>{' '}
              <span className="text-neutral-400 line-through">{d.recommended}</span>
              {delta.length > 0 && (
                <span className="ml-1 text-emerald-400">
                  → {delta.slice(0, 2).join('/')}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
