'use client';

import type { BenchmarkResults } from '@/lib/api';
import type { ReactNode } from 'react';

type Props = {
  results: BenchmarkResults;
};

export default function StatsGrid({ results }: Props) {
  const timeSaved = results.render.naive.elapsed_seconds - results.render.daft.elapsed_seconds;
  const workers = results.hardware.cpu_logical_cores;
  const gpu = results.hardware.gpu ?? 'CPU-only';

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-12 md:px-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-400">
          RUN READOUT
        </h3>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-500">
          {results.n_models.toLocaleString()} models × 2 strategies
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <PerfTile
          icon={<IconCube />}
          label="MODELS BENCHMARKED"
          value={results.n_models.toLocaleString()}
        />
        <PerfTile
          icon={<IconLightning />}
          label="DAFT THROUGHPUT"
          value={results.render.daft.throughput_models_per_sec.toFixed(2)}
          unit="/sec"
          tone="ember"
        />
        <PerfTile
          icon={<IconSnail />}
          label="NAIVE THROUGHPUT"
          value={results.render.naive.throughput_models_per_sec.toFixed(2)}
          unit="/sec"
        />
        <PerfTile
          icon={<IconClock />}
          label="TIME SAVED"
          value={formatSecondsCompact(timeSaved)}
          tone="emerald"
        />
        <PerfTile
          icon={<IconWorkers />}
          label="WORKERS"
          value={String(workers)}
          unit="threads"
        />
        <PerfTile
          icon={<IconChip />}
          label="ACCELERATOR"
          value={gpu}
          tone={results.hardware.gpu ? 'amber' : 'default'}
          compact
        />
      </div>
    </section>
  );
}

type Tone = 'default' | 'amber' | 'emerald' | 'ember';

const TONE_RING: Record<Tone, string> = {
  default: 'border-ink-700 bg-ink-900/60 text-ink-200',
  amber: 'border-amber-400/40 bg-amber-400/10 text-amber-700',
  emerald: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-700',
  ember: 'border-ember-500/40 bg-ember-500/10 text-ember-700',
};

const TONE_ICON: Record<Tone, string> = {
  default: 'text-ink-400',
  amber: 'text-amber-600',
  emerald: 'text-emerald-600',
  ember: 'text-ember-500',
};

const TONE_VALUE: Record<Tone, string> = {
  default: 'text-ink-100',
  amber: 'text-ink-100',
  emerald: 'text-ink-100',
  ember: 'text-ember-500',
};

function PerfTile({
  icon,
  label,
  value,
  unit,
  tone = 'default',
  compact = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  tone?: Tone;
  compact?: boolean;
}) {
  return (
    <div
      className={`group relative flex items-start gap-3 rounded-lg border px-4 py-3.5 backdrop-blur-md transition-colors ${TONE_RING[tone]}`}
    >
      <span
        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-ink-700/60 bg-ink-950/30 ${TONE_ICON[tone]}`}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-ink-400">
          {label}
        </span>
        <span
          className={`mt-1 truncate font-display tabular-nums ${
            compact ? 'text-[15px]' : 'text-2xl md:text-[28px]'
          } ${TONE_VALUE[tone]}`}
          title={value}
        >
          {value}
          {unit && (
            <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              {unit}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function formatSecondsCompact(s: number): string {
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const rem = s - m * 60;
    return `${m}m ${rem.toFixed(0)}s`;
  }
  return `${s.toFixed(1)}s`;
}

function IconCube() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="m3 7 9 5 9-5" />
      <path d="M12 12v10" />
    </svg>
  );
}

function IconLightning() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="m13 2-9 13h7l-1 7 9-13h-7l1-7Z" />
    </svg>
  );
}

function IconSnail() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="10" cy="14" r="6" />
      <circle cx="10" cy="14" r="2.5" />
      <path d="M16 14h4l-1.5-5.5a2 2 0 0 0-3.9.4L14 14" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconWorkers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconChip() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" />
    </svg>
  );
}
