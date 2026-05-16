'use client';

import { useMemo } from 'react';
import type { CategoryStat } from '@/lib/atlas-data';
import { hueToHex } from '@/lib/atlas-data';

type Props = {
  categories: CategoryStat[];
  filter: string;
  selected: Set<string>;
  onToggle: (name: string) => void;
  onClear: () => void;
  total: number;
};

export default function CategoryList({
  categories,
  filter,
  selected,
  onToggle,
  onClear,
  total,
}: Props) {
  const normalized = filter.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!normalized) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(normalized));
  }, [categories, normalized]);

  const hidden = categories.length - visible.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-ink-700/70 px-3 py-2">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-ink-400">
          CATEGORIES · {visible.length}/{categories.length}
        </span>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ember-400 hover:text-ember-300"
          >
            clear ({selected.size})
          </button>
        )}
      </div>
      <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {visible.map((c) => {
          const isOn = selected.has(c.name);
          const pct = total > 0 ? (c.count / total) * 100 : 0;
          return (
            <li key={c.name}>
              <button
                type="button"
                onClick={() => onToggle(c.name)}
                className={`group relative flex w-full items-center gap-2 border-l-2 px-3 py-1.5 text-left transition-colors ${
                  isOn
                    ? 'border-emerald-400/70 bg-emerald-400/5'
                    : 'border-transparent hover:border-ember-500/40 hover:bg-ink-800/50'
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full ring-2 ring-ink-950"
                  style={{ background: hueToHex(c.hue) }}
                />
                <span
                  className={`flex-1 truncate font-mono text-[11px] tracking-tight ${
                    isOn ? 'text-emerald-200' : 'text-ink-200 group-hover:text-ink-100'
                  }`}
                >
                  {c.name || 'untagged'}
                </span>
                <span className="font-mono text-[9.5px] tabular-nums text-ink-400">
                  {c.count.toLocaleString()}
                </span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-ink-700/40 to-transparent"
                  style={{ clipPath: `inset(0 ${100 - pct * 2}% 0 0)` }}
                />
              </button>
            </li>
          );
        })}
        {hidden > 0 && (
          <li className="px-3 py-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-500">
            {hidden} hidden by filter
          </li>
        )}
        {visible.length === 0 && (
          <li className="px-3 py-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            no matches
          </li>
        )}
      </ul>
    </div>
  );
}
