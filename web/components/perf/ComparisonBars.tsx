'use client';

import { useEffect, useState } from 'react';
import type { BenchmarkRunSummary } from '@/lib/api';
import CornerBrackets from '@/components/perf/CornerBrackets';

type Props = {
  naive: BenchmarkRunSummary;
  daft: BenchmarkRunSummary;
  speedupX: number;
};

export default function ComparisonBars({ naive, daft, speedupX }: Props) {
  const [mounted, setMounted] = useState(false);

  // Single-fire animation: bars only sweep in on first paint, not on every parent re-render.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const longest = Math.max(naive.elapsed_seconds, daft.elapsed_seconds, 0.001);
  const naivePct = mounted ? (naive.elapsed_seconds / longest) * 100 : 0;
  const daftPct = mounted ? (daft.elapsed_seconds / longest) * 100 : 0;

  return (
    <section className="relative mx-auto w-full max-w-5xl px-4 pb-12 md:px-6">
      <div className="relative rounded-2xl border border-ink-700/70 bg-ink-900/40 p-5 backdrop-blur-md md:p-7">
        <ScanlineGrid />
        <CornerBrackets />

        <div className="relative flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-700/60 pb-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-400">
            RENDER PIPELINE — WALL CLOCK
          </h2>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-500">
            seconds elapsed · lower is better
          </span>
        </div>

        <div className="relative mt-6 flex flex-col gap-7">
          <Bar
            label="NAIVE"
            tone="naive"
            widthPct={naivePct}
            seconds={naive.elapsed_seconds}
            throughput={naive.throughput_models_per_sec}
            note="sequential for-loop · single worker"
          />
          <Bar
            label="DAFT"
            tone="daft"
            widthPct={daftPct}
            seconds={daft.elapsed_seconds}
            throughput={daft.throughput_models_per_sec}
            note="dataframe pipeline · parallel execution"
          />
        </div>

        <div className="relative mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-ink-700/60 pt-3">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-500">
            delta · {(naive.elapsed_seconds - daft.elapsed_seconds).toFixed(1)}s reclaimed
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-ember-500">
            <span className="h-1 w-1 rounded-full bg-ember-500" />
            speedup {speedupX.toFixed(1)}×
          </span>
        </div>
      </div>
    </section>
  );
}

function Bar({
  label,
  tone,
  widthPct,
  seconds,
  throughput,
  note,
}: {
  label: string;
  tone: 'naive' | 'daft';
  widthPct: number;
  seconds: number;
  throughput: number;
  note: string;
}) {
  const text = tone === 'daft' ? 'text-ember-500' : 'text-ink-400';
  const dot = tone === 'daft' ? 'bg-ember-500' : 'bg-ink-500';

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.28em] ${text}`}>
            {label}
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-500">
            {note}
          </span>
        </div>
        <span className={`font-mono text-[11px] tabular-nums ${text}`}>
          {formatSeconds(seconds)}
          <span className="text-ink-500"> · </span>
          {throughput.toFixed(2)} models/sec
        </span>
      </div>
      <div className="relative h-10 w-full overflow-hidden rounded-sm border border-ink-700/60 bg-ink-900/60">
        {/* faint hatch under the bar so the "empty" zone reads as instrumented */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(22,19,16,0.18) 0 1px, transparent 1px 8px)',
          }}
        />
        <svg
          className="absolute inset-y-0 left-0 h-full"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          style={{
            width: `${widthPct}%`,
            transition: 'width 900ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          <defs>
            <linearGradient id={`grad-${tone}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={tone === 'daft' ? '#ff7a1a' : '#7e7561'} stopOpacity="0.7" />
              <stop offset="100%" stopColor={tone === 'daft' ? '#ff7a1a' : '#7e7561'} stopOpacity="1" />
            </linearGradient>
          </defs>
          <rect width="100" height="40" fill={`url(#grad-${tone})`} />
          {/* leading-edge crisp tick to give the bar a "live capture" feel */}
          <rect width="0.6" height="40" x="99.4" fill="#161310" opacity="0.35" />
        </svg>
        {/* axis ticks */}
        <div aria-hidden className="absolute inset-y-0 right-0 flex w-full pointer-events-none">
          {[0.25, 0.5, 0.75].map((t) => (
            <span
              key={t}
              className="absolute top-0 h-full w-px bg-ink-700/40"
              style={{ left: `${t * 100}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScanlineGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.22]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,122,26,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,122,26,0.04) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    />
  );
}

function formatSeconds(s: number): string {
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const rem = s - m * 60;
    return `${m}m ${rem.toFixed(1)}s`;
  }
  return `${s.toFixed(1)}s`;
}
