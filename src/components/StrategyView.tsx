'use client';
import type { ClientCard } from './types-client';

export interface StrategyOverviewClient {
  archetype: string;
  gameplan: string;
  winConditions: string[];
  curveNotes: string;
  watchOuts: string[];
  mulliganGuidance: string;
  keyCards: string[];
}

interface Props {
  strategy: StrategyOverviewClient;
  cubeByName: Map<string, ClientCard>;
}

export function StrategyView({ strategy, cubeByName }: Props) {
  return (
    <div className="space-y-5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
          Strategy briefing
        </div>
        <h2 className="mt-1 text-2xl font-bold">{strategy.archetype}</h2>
        <p className="mt-2 text-neutral-200">{strategy.gameplan}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Win conditions">
          <ul className="space-y-1 text-sm">
            {strategy.winConditions.map((w, i) => (
              <li key={i} className="text-neutral-200">
                • {w}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Watch out for">
          <ul className="space-y-1 text-sm">
            {strategy.watchOuts.map((w, i) => (
              <li key={i} className="text-neutral-200">
                • {w}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Curve notes">
          <p className="text-sm text-neutral-200">{strategy.curveNotes}</p>
        </Section>

        <Section title="Mulligan guidance">
          <p className="text-sm text-neutral-200">{strategy.mulliganGuidance}</p>
        </Section>
      </div>

      <Section title="Key cards">
        <div className="flex flex-wrap gap-2">
          {strategy.keyCards.map((name) => {
            const c = cubeByName.get(name);
            return (
              <div
                key={name}
                className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-black/40 px-2 py-1"
              >
                {c?.imageSmall && (
                  <img src={c.imageSmall} alt={name} className="h-8 w-auto rounded-sm" loading="lazy" />
                )}
                <span className="text-sm">{name}</span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-300/80">
        {title}
      </div>
      {children}
    </div>
  );
}
