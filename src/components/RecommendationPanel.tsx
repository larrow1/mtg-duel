'use client';
import type { RecommendApiResponse, ClientCard } from './types-client';

interface Props {
  result: RecommendApiResponse;
  cubeByName: Map<string, ClientCard>;
  onConfirmPick: (name: string) => void;
}

export function RecommendationPanel({ result, cubeByName, onConfirmPick }: Props) {
  const consultant = result.consultant;
  const top = result.ranked.slice(0, 5);

  return (
    <div className="space-y-4">
      {consultant && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Claude consultant pick
            </div>
            {consultant.archetypeDirection && (
              <div className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">
                {consultant.archetypeDirection}
              </div>
            )}
          </div>
          <div className="mt-1 text-xl font-semibold">{consultant.pickName}</div>
          <p className="mt-2 text-sm text-neutral-300">{consultant.rationale}</p>
          <button
            onClick={() => onConfirmPick(consultant.pickName)}
            className="mt-3 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-amber-400"
          >
            Take this pick →
          </button>
        </div>
      )}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Engine ranking
        </div>
        <ol className="space-y-2">
          {top.map((r, i) => {
            const card = cubeByName.get(r.cardName);
            return (
              <li
                key={r.cardName}
                className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3"
              >
                <span className="mt-0.5 w-6 text-right text-sm font-bold text-neutral-500">{i + 1}</span>
                {card?.imageSmall && (
                  <img
                    src={card.imageSmall}
                    alt={r.cardName}
                    className="h-20 w-auto rounded-sm"
                    loading="lazy"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-medium truncate">{r.cardName}</div>
                    <div className="text-sm font-mono text-neutral-300">{r.score}</div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.topArchetypes.map((a) => (
                      <span key={a} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                        {a}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    pw {r.breakdown.power} · syn {r.breakdown.synergy} · arch{' '}
                    {r.breakdown.archetypeOpenness} · spec {r.breakdown.speculation}
                  </div>
                </div>
                <button
                  onClick={() => onConfirmPick(r.cardName)}
                  className="self-center rounded-md border border-neutral-700 px-2 py-1 text-xs hover:border-neutral-400"
                >
                  Pick
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <SignalsView signals={result.signals} />
    </div>
  );
}

function SignalsView({ signals }: { signals: RecommendApiResponse['signals'] }) {
  const interesting = signals
    .filter((s) => s.commitment > 0 || s.openness > 0)
    .sort((a, b) => b.commitment + b.openness * 0.5 - (a.commitment + a.openness * 0.5))
    .slice(0, 8);
  if (interesting.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Archetype signals
      </div>
      <div className="grid grid-cols-2 gap-2">
        {interesting.map((s) => (
          <div key={s.archetypeId} className="rounded border border-neutral-800 bg-neutral-900 p-2">
            <div className="text-sm">{s.archetypeId}</div>
            <div className="mt-1 flex justify-between text-[11px] text-neutral-400">
              <span>commit {s.commitment.toFixed(1)}</span>
              <span>open {s.openness}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
