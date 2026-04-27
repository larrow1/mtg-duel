'use client';
import type { ClientCard } from './types-client';

interface Props {
  pack: string[];
  cubeByName: Map<string, ClientCard>;
  highlightName?: string | null;
  onPick: (name: string) => void;
  disabled?: boolean;
}

export function MockPackView({ pack, cubeByName, highlightName, onPick, disabled }: Props) {
  if (pack.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-8 text-center text-sm text-neutral-500">
        Pack is empty.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {pack.map((name) => {
        const c = cubeByName.get(name);
        const highlighted = highlightName === name;
        return (
          <button
            key={name}
            disabled={disabled}
            onClick={() => onPick(name)}
            title={name}
            className={`group relative overflow-hidden rounded-lg border bg-neutral-900 transition disabled:cursor-wait ${
              highlighted
                ? 'border-amber-400 ring-2 ring-amber-400/40'
                : 'border-neutral-800 hover:border-neutral-500'
            }`}
          >
            {c?.imageNormal ? (
              <img src={c.imageNormal} alt={name} className="w-full" />
            ) : (
              <div className="flex h-32 items-center justify-center p-2 text-xs text-neutral-400">
                {name}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-[11px]">
              <div className="truncate font-medium">{name}</div>
            </div>
            {highlighted && (
              <div className="absolute right-1 top-1 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                Claude pick
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
