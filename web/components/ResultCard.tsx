'use client';

import { useState } from 'react';
import type { Hit } from '@/lib/api';
import { resolveAssetUrl } from '@/lib/api';

type Props = {
  hit: Hit;
  index: number;
  onOpen: (hit: Hit) => void;
};

export default function ResultCard({ hit, index, onOpen }: Props) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const scorePct = Math.round(hit.score * 100);

  return (
    <button
      type="button"
      onClick={() => onOpen(hit)}
      style={{ animationDelay: `${Math.min(index, 18) * 22}ms` }}
      className="group relative flex flex-col rounded-xl border border-ink-700/80 bg-ink-900/60 grain-card overflow-hidden text-left animate-rise-in transition-all duration-300 hover:border-ember-500/50 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-12px_rgba(255,122,26,0.35)] focus:outline-none focus:ring-2 focus:ring-ember-500/60"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-ink-800">
        {!imgLoaded && !imgError && <div className="absolute inset-0 skeleton-shimmer" />}
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveAssetUrl(hit.thumb_url)}
            alt={hit.category}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`h-full w-full object-cover transition-all duration-500 ${
              imgLoaded ? 'opacity-100 scale-100 group-hover:scale-[1.04]' : 'opacity-0 scale-105'
            }`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-ink-400 text-xs">
            no thumbnail
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink-950/85 via-ink-950/30 to-transparent" />

        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md border border-ink-100/10 bg-ink-950/70 px-1.5 py-0.5 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-ember-500 animate-pulse-slow" />
          <span className="font-mono text-[10px] tracking-wider text-ink-200">
            {scorePct.toString().padStart(2, '0')}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-2.5">
          <span className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-ink-200">
            {hit.category || 'untagged'}
          </span>
          <span className="font-mono text-[10px] text-ink-400 opacity-0 transition-opacity group-hover:opacity-100">
            open →
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-ink-700/60 px-3 py-2">
        <span className="font-mono text-[10px] text-ink-400 truncate">
          {hit.uid.slice(0, 12)}
        </span>
        <span className="font-mono text-[10px] text-ink-300">
          d={(1 - hit.score).toFixed(3)}
        </span>
      </div>
    </button>
  );
}
