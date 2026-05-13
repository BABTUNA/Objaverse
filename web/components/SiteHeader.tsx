'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';

type Props = {
  /** Optional slot rendered on the right of the header (search bar, stats, etc.). */
  right?: ReactNode;
  /** When the header sits over a Canvas, drop the bottom border so it blends. */
  floating?: boolean;
  /** Overrides the brand-mark click. When set, the brand becomes a button. */
  onBrandClick?: () => void;
};

export default function SiteHeader({ right, floating = false, onBrandClick }: Props) {
  const pathname = usePathname();
  const onAtlas = pathname?.startsWith('/atlas');

  const brandInner = (
    <>
      <Mark />
      <span className="tracking-tight">objaverse</span>
      <span className="text-ember-500">/</span>
      <span className="font-sans text-xs uppercase tracking-[0.22em] text-ink-300">
        {onAtlas ? 'latent atlas' : 'semantic search'}
      </span>
    </>
  );

  const brandClass =
    'flex items-center gap-2 font-display text-lg text-ink-100 hover:text-ember-400 transition-colors';

  return (
    <header
      className={
        floating
          ? 'pointer-events-none absolute inset-x-0 top-0 z-30'
          : 'sticky top-0 z-30 border-b border-ink-700/60 bg-ink-950/85 backdrop-blur-md'
      }
    >
      <div
        className={
          floating
            ? 'pointer-events-auto mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:px-6'
            : 'mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:px-6'
        }
      >
        {onBrandClick ? (
          <button onClick={onBrandClick} className={brandClass}>
            {brandInner}
          </button>
        ) : (
          <Link href="/" className={brandClass}>
            {brandInner}
          </Link>
        )}

        <nav className="hidden sm:flex items-center gap-1 rounded-full border border-ink-700 bg-ink-900/60 p-0.5 text-[10px] font-mono uppercase tracking-[0.22em]">
          <NavTab href="/" active={!onAtlas}>
            search
          </NavTab>
          <NavTab href="/atlas" active={!!onAtlas}>
            atlas
          </NavTab>
        </nav>

        {right && <div className="ml-auto flex min-w-0 items-center gap-3">{right}</div>}
      </div>
    </header>
  );
}

function NavTab({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-full bg-ember-500/15 px-3 py-1 text-ember-300'
          : 'rounded-full px-3 py-1 text-ink-400 hover:text-ink-100 transition-colors'
      }
    >
      {children}
    </Link>
  );
}

export function Mark() {
  return (
    <span className="relative grid h-7 w-7 place-items-center rounded-md border border-ember-500/40 bg-ember-500/10">
      <span className="absolute inset-0 rounded-md bg-ember-500/20 blur-md" aria-hidden />
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ff7a1a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 2 3 7l9 5 9-5-9-5Z" />
        <path d="m3 17 9 5 9-5" />
        <path d="m3 12 9 5 9-5" />
      </svg>
    </span>
  );
}
