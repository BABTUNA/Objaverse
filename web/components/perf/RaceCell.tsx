'use client';

import { useEffect, useRef, useState } from 'react';
import { resolveAssetUrl } from '@/lib/api';

export type CellPhase = 'pending' | 'active' | 'done' | 'skipped' | 'empty';

type Props = {
  uid: string | null;
  phase: CellPhase;
};

// Flash window matches the spec (~250ms emerald ring on completion).
const FLASH_MS = 280;

export default function RaceCell({ uid, phase }: Props) {
  const [flash, setFlash] = useState(false);
  const prevPhase = useRef<CellPhase>(phase);

  useEffect(() => {
    // Flash only on the pending/active -> done transition. Reset flips
    // the phase back to pending without flashing.
    if (
      (prevPhase.current === 'pending' || prevPhase.current === 'active') &&
      phase === 'done'
    ) {
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), FLASH_MS);
      prevPhase.current = phase;
      return () => window.clearTimeout(t);
    }
    prevPhase.current = phase;
  }, [phase]);

  if (phase === 'empty') {
    return (
      <div
        aria-hidden
        className="relative aspect-square rounded-[3px] border border-dashed border-ink-700/40 bg-ink-900/20"
      />
    );
  }

  const borderCls =
    phase === 'done'
      ? flash
        ? 'border-emerald-500 ring-2 ring-emerald-500/40'
        : 'border-ink-700/80'
      : phase === 'skipped'
      ? 'border-red-500/40'
      : 'border-ink-700/70';

  const stub = uid ? uid.slice(0, 4) : '----';

  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-[3px] border bg-ink-900/40 transition-[border-color,box-shadow] duration-200 ${borderCls}`}
      title={uid ?? undefined}
    >
      {/* faint uid stub, fades when the thumbnail loads */}
      <span
        className={`pointer-events-none absolute inset-0 grid place-items-center font-mono text-[7.5px] tracking-[0.18em] text-ink-500/70 transition-opacity duration-200 ${
          phase === 'done' ? 'opacity-0' : 'opacity-90'
        }`}
      >
        {stub}
      </span>

      {phase === 'done' && uid && (
        <img
          src={resolveAssetUrl(`/thumb/${uid}`)}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-0 animate-fade-in"
          style={{ animationFillMode: 'forwards' }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      )}

      {phase === 'active' && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(110deg, transparent 30%, rgba(255,180,90,0.35) 50%, transparent 70%)',
            backgroundSize: '220% 100%',
            animation: 'shimmer 1s linear infinite',
          }}
        />
      )}

      {phase === 'skipped' && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center bg-red-500/12"
        >
          <svg viewBox="0 0 24 24" className="h-3/5 w-3/5 stroke-red-500/80" fill="none" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </span>
      )}
    </div>
  );
}
