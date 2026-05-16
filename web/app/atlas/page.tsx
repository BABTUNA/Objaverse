'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AtlasUnavailableError,
  getAtlas,
  type AtlasPoint,
  type AtlasResponse,
  type Hit,
} from '@/lib/api';
import { buildCategoryStats, type RecentPick } from '@/lib/atlas-data';
import DashboardTopBar from '@/components/atlas/DashboardTopBar';
import DashboardSidebar from '@/components/atlas/DashboardSidebar';
import HoverTooltip from '@/components/atlas/HoverTooltip';

const AtlasScene = dynamic(() => import('@/components/AtlasScene'), {
  ssr: false,
  loading: () => null,
});
const ModelViewer = dynamic(() => import('@/components/ModelViewer'), { ssr: false });

type Status = 'loading' | 'ready' | 'empty' | 'error';
type HoverState = { point: AtlasPoint; screen: { x: number; y: number } } | null;

const RECENT_CAP = 8;

export default function AtlasPage() {
  const [data, setData] = useState<AtlasResponse | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [emptyDetail, setEmptyDetail] = useState<string | null>(null);

  const [filter, setFilter] = useState('');
  const [lockedCategories, setLockedCategories] = useState<Set<string>>(new Set());

  const [hover, setHover] = useState<HoverState>(null);
  const [selected, setSelected] = useState<Hit | null>(null);
  const [viewerHit, setViewerHit] = useState<Hit | null>(null);
  const [recent, setRecent] = useState<RecentPick[]>([]);

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
    const hit: Hit = {
      uid: p.uid,
      category: p.category,
      score: 1,
      thumb_url: p.thumb_url,
      glb_url: `/model/${p.uid}`,
    };
    setSelected(hit);
    setRecent((prev) => {
      const dedup = prev.filter((r) => r.uid !== p.uid);
      const next: RecentPick = {
        uid: p.uid,
        category: p.category,
        thumb_url: p.thumb_url,
        pickedAt: Date.now(),
      };
      return [next, ...dedup].slice(0, RECENT_CAP);
    });
  }, []);

  const onToggleCategory = useCallback((name: string) => {
    setLockedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const onClearCategories = useCallback(() => setLockedCategories(new Set()), []);

  const onReplay = useCallback(
    (r: RecentPick) => {
      const hit: Hit = {
        uid: r.uid,
        category: r.category,
        score: 1,
        thumb_url: r.thumb_url,
        glb_url: `/model/${r.uid}`,
      };
      setSelected(hit);
      setViewerHit(hit);
    },
    [],
  );

  const onOpenSelected = useCallback(() => {
    if (selected) setViewerHit(selected);
  }, [selected]);

  const categories = useMemo(() => (data ? buildCategoryStats(data.points) : []), [data]);
  const count = data?.count ?? 0;

  const visibleCount = useMemo(() => {
    if (!data) return 0;
    const norm = filter.trim().toLowerCase();
    if (!norm && lockedCategories.size === 0) return data.points.length;
    let n = 0;
    for (const p of data.points) {
      const cat = p.category.toLowerCase();
      const passSubstring = !norm || cat.includes(norm);
      const passLocked = lockedCategories.size === 0 || lockedCategories.has(p.category);
      if (passSubstring && passLocked) n++;
    }
    return n;
  }, [data, filter, lockedCategories]);

  return (
    <main className="h-screen flex flex-col bg-ink-950 overflow-hidden">
      <DashboardTopBar count={count} categoryCount={categories.length} loading={status === 'loading'} />

      <div className="flex flex-1 min-h-0">
        <DashboardSidebar
          totalPoints={count}
          categories={categories}
          filter={filter}
          onFilterChange={setFilter}
          selectedCategories={lockedCategories}
          onToggleCategory={onToggleCategory}
          onClearCategories={onClearCategories}
          selected={selected}
          onOpenSelected={onOpenSelected}
          recent={recent}
          onReplay={onReplay}
          status={status}
          visibleCount={visibleCount}
        />

        <div className="relative flex-1 min-h-0">
          {/* Decorative scanline grid behind the canvas — adds the mission-control texture without affecting the 3D scene's framing */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,122,26,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,122,26,0.04) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
            }}
          />

          {/* Corner brackets — pure decoration to frame the viewport like the reference */}
          <CornerBrackets />

          {status === 'ready' && data && (
            <AtlasScene
              points={data.points}
              filter={filter}
              lockedCategories={lockedCategories}
              selectedUid={selected?.uid ?? null}
              onPick={onPick}
              onHover={setHover}
            />
          )}

          {status === 'loading' && <LoadingOverlay />}
          {status === 'empty' && <EmptyState detail={emptyDetail} />}
          {status === 'error' && <ErrorOverlay message={error ?? 'Unknown error'} onRetry={load} />}

          {hover && <HoverTooltip point={hover.point} screen={hover.screen} />}

          {/* Bottom instruction strip */}
          {status === 'ready' && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-4 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-500">
              <span>drag · orbit  ·  scroll · zoom  ·  click a marker to inspect</span>
              <span>
                {visibleCount.toLocaleString()} / {count.toLocaleString()} markers illuminated
              </span>
            </div>
          )}

          {/* Bottom-right status pills — match reference's "SYSTEM ACTIVE" cluster */}
          {status === 'ready' && (
            <div className="pointer-events-none absolute right-4 bottom-10 flex flex-col items-end gap-1.5">
              <CornerStatus label="INDEX READY" tone="emerald" />
              <CornerStatus label="GPU ATTACHED" tone="amber" />
              <CornerStatus label="UMAP STABLE" tone="ember" />
            </div>
          )}
        </div>
      </div>

      <ModelViewer hit={viewerHit} onClose={() => setViewerHit(null)} />
    </main>
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

function CornerBrackets() {
  const corner = 'absolute h-4 w-4 border-ember-500/50';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-3">
      <span className={`${corner} left-0 top-0 border-l border-t`} />
      <span className={`${corner} right-0 top-0 border-r border-t`} />
      <span className={`${corner} left-0 bottom-0 border-l border-b`} />
      <span className={`${corner} right-0 bottom-0 border-r border-b`} />
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="flex flex-col items-center gap-3 text-[11px] font-mono uppercase tracking-[0.22em] text-ink-400">
        <span className="flex h-2 w-2 rounded-full bg-ember-500 animate-pulse-slow" />
        <span>indexing atlas…</span>
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
