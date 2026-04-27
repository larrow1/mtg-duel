'use client';
import { useEffect, useRef, useState } from 'react';
import type { ClientCard } from './types-client';

interface Props {
  cube: ClientCard[];
  exclude: Set<string>;
  onPick: (name: string) => void;
  placeholder?: string;
}

function colorBadge(ci: string[]): string {
  if (ci.length === 0) return 'bg-neutral-700';
  if (ci.length > 1) return 'bg-amber-600';
  return {
    W: 'bg-yellow-200 text-black',
    U: 'bg-blue-400 text-black',
    B: 'bg-neutral-900 text-white border border-neutral-600',
    R: 'bg-red-500 text-black',
    G: 'bg-green-500 text-black',
  }[ci[0]] ?? 'bg-neutral-700';
}

export function CardSearch({ cube, exclude, onPick, placeholder }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = q.length === 0
    ? []
    : cube
        .filter((c) => !exclude.has(c.name) && c.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 12);

  useEffect(() => setHighlight(0), [q]);

  function commit(name: string) {
    onPick(name);
    setQ('');
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter' && matches[highlight]) {
            e.preventDefault();
            commit(matches[highlight].name);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder={placeholder ?? 'Type a card name…'}
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-neutral-700 bg-neutral-900 shadow-xl">
          {matches.map((c, i) => (
            <li
              key={c.name}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(c.name);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                i === highlight ? 'bg-neutral-800' : ''
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${colorBadge(c.colorIdentity)}`} />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-xs text-neutral-500">{c.typeLine.split(' — ')[0]}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  c.powerTier === 'S' ? 'bg-amber-500 text-black'
                    : c.powerTier === 'A' ? 'bg-emerald-600'
                    : c.powerTier === 'B' ? 'bg-neutral-600'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {c.powerTier}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
