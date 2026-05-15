'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import SiteHeader from '@/components/SiteHeader';
import {
  AtlasUnavailableError,
  getAtlas,
  type AtlasPoint,
  type AtlasResponse,
  type Hit,
} from '@/lib/api';

const AtlasScene = dynamic(() => import('@/components/AtlasScene'), {
  ssr: false,
  loading: () => null,
});
const ModelViewer = dynamic(() => import('@/components/ModelViewer'), { ssr: false });

type Status = 'loading' | 'ready' | 'empty' | 'error';

type HoverState = { point: AtlasPoint; screen: { x: number; y: number } } | null;

export default function AtlasPage() {
  const [data, setData] = useState<AtlasResponse | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [emptyDetail, setEmptyDetail] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [hover, setHover] = useState<HoverState>(null);
  const [picked, setPicked] = useState<Hit | null>(null);
  const reqRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    reqRef.current?.abort();
    const ctrl = new AbortController();
    reqRef.current = ctrl;
    setStatus('loading');
    setError(null);
    setEmptyDetail(null);
    try {
      const atlas = await getAtlas(ctrl.signal);
      setData(atlas);
      setStatus(atlas.points.length === 0 ? 'empty' : 'ready');
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      if (e instanceof AtlasUnavailableError) {
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

  const onPick = useCallback((p: AtlasPoint) => {
    // Synthesize a Hit so ModelViewer renders the GLB. Score is faux; the
    // viewer only uses it for badge text.
    setPicked({
      uid: p.uid,
      category: p.category,
      score: 1,
      thumb_url: p.thumb_url,
      glb_url: `/model/${p.uid}`,
    });
  }, []);

  const count = data?.count ?? 0;
  const visibleCap = data ? Math.min(data.points.length, 500) : 0;
  const showCapNote = data ? data.points.length > 500 : false;

  return (
    <main className="relative h-screen flex flex-col overflow-hidden">
      <SiteHeader
        floating
        right={
          <div className="ml-auto flex flex-col items-end gap-2">
            <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.22em] text-ink-300">
              <span className="h-1.5 w-1.5 rounded-full bg-ember-500 animate-pulse-slow" />
              <span>{count.toLocaleString()} models</span>
              <span className="text-ink-600">·</span>
              <span>clip vit-l/14</span>
              <span className="text-ink-600">·</span>
              <span>umap</span>
            </div>
            <div className="pointer-events-auto w-64">
              <CategoryFilter value={filter} onChange={setFilter} disabled={status !== 'ready'} />
            </div>
          </div>
        }
      />

      <div className="relative flex-1 min-h-0">
        {status === 'ready' && data && (
          <AtlasScene
            points={data.points}
            filter={filter}
            onPick={onPick}
            onHover={setHover}
          />
        )}

        {status === 'loading' && <LoadingOverlay />}
        {status === 'empty' && <EmptyState detail={emptyDetail} />}
        {status === 'error' && <ErrorOverlay message={error ?? 'Unknown error'} onRetry={load} />}

        {hover && <HoverLabel hover={hover} />}

        {status === 'ready' && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            <span>drag · orbit  ·  scroll · zoom  ·  click a sprite to inspect</span>
            <span>
              {visibleCap.toLocaleString()} sprites
              {showCapNote && <> · {(count - visibleCap).toLocaleString()} as dust</>}
            </span>
          </div>
        )}
      </div>

      <ModelViewer hit={picked} onClose={() => setPicked(null)} />
    </main>
  );
}

function CategoryFilter({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="relative flex items-center rounded-lg border border-ink-700 bg-ink-900/80 backdrop-blur-md transition-colors focus-within:border-ember-500/60">
      <span className="pl-3 pr-1.5 text-ink-500">
        <FilterIcon />
      </span>
      <input
        type="text"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="filter categories…"
        className="flex-1 bg-transparent py-1.5 pr-3 text-xs text-ink-100 placeholder:text-ink-500 focus:outline-none disabled:opacity-50"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="mr-1.5 rounded p-1 text-ink-400 hover:text-ember-400"
          aria-label="clear filter"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function HoverLabel({ hover }: { hover: NonNullable<HoverState> }) {
  const { point, screen } = hover;
  return (
    <div
      className="pointer-events-none fixed z-40 flex items-center gap-2 rounded-md border border-ink-700 bg-ink-950/90 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-200 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.8)] backdrop-blur-sm animate-fade-in"
      style={{ left: screen.x + 14, top: screen.y + 14 }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-ember-500" />
      <span>{point.category || 'untagged'}</span>
      <span className="text-ink-600">·</span>
      <span className="text-ink-400">{point.uid.slice(0, 8)}</span>
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="flex flex-col items-center gap-3 text-[11px] font-mono uppercase tracking-[0.22em] text-ink-400">
        <span className="flex h-2 w-2 rounded-full bg-ember-500 animate-pulse-slow" />
        <span>loading atlas…</span>
      </div>
    </div>
  );
}

function EmptyState({ detail }: { detail: string | null }) {
  return (
    <div className="absolute inset-0 grid place-items-center px-6">
      <div className="max-w-md rounded-2xl border border-ink-700 bg-ink-900/70 p-6 text-center backdrop-blur-md animate-rise-in">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-ember-500/40 bg-ember-500/10 text-ember-300">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
          </svg>
        </div>
        <h3 className="font-display text-2xl text-ink-100">Atlas hasn&rsquo;t been built yet</h3>
        <p className="mt-2 text-sm text-ink-300">
          {detail ?? 'The UMAP projection is missing.'} Run the projector to generate it:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-ink-700 bg-ink-950/80 px-3 py-2 text-left font-mono text-[12px] text-ember-300">
          objaverse-search project
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
    <div className="absolute inset-0 grid place-items-center px-6">
      <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center backdrop-blur-md animate-rise-in">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-red-500/30 bg-red-500/5 text-red-400">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <h3 className="font-display text-2xl text-ink-100">The atlas didn&rsquo;t load</h3>
        <p className="mt-2 text-sm text-ink-300">
          {message}. Is the FastAPI server running on <span className="font-mono text-ink-100">:8000</span>?
        </p>
        <button
          onClick={onRetry}
          className="mt-5 rounded-xl bg-ember-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-ember-400 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 5h18l-7 8v6l-4-2v-4z" />
    </svg>
  );
}

