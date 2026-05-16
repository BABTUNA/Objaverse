'use client';

import type { AtlasPoint } from '@/lib/api';
import { uidCode } from '@/lib/atlas-data';

type Props = {
  point: AtlasPoint;
  screen: { x: number; y: number };
};

export default function HoverTooltip({ point, screen }: Props) {
  const code = uidCode(point.uid);
  return (
    <div
      className="pointer-events-none fixed z-40 animate-fade-in"
      style={{ left: screen.x + 18, top: screen.y - 8 }}
    >
      <div className="relative">
        {/* Connector line — small dash from cursor to label, evokes the map-tooltip leader line in the reference */}
        <span
          aria-hidden
          className="absolute -left-3 top-1/2 h-px w-3 bg-emerald-300/80"
        />
        <div className="flex flex-col rounded-sm border border-emerald-400/60 bg-ink-950/95 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.9)] backdrop-blur-md">
          <div className="flex items-center gap-1.5 border-b border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5">
            <span className="h-1 w-1 rounded-full bg-emerald-300" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
              {code}
            </span>
          </div>
          <div className="px-2 py-1">
            <div className="font-display text-[12px] leading-tight text-ink-50">
              {point.category || 'untagged'}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-400">
              {point.uid.slice(0, 10)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
