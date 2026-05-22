'use client';

import Link from 'next/link';
import { Mark } from '@/components/SiteHeader';
import NavPill, { type NavItem } from '@/components/ui/NavPill';
import MetricTile from '@/components/atlas/MetricTile';

type Props = {
  count: number;
  categoryCount: number;
  loading: boolean;
};

const NAV: NavItem[] = [
  { href: '/', label: 'Search' },
  { href: '/atlas', label: 'Atlas' },
  { href: '/perf', label: 'Perf' },
];

export default function DashboardTopBar({ count, categoryCount, loading }: Props) {
  const fmt = (n: number) => n.toLocaleString();

  return (
    <header className="relative z-30 flex flex-wrap items-center gap-3 border-b border-ink-100/[0.06] bg-ink-950/70 px-4 py-3 backdrop-blur-md md:px-6">
      <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
        <Mark />
        <span className="font-display text-[15px] font-semibold tracking-tight text-ink-100">
          objaverse
        </span>
        <span className="hidden md:inline font-sans text-[10px] uppercase tracking-[0.24em] text-ink-400">
          latent atlas
        </span>
      </Link>

      <div className="hidden items-center gap-2 lg:flex">
        <StatusPill loading={loading} />
        <span className="font-sans text-[11px] text-ink-400">
          UMAP projection of <span className="text-ink-200">{fmt(count)}</span> CLIP-Vit-L/14 embeddings
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden sm:block">
          <NavPill items={NAV} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <MetricTile icon={<IconCube />} value={fmt(count)} label="MODELS" tone="ember" />
          <MetricTile icon={<IconLayers />} value="768" label="DIMS" />
          <MetricTile icon={<IconTag />} value={fmt(categoryCount)} label="CATEGORIES" />
          <MetricTile icon={<IconCheck />} value="100%" label="INDEXED" tone="emerald" />
          <MetricTile icon={<IconEye />} value="8" label="VIEWS / MODEL" />
          <MetricTile icon={<IconBolt />} value="~1ms" label="QUERY" tone="amber" />
        </div>
      </div>
    </header>
  );
}

function StatusPill({ loading }: { loading: boolean }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.24em] ${
        loading
          ? 'border-amber-400/40 bg-amber-400/10 text-amber-700'
          : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-700'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'
        }`}
      />
      {loading ? 'INDEXING' : 'LIVE INDEX'}
    </span>
  );
}

function IconCube() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="m3 7 9 5 9-5" />
      <path d="M12 12v10" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
      <path d="m3 18 9 5 9-5" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="m13 2-9 13h7l-1 7 9-13h-7l1-7Z" />
    </svg>
  );
}
