'use client';

import type { RecentPick } from '@/lib/atlas-data';
import { formatTimestamp, uidCode } from '@/lib/atlas-data';

type Props = {
  picks: RecentPick[];
  onReplay: (pick: RecentPick) => void;
};

export default function RecentPicks({ picks, onReplay }: Props) {
  return (
    <div className="border-t border-ink-700/70">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="grid h-3.5 w-3.5 place-items-center rounded-sm border border-ember-500/40 bg-ember-500/10 text-ember-300">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M12 6v6l4 2" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-ink-300">
            INSPECTION TRAIL
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
          {picks.length} event{picks.length === 1 ? '' : 's'}
        </span>
      </div>

      <ol className="scrollbar-thin max-h-[36vh] overflow-y-auto px-2 pb-3">
        {picks.length === 0 && (
          <li className="px-3 py-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            awaiting first pick…
          </li>
        )}
        {picks.map((p, i) => {
          const num = picks.length - i;
          const isHead = i === 0;
          return (
            <li key={`${p.uid}-${p.pickedAt}`} className="relative pl-6">
              <span
                aria-hidden
                className={`absolute left-3 top-3 bottom-0 w-px ${
                  i === picks.length - 1 ? 'bg-transparent' : 'bg-ink-700/60'
                }`}
              />
              <span
                className={`absolute left-1 top-2 grid h-4 w-4 place-items-center rounded-full border font-mono text-[8px] tabular-nums ${
                  isHead
                    ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200'
                    : 'border-ink-600 bg-ink-900 text-ink-300'
                }`}
              >
                {num}
              </span>
              <button
                type="button"
                onClick={() => onReplay(p)}
                className="group my-1 flex w-full items-center gap-2 rounded-sm border border-ink-700/60 bg-ink-900/60 px-2 py-1.5 text-left transition-colors hover:border-ember-500/40 hover:bg-ink-800/70"
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
                  {uidCode(p.uid)}
                </span>
                <span className="flex-1 truncate font-mono text-[10.5px] text-ink-200">
                  {p.category || 'untagged'}
                </span>
                <span className="font-mono text-[9px] tabular-nums text-ink-500">
                  {formatTimestamp(p.pickedAt)}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="text-ink-500 group-hover:text-ember-400">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
