'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';
import NavPill, { type NavItem } from '@/components/ui/NavPill';

type Props = {
  /** Optional slot rendered on the right of the header (search bar, stats, etc.). */
  right?: ReactNode;
  /** When the header sits over a Canvas, drop the bottom border so it blends. */
  floating?: boolean;
  /** Drop sticky/border chrome — used when embedded inside the hero card surface. */
  bare?: boolean;
  /** Overrides the brand-mark click. When set, the brand becomes a button. */
  onBrandClick?: () => void;
};

const NAV: NavItem[] = [
  { href: '/', label: 'Search' },
  { href: '/atlas', label: 'Atlas' },
  { href: '/perf', label: 'Perf' },
];

export default function SiteHeader({ right, floating = false, bare = false, onBrandClick }: Props) {
  const brand = (
    <span className="flex items-center gap-2.5">
      <Mark />
      <span className="font-display text-[15px] font-semibold tracking-tight text-ink-100">
        objaverse
      </span>
    </span>
  );

  const brandClass = 'flex items-center transition-opacity hover:opacity-80';

  return (
    <header
      className={
        floating
          ? 'pointer-events-none absolute inset-x-0 top-0 z-30'
          : bare
          ? 'relative z-30'
          : 'sticky top-0 z-30 border-b border-ink-100/[0.06] bg-ink-950/70 backdrop-blur-md'
      }
    >
      <div
        className={
          floating
            ? 'pointer-events-auto mx-auto flex w-full max-w-7xl items-center gap-3 px-5 py-4 md:px-8'
            : 'mx-auto flex w-full max-w-7xl items-center gap-3 px-5 py-4 md:px-8'
        }
      >
        {onBrandClick ? (
          <button onClick={onBrandClick} className={brandClass}>
            {brand}
          </button>
        ) : (
          <Link href="/" className={brandClass}>
            {brand}
          </Link>
        )}

        <div className="hidden flex-1 justify-center sm:flex">
          <NavPill items={NAV} />
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-3">
          {right ?? <DefaultCTA />}
        </div>
      </div>
    </header>
  );
}

function DefaultCTA() {
  // The reference's right-hand "Join" pill: same dark family as the primary
  // CTA, just smaller, signaling this control belongs to the brand stack.
  // Anchor element styled to mirror PillButton geometry — avoids nesting
  // an interactive button inside an anchor.
  return (
    <a
      href="https://github.com/Eventual-Inc/Daft"
      target="_blank"
      rel="noopener noreferrer"
      className="group/pb relative inline-flex h-9 items-center gap-2 rounded-full bg-ink-100 pl-4 pr-1 text-[13px] font-medium tracking-tight text-ink-950 shadow-[0_8px_24px_-12px_rgba(22,19,16,0.45)] transition-all duration-200 hover:bg-ink-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-100/30"
    >
      <span>View on GitHub</span>
      <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-ink-950 text-ink-100 shadow-[0_2px_6px_-1px_rgba(22,19,16,0.4)] transition-transform duration-200 group-hover/pb:translate-x-0.5">
        <ArrowRight />
      </span>
    </a>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 12h12" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function Mark() {
  // Concentric disc — flat ink dot ringed by an ink-100 stroke. Same visual
  // family as the inset arrow disc on the PillButton, so brand and CTA rhyme.
  return (
    <span className="relative grid h-7 w-7 place-items-center rounded-full border border-ink-100/15 bg-ink-950">
      <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-ink-100">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-950" />
      </span>
    </span>
  );
}
