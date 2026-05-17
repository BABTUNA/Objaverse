'use client';

import Link from 'next/link';
import { Mark } from '@/components/SiteHeader';

type Props = {
  loading: boolean;
  ranAt: string | null;
};

export default function PerfTopBar({ loading, ranAt }: Props) {
  return (
    <header className="relative z-30 flex flex-wrap items-center gap-3 border-b border-ink-700/70 bg-ink-950/85 px-4 py-2.5 backdrop-blur-md md:px-6">
      <Link
        href="/"
        className="flex items-center gap-2 font-display text-base text-ink-100 transition-colors hover:text-ember-400"
      >
        <Mark />
        <span className="tracking-tight">objaverse</span>
        <span className="text-ember-500">/</span>
        <span className="font-sans text-[10px] uppercase tracking-[0.24em] text-ink-300">
          performance benchmarks
        </span>
      </Link>

      <div className="hidden items-center gap-2 lg:flex">
        <StatusPill loading={loading} />
        <span className="font-sans text-[11px] text-ink-400">
          Daft thumbnail render — naive sequential vs distributed pipeline
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <nav className="hidden sm:flex items-center gap-1 rounded-full border border-ink-700 bg-ink-900/60 p-0.5 text-[10px] font-mono uppercase tracking-[0.22em]">
          <NavPill href="/" label="search" active={false} />
          <NavPill href="/atlas" label="atlas" active={false} />
          <NavPill href="/perf" label="perf" active={true} />
        </nav>

        {ranAt && (
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-sm border border-ink-700 bg-ink-900/60 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-400">
            <span className="h-1 w-1 rounded-full bg-ink-500" />
            captured {formatRelative(ranAt)}
          </span>
        )}
      </div>
    </header>
  );
}

function NavPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return active ? (
    <span className="rounded-full bg-ember-500/15 px-3 py-1 text-ember-300">{label}</span>
  ) : (
    <Link
      href={href}
      className="rounded-full px-3 py-1 text-ink-400 transition-colors hover:text-ink-100"
    >
      {label}
    </Link>
  );
}

function StatusPill({ loading }: { loading: boolean }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.24em] ${
        loading
          ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
          : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          loading ? 'bg-amber-300 animate-pulse' : 'bg-emerald-300 animate-pulse'
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
