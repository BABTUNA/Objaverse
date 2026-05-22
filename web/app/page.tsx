'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from '@/components/SearchBar';
import ResultGrid from '@/components/ResultGrid';
import SiteHeader from '@/components/SiteHeader';
import PillButton from '@/components/ui/PillButton';
import { checkHealth, search, type Hit } from '@/lib/api';

const ModelViewer = dynamic(() => import('@/components/ModelViewer'), { ssr: false });

type Status = 'idle' | 'loading' | 'success' | 'error' | 'empty';

export default function Page() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Hit | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkHealth().then((ok) => {
      if (!cancelled) setBackendUp(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setQuery(q);
    setStatus('loading');
    setError(null);
    const started = performance.now();
    try {
      const data = await search(q, 24, ctrl.signal);
      const ms = performance.now() - started;
      setLatencyMs(Math.round(ms));
      setHits(data.hits);
      setStatus(data.hits.length === 0 ? 'empty' : 'success');
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      setError((e as Error).message);
      setStatus('error');
    }
  }, []);

  const reset = () => {
    abortRef.current?.abort();
    setQuery('');
    setHits([]);
    setStatus('idle');
    setError(null);
    setLatencyMs(null);
  };

  if (status === 'idle') {
    return <Landing onSubmit={runSearch} backendUp={backendUp} />;
  }

  return (
    <main className="flex-1 flex flex-col">
      <SiteHeader
        onBrandClick={reset}
        right={
          <div className="ml-auto w-full max-w-xl">
            <SearchBar initial={query} onSubmit={runSearch} loading={status === 'loading'} compact />
          </div>
        }
      />

      <section className="mx-auto w-full max-w-7xl px-4 pt-6 pb-3 md:px-6">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tightest text-ink-100">
            Results for &ldquo;{query}&rdquo;
          </h2>
          <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.18em] text-ink-400">
            {status === 'success' && (
              <>
                <span>{hits.length} hits</span>
                {latencyMs != null && (
                  <>
                    <span className="text-ink-600">·</span>
                    <span>{latencyMs} ms</span>
                  </>
                )}
                <span className="text-ink-600">·</span>
                <span>ranked by cosine</span>
              </>
            )}
            {status === 'loading' && <span>searching…</span>}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 md:px-6">
        {status === 'error' && <ErrorState message={error ?? 'Unknown error'} onRetry={() => runSearch(query)} />}
        {status === 'empty' && <EmptyState query={query} onReset={reset} />}
        {(status === 'loading' || status === 'success') && (
          <ResultGrid hits={hits} loading={status === 'loading'} onOpen={setOpen} />
        )}
      </section>

      <ModelViewer hit={open} onClose={() => setOpen(null)} />
    </main>
  );
}

const SUGGESTED_CHIPS = ['viking helmet', 'art deco lamp', 'low-poly tree', 'medieval sword', 'porcelain teapot'];

function Landing({ onSubmit, backendUp }: { onSubmit: (q: string) => void; backendUp: boolean | null }) {
  // The landing wraps everything in a hero card — the reference's central
  // motif. Dashboards (atlas, perf) intentionally don't get this treatment
  // because their content demands full-bleed canvas.
  return (
    <main className="flex-1 flex flex-col px-3 py-3 md:px-5 md:py-5">
      <div className="hero-card relative flex flex-1 flex-col overflow-hidden rounded-[28px] md:rounded-[36px]">
        <SiteHeader
          bare
          right={<BackendStatus status={backendUp} />}
        />

        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-20 pt-6 md:pt-2">
          <div className="w-full max-w-2xl text-center animate-rise-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-ink-100/10 bg-white/55 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-ink-300 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-ember-500 animate-pulse-slow" />
              <span>46,128 models indexed</span>
              <span className="text-ink-500">·</span>
              <span>powered by daft</span>
            </div>

            <h1 className="font-display font-black tracking-[-0.035em] text-ink-100 text-balance leading-[1.02] text-[clamp(1.75rem,4vw,3rem)]">
              Search 3D by meaning,
              <br />
              not by filename.
            </h1>

            <p className="mx-auto mt-5 max-w-md text-balance text-sm md:text-base text-ink-400">
              Type what you imagine. We embed your words and surface the closest objects from a
              corpus of 46k 3D models.
            </p>

            <div className="mt-8">
              <SearchBar onSubmit={onSubmit} />
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-ink-400">try</span>
              {SUGGESTED_CHIPS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSubmit(s)}
                  className="rounded-full border border-ink-100/10 bg-white/55 px-3 py-1.5 text-xs font-medium text-ink-200 backdrop-blur-md transition-colors hover:border-ink-100/25 hover:text-ink-100"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <footer className="mt-20 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] font-mono uppercase tracking-[0.22em] text-ink-500">
            <span>clip vit-l/14 embeddings</span>
            <span className="text-ink-600">·</span>
            <span>cosine similarity</span>
            <span className="text-ink-600">·</span>
            <span>daft + lancedb</span>
          </footer>
        </div>
      </div>
    </main>
  );
}

function BackendStatus({ status }: { status: boolean | null }) {
  return (
    <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-ink-100/10 bg-white/55 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-ink-400 backdrop-blur-md">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status == null ? 'bg-ink-500' : status ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      />
      <span>{status == null ? 'checking api' : status ? 'api online' : 'api offline'}</span>
    </span>
  );
}

function EmptyState({ query, onReset }: { query: string; onReset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center text-center py-24 animate-rise-in">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-ink-100/10 bg-white/60 text-ink-300 backdrop-blur-md">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
          <path d="M11 8v3M11 14h.01" />
        </svg>
      </div>
      <h3 className="font-display text-3xl font-bold tracking-tightest text-ink-100">
        Nothing close to &ldquo;{query}&rdquo;
      </h3>
      <p className="mt-2 text-sm text-ink-300">
        Even 46k objects has gaps. Try a broader noun, or a vibe instead of a specific brand.
      </p>
      <div className="mt-6">
        <PillButton onClick={onReset} variant="primary" size="md">
          Start over
        </PillButton>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center text-center py-24 animate-rise-in">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-red-500/30 bg-red-500/5 text-red-500">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      </div>
      <h3 className="font-display text-3xl font-bold tracking-tightest text-ink-100">The index didn&apos;t answer</h3>
      <p className="mt-2 text-sm text-ink-300">
        {message}. Is the FastAPI server running on <span className="font-mono text-ink-100">:8000</span>?
      </p>
      <div className="mt-6">
        <PillButton onClick={onRetry} variant="primary" size="md">
          Try again
        </PillButton>
      </div>
    </div>
  );
}
