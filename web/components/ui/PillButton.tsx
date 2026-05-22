'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** When true (default for primary) draws the inset white arrow-disc on the right. */
  withArrow?: boolean;
  /** Override the arrow disc with an arbitrary node (kept circular). */
  trailing?: ReactNode;
  /** Leading visual (small icon) placed before the label. */
  leading?: ReactNode;
};

const sizeMap: Record<Size, { pill: string; disc: string; iconBox: string }> = {
  sm: { pill: 'h-9 pl-4 pr-1 text-[13px] gap-2', disc: 'h-7 w-7', iconBox: 'h-3.5 w-3.5' },
  md: { pill: 'h-11 pl-5 pr-1.5 text-sm gap-2.5', disc: 'h-8 w-8', iconBox: 'h-4 w-4' },
  lg: { pill: 'h-14 pl-7 pr-2 text-base gap-3', disc: 'h-10 w-10', iconBox: 'h-4 w-4' },
};

// The signature button from the reference: pill with an inset disc on the right.
// Primary = ink-on-paper (near-black) with a white disc holding a black arrow.
// The disc carries its own soft shadow so it reads as a button-inside-a-button.
const PillButton = forwardRef<HTMLButtonElement, Props>(function PillButton(
  { variant = 'primary', size = 'md', withArrow, trailing, leading, className, children, ...rest },
  ref,
) {
  const s = sizeMap[size];
  const arrow = withArrow ?? variant === 'primary';

  const base =
    'group/pb relative inline-flex items-center rounded-full font-medium tracking-tight transition-all duration-200 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-100/30 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950';

  const variantClass =
    variant === 'primary'
      ? 'bg-ink-100 text-ink-950 hover:bg-ink-200 shadow-[0_8px_24px_-12px_rgba(22,19,16,0.45)]'
      : variant === 'outline'
      ? 'border border-ink-100/20 text-ink-100 hover:border-ink-100/40 hover:bg-ink-100/[0.04]'
      : 'text-ink-100 hover:bg-ink-100/[0.06]';

  const padNoDisc = !arrow && !trailing;
  const padRightFix =
    padNoDisc
      ? size === 'sm'
        ? 'pr-4'
        : size === 'md'
        ? 'pr-5'
        : 'pr-7'
      : '';

  return (
    <button ref={ref} className={`${base} ${s.pill} ${padRightFix} ${variantClass} ${className ?? ''}`} {...rest}>
      {leading && <span className="inline-flex shrink-0 items-center">{leading}</span>}
      <span className="whitespace-nowrap">{children}</span>
      {(arrow || trailing) && (
        <span
          className={
            'ml-auto inline-grid place-items-center rounded-full shadow-[0_2px_6px_-1px_rgba(22,19,16,0.4)] transition-transform duration-200 group-hover/pb:translate-x-0.5 ' +
            s.disc +
            ' ' +
            (variant === 'primary'
              ? 'bg-ink-950 text-ink-100'
              : 'bg-ink-100 text-ink-950')
          }
        >
          {trailing ?? <ArrowRight className={s.iconBox} />}
        </span>
      )}
    </button>
  );
});

export default PillButton;

// Short, chunky arrow head — matches the reference's stubby glyph rather than
// the slender icon-library default.
export function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 12h12" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
