'use client';

import Link from 'next/link';
import { Mark } from '@/components/SiteHeader';
import NavPill, { type NavItem } from '@/components/ui/NavPill';

type Props = {
  loading: boolean;
  ranAt: string | null;
};

const NAV: NavItem[] = [
  { href: '/', label: 'Search' },
  { href: '/atlas', label: 'Atlas' },
  { href: '/perf', label: 'Perf' },
];

export default function PerfTopBar({ loading, ranAt }: Props) {
  return (
    <header className="relative z-30 flex flex-wrap items-center gap-3 border-b border-ink-100/[0.06] bg-ink-950/70 px-4 py-3 backdrop-blur-md md:px-6">
      <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
        <Mark />
        <span className="font-display text-[15px] font-semibold tracking-tight text-ink-100">
          objaverse
        </span>
        <span className="hidden md:inline font-sans text-[10px] uppercase tracking-[0.24em] text-ink-400">
          performance benchmarks
        </span>
      </Link>

      <div className="hidden items-center gap-2 lg:flex">
        <StatusPill loading={loading} />
        <span className="font-sans text-[11px] text-ink-400">
          Daft thumbnail render — naive sequential vs distributed pipeline
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden sm:block">
          <NavPill items={NAV} />
        </div>

        {ranAt && (
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-ink-100/10 bg-white/50 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-400 backdrop-blur-md">
            <span className="h-1 w-1 rounded-full bg-ink-500" />
            captured {formatRelative(ranAt)}
          </span>
        )}
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
      {loading ? 'LOADING' : 'RESULTS CACHED'}
    </span>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}
