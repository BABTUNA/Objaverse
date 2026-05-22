'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export type NavItem = {
  href: string;
  label: string;
  /** When true, marker chevron is rendered to suggest a (currently visual-only) menu. */
  hasMenu?: boolean;
  /** Explicit active override; otherwise pathname match decides. */
  active?: boolean;
};

type Props = {
  items: NavItem[];
  className?: string;
};

// Centered translucent pill nav lifted from the reference. The whole strip is
// one rounded container — items live inside, separated only by padding and the
// (decorative) chevron-down marker on menu items. No item-level backgrounds in
// the inactive state; active is a subtle filled pill so it sits inside the
// outer glass without competing with it.
export default function NavPill({ items, className }: Props) {
  const pathname = usePathname() ?? '/';
  return (
    <nav
      className={
        'glass-pill inline-flex h-11 items-center gap-1 rounded-full px-1.5 ' + (className ?? '')
      }
      aria-label="Primary"
    >
      {items.map((it) => {
        const isActive = it.active ?? matches(pathname, it.href);
        return (
          <NavLink key={it.href + it.label} item={it} active={isActive} />
        );
      })}
    </nav>
  );
}

function matches(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const className =
    'group/nav inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-medium tracking-tight transition-colors ' +
    (active
      ? 'bg-ink-100/[0.08] text-ink-100'
      : 'text-ink-300 hover:text-ink-100');
  return (
    <Link href={item.href} className={className}>
      <span>{item.label}</span>
      {item.hasMenu && <Chevron />}
    </Link>
  );
}

function Chevron(): ReactNode {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="opacity-60"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
