'use client';

import type { Hit } from '@/lib/api';
import { resolveAssetUrl } from '@/lib/api';
import { uidCode } from '@/lib/atlas-data';

type Props = {
  hit: Hit | null;
  onOpen: () => void;
};

export default function SelectedPanel({ hit, onOpen }: Props) {
  if (!hit) {
    return (
      <div className="m-3 rounded-md border border-dashed border-ink-700/70 bg-ink-900/40 p-3">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-500">
          no marker selected
        </p>
        <p className="mt-1 text-[11px] text-ink-400">
          Click any marker in the atlas to inspect its category, uid, and open the live 3D viewer.
        </p>
      </div>
    );
  }

  const code = uidCode(hit.uid);

  return (
    <div className="m-3 overflow-hidden rounded-md border border-emerald-400/40 bg-gradient-to-b from-emerald-400/[0.08] to-transparent">
      <div className="flex items-center gap-2 border-b border-emerald-400/20 px-3 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
        <span className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-emerald-200">
          SELECTED · {code}
        </span>
        <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-400">
          locked
        </span>
      </div>

      <div className="flex gap-3 p-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm border border-ink-700 bg-ink-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveAssetUrl(hit.thumb_url)}
            alt={hit.category}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/60 to-transparent" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <div className="font-display text-[15px] leading-tight text-ink-100">
              {hit.category || 'untagged'}
            </div>
            <div className="mt-1 truncate font-mono text-[10px] text-ink-400" title={hit.uid}>
              uid · {hit.uid}
            </div>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-sm border border-ember-500/50 bg-ember-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ember-200 transition-colors hover:border-ember-400 hover:bg-ember-500/20 hover:text-ember-100"
          >
            open viewer
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
