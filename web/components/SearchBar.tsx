'use client';

import { useEffect, useRef, useState } from 'react';

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

  const placeholder = compact ? 'Search again…' : `Try “${SUGGESTIONS[placeholderIndex]}”`;

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact
          ? 'group relative flex items-center gap-3 w-full max-w-2xl'
          : 'group relative flex items-center gap-3 w-full max-w-2xl mx-auto'
      }
    >
      <div className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-ember-500/40 via-ember-500/0 to-ember-500/40 opacity-0 blur-md transition-opacity duration-500 group-focus-within:opacity-100"
        />
        <div className="relative flex items-center rounded-2xl border border-ink-700 bg-ink-900/80 backdrop-blur-md shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)] transition-colors group-focus-within:border-ember-500/60">
          <span className="pl-5 pr-2 text-ink-400 group-focus-within:text-ember-400 transition-colors">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className={
              compact
                ? 'flex-1 bg-transparent py-3 pr-3 text-base text-ink-100 placeholder:text-ink-400 focus:outline-none'
                : 'flex-1 bg-transparent py-5 pr-3 text-lg md:text-xl text-ink-100 placeholder:text-ink-400/80 focus:outline-none'
            }
          />
          <button
            type="submit"
            disabled={loading || !value.trim()}
            className={
              compact
                ? 'mr-2 inline-flex items-center gap-2 rounded-xl bg-ember-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-ember-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
                : 'mr-3 inline-flex items-center gap-2 rounded-xl bg-ember-500 px-5 py-3 text-base font-medium text-ink-950 hover:bg-ember-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
            }
          >
            {loading ? (
              <>
                <Spinner />
                <span>Searching</span>
              </>
            ) : (
              <>
                <span>Search</span>
                <kbd className="hidden md:inline-flex items-center rounded-md bg-ink-950/40 px-1.5 py-0.5 text-[10px] font-mono text-ink-100/80 border border-ink-100/10">
                  ↵
                </kbd>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
