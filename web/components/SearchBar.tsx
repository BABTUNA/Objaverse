'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from '@/components/ui/PillButton';

const SUGGESTIONS = [
  'viking helmet',
  'art deco lamp',
  'low-poly tree',
  'rusted iron key',
  'wooden sailing ship',
  'neon sign',
  'medieval sword',
  'porcelain teapot',
];

type Props = {
  initial?: string;
  onSubmit: (q: string) => void;
  loading?: boolean;
  compact?: boolean;
};

export default function SearchBar({ initial = '', onSubmit, loading = false, compact = false }: Props) {
  const [value, setValue] = useState(initial);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (compact || value) return;
    const id = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % SUGGESTIONS.length);
    }, 2200);
    return () => clearInterval(id);
  }, [compact, value]);

  useEffect(() => {
    if (!compact) inputRef.current?.focus();
  }, [compact]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  const placeholder = compact ? 'Search again' : `Try “${SUGGESTIONS[placeholderIndex]}”`;

  // Pill input with the inset disc CTA — the search field IS the primary button
  // family. Disc swaps to spinner during requests so the geometry stays steady.
  const heightClass = compact ? 'h-12' : 'h-16';
  const padLeft = compact ? 'pl-5' : 'pl-7';
  const inputText = compact ? 'text-[15px]' : 'text-lg md:text-xl';
  const discSize = compact ? 'h-9 w-9' : 'h-12 w-12';

  return (
    <form
      onSubmit={handleSubmit}
      className={compact ? 'w-full max-w-2xl' : 'w-full max-w-2xl mx-auto'}
    >
      <div
        className={
          'group relative flex items-center rounded-full bg-white/85 border border-ink-100/10 ' +
          'shadow-[0_10px_30px_-18px_rgba(22,19,16,0.35)] backdrop-blur-md ' +
          'transition-colors focus-within:border-ink-100/30 ' +
          heightClass
        }
      >
        <SearchIcon className={padLeft + ' shrink-0 text-ink-500 group-focus-within:text-ink-100 transition-colors'} />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          className={
            'flex-1 bg-transparent pl-3 pr-3 font-medium tracking-tight text-ink-100 placeholder:text-ink-500 placeholder:font-normal focus:outline-none ' +
            inputText
          }
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          aria-label={loading ? 'Searching' : 'Search'}
          className={
            'mr-2 inline-grid place-items-center rounded-full bg-ink-100 text-ink-950 ' +
            'shadow-[0_4px_12px_-2px_rgba(22,19,16,0.45)] transition-all duration-200 ' +
            'hover:bg-ink-200 disabled:opacity-40 disabled:cursor-not-allowed group-focus-within:scale-[1.03] ' +
            discSize
          }
        >
          {loading ? <Spinner /> : <ArrowRight className={compact ? 'h-4 w-4' : 'h-4 w-4'} />}
        </button>
      </div>
    </form>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
