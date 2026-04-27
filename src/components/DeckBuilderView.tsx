'use client';
import type { ClientCard } from './types-client';

export interface BuiltDeckClient {
  primaryColors: string[];
  archetype: string;
  spells: string[];
  nonbasicLands: string[];
  basicLands: Array<{ name: string; count: number }>;
  benched: string[];
  curve: Record<string, number>;
  pips: Record<string, number>;
}

interface Props {
  deck: BuiltDeckClient;
  cubeByName: Map<string, ClientCard>;
  onLockIn: () => void;
  onRebuild: () => void;
  locking: boolean;
}

const COLOR_LABEL: Record<string, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };

function bucketSpells(spells: string[], cubeByName: Map<string, ClientCard>) {
  const bucket: Record<string, string[]> = { '1': [], '2': [], '3': [], '4': [], '5': [], '6+': [] };
  for (const name of spells) {
    const c = cubeByName.get(name);
    const cmc = c ? approxCmc(c) : 0;
    if (cmc <= 1) bucket['1'].push(name);
    else if (cmc === 2) bucket['2'].push(name);
    else if (cmc === 3) bucket['3'].push(name);
    else if (cmc === 4) bucket['4'].push(name);
    else if (cmc === 5) bucket['5'].push(name);
    else bucket['6+'].push(name);
  }
  return bucket;
}

function approxCmc(c: ClientCard): number {
  if (!c.manaCost) return 0;
  const symbols = c.manaCost.match(/\{([^}]+)\}/g) ?? [];
  let total = 0;
  for (const s of symbols) {
    const inner = s.slice(1, -1);
    if (/^\d+$/.test(inner)) total += parseInt(inner, 10);
    else if (inner === 'X') total += 0;
    else total += 1;
  }
  return total;
}

export function DeckBuilderView({ deck, cubeByName, onLockIn, onRebuild, locking }: Props) {
  const buckets = bucketSpells(deck.spells, cubeByName);
  const totalLands = deck.nonbasicLands.length + deck.basicLands.reduce((s, b) => s + b.count, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-700/40 bg-emerald-700/5 p-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold text-emerald-300">Auto-built deck</h2>
          <span className="text-sm text-neutral-400">
            {deck.spells.length} spells · {totalLands} lands · 40 total
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded bg-neutral-800 px-2 py-0.5">
            archetype: <span className="font-medium">{deck.archetype}</span>
          </span>
          <span className="text-neutral-400">
            colors: {deck.primaryColors.map((c) => COLOR_LABEL[c]).join(' / ') || 'colorless'}
          </span>
          <span className="text-neutral-400">
            pips:{' '}
            {Object.entries(deck.pips)
              .filter(([, n]) => n > 0)
              .map(([c, n]) => `${c}=${n}`)
              .join(' ') || '—'}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            disabled={locking}
            onClick={onLockIn}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            {locking ? 'Generating strategy…' : 'Lock in deck → strategy'}
          </button>
          <button
            onClick={onRebuild}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-400"
          >
            Rebuild
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {(Object.entries(buckets) as [string, string[]][]).map(([bucket, names]) => (
          <div key={bucket} className="rounded-lg border border-neutral-800 bg-neutral-950 p-2">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-neutral-400">CMC {bucket}</span>
              <span className="text-xs text-neutral-500">{names.length}</span>
            </div>
            <div className="space-y-1">
              {names.length === 0 ? (
                <div className="text-[11px] text-neutral-600">—</div>
              ) : (
                names.map((n) => {
                  const c = cubeByName.get(n);
                  return (
                    <div key={n} className="flex items-center gap-1.5 text-[11px]">
                      {c?.imageSmall && (
                        <img src={c.imageSmall} alt={n} className="h-8 w-auto rounded-sm" loading="lazy" />
                      )}
                      <span className="truncate">{n}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
        <h3 className="mb-2 text-sm font-semibold text-neutral-300">Lands ({totalLands})</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          {deck.nonbasicLands.map((n) => (
            <span key={n} className="rounded bg-neutral-800 px-2 py-1">
              {n}
            </span>
          ))}
          {deck.basicLands.map((b) => (
            <span key={b.name} className="rounded bg-neutral-800/60 px-2 py-1 text-neutral-400">
              {b.count}× {b.name}
            </span>
          ))}
        </div>
      </div>

      {deck.benched.length > 0 && (
        <details className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
          <summary className="cursor-pointer text-sm text-neutral-400">
            Benched ({deck.benched.length}) — cards from your pool not in the deck
          </summary>
          <div className="mt-3 grid grid-cols-6 gap-1 sm:grid-cols-8 md:grid-cols-10">
            {deck.benched.map((n) => {
              const c = cubeByName.get(n);
              return (
                <div key={n} className="aspect-[5/7] overflow-hidden rounded-sm bg-neutral-900" title={n}>
                  {c?.imageSmall ? (
                    <img src={c.imageSmall} alt={n} loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] text-neutral-500">{n}</div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
