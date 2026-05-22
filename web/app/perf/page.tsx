'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BenchmarksUnavailableError,
  getBenchmarks,
  type BenchmarkResults,
} from '@/lib/api';
import PerfTopBar from '@/components/perf/PerfTopBar';
import HardwareBanner from '@/components/perf/HardwareBanner';
import PillButton from '@/components/ui/PillButton';
import HeroSpeedup from '@/components/perf/HeroSpeedup';
import ComparisonBars from '@/components/perf/ComparisonBars';
import RaceReplay from '@/components/perf/RaceReplay';
import StatsGrid from '@/components/perf/StatsGrid';

type Status = 'loading' | 'ready' | 'empty' | 'error';

export default function PerfPage() {
  const [data, setData] = useState<BenchmarkResults | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [emptyDetail, setEmptyDetail] = useState<string | null>(null);
  const reqRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    reqRef.current?.abort();
    const ctrl = new AbortController();
    reqRef.current = ctrl;
    setStatus('loading');
    setError(null);
    setEmptyDetail(null);
    try {
      const r = await getBenchmarks(ctrl.signal);
      setData(r);
      setStatus('ready');
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      if (e instanceof BenchmarksUnavailableError) {
        setEmptyDetail(e.detail);
        setStatus('empty');
        return;
      }
      setError((e as Error).message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="relative flex min-h-screen flex-col bg-ink-950">
      <PerfTopBar loading={status === 'loading'} ranAt={data?.ran_at ?? null} />

      {status === 'ready' && data && (
        <div className="pb-24">
          <HardwareBanner hardware={data.hardware} ranAt={data.ran_at} />
          <HeroSpeedup speedupX={data.render.speedup_x} nModels={data.n_models} />
          <ComparisonBars
            naive={data.render.naive}
            daft={data.render.daft}
            speedupX={data.render.speedup_x}
          />
          {hasPerModelTimings(data) && (
            <RaceReplay naive={data.render.naive} daft={data.render.daft} />
          )}
          <StatsGrid results={data} />
        </div>
      )}

      {status === 'loading' && <LoadingOverlay />}
      {status === 'empty' && <EmptyState detail={emptyDetail} />}
      {status === 'error' && <ErrorOverlay message={error ?? 'Unknown error'} onRetry={load} />}

      {status === 'ready' && <FooterStrip />}
    </main>
  );
}

function hasPerModelTimings(data: BenchmarkResults): boolean {
  const n = data.render.naive.per_model;
  const d = data.render.daft.per_model;
  return Array.isArray(n) && Array.isArray(d) && n.length > 0 && d.length > 0;
}

function FooterStrip() {
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex items-center justify-between px-4 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-500 md:px-6">
        <span>benchmark snapshot · captured locally · persisted to disk</span>
        <span className="hidden md:inline">share-friendly · drop into a slide deck</span>
      </div>

      <div className="pointer-events-none fixed right-4 bottom-10 z-10 flex flex-col items-end gap-1.5">
        <CornerStatus label="BENCH SCHEMA v1" tone="emerald" />
        <CornerStatus label="RESULTS CACHED" tone="amber" />
        <CornerStatus label="DAFT PIPELINE" tone="ember" />
      </div>
    </>
  );
}

function CornerStatus({
  label,
  tone,
}: {
  label: string;
  tone: 'emerald' | 'amber' | 'ember';
}) {
  const cls =
    tone === 'emerald'
      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
      : tone === 'amber'
      ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
      : 'border-ember-500/40 bg-ember-500/10 text-ember-200';
  const dot =
    tone === 'emerald'
      ? 'bg-emerald-300'
      : tone === 'amber'
      ? 'bg-amber-300'
      : 'bg-ember-400';
  return (
    <span
      className={`flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.24em] backdrop-blur-md ${cls}`}
    >
      <span className={`h-1 w-1 rounded-full ${dot} animate-pulse`} />
      {label}
    </span>
  );
}

function LoadingOverlay() {
  return (
    <div className="grid flex-1 place-items-center">
      <div className="flex flex-col items-center gap-3 text-[11px] font-mono uppercase tracking-[0.22em] text-ink-400">
        <span className="flex h-2 w-2 rounded-full bg-ember-500 animate-pulse-slow" />
        <span>loading benchmarks…</span>
      </div>
    </div>
  );
}

function EmptyState({ detail }: { detail: string | null }) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-16">
      <div className="max-w-md rounded-2xl border border-ink-700 bg-ink-900/70 p-6 text-center backdrop-blur-md animate-rise-in">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-ember-500/40 bg-ember-500/10 text-ember-500">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 3v18h18" />
            <path d="m7 14 4-4 4 4 5-7" />
          </svg>
        </div>
        <h3 className="font-display text-2xl font-bold tracking-tightest text-ink-100">No benchmarks yet</h3>
        <p className="mt-2 text-sm text-ink-300">
          {detail ?? 'No benchmark results have been recorded.'} Run the bench to populate this page:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-ink-700 bg-ink-950/80 px-3 py-2 text-left font-mono text-[12px] text-ember-500">
          objaverse-search bench
        </pre>
        <p className="mt-3 text-[10px] font-mono uppercase tracking-[0.22em] text-ink-500">
          then refresh this page
        </p>
      </div>
    </div>
  );
}

function ErrorOverlay({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-16">
      <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center backdrop-blur-md animate-rise-in">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-red-500/30 bg-red-500/5 text-red-500">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <h3 className="font-display text-2xl font-bold tracking-tightest text-ink-100">The benchmarks didn&rsquo;t load</h3>
        <p className="mt-2 text-sm text-ink-300">
          {message}. Is the FastAPI server running on{' '}
          <span className="font-mono text-ink-100">:8000</span>?
        </p>
        <div className="mt-5 inline-flex">
          <PillButton onClick={onRetry} variant="primary" size="sm">
            Try again
          </PillButton>
        </div>
      </div>
    </div>
  );
}
