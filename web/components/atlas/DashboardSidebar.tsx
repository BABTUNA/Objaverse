'use client';

import { useMemo, useState } from 'react';
import type { Hit } from '@/lib/api';
import type { CategoryStat, RecentPick } from '@/lib/atlas-data';
import CategoryList from '@/components/atlas/CategoryList';
import SelectedPanel from '@/components/atlas/SelectedPanel';
import RecentPicks from '@/components/atlas/RecentPicks';

type Tab = 'BROWSE' | 'FILTER' | 'INSIGHTS';

type Props = {
  totalPoints: number;
  categories: CategoryStat[];
  filter: string;
  onFilterChange: (v: string) => void;
  selectedCategories: Set<string>;
  onToggleCategory: (name: string) => void;
  onClearCategories: () => void;
  selected: Hit | null;
  onOpenSelected: () => void;
  recent: RecentPick[];
  onReplay: (pick: RecentPick) => void;
  status: 'loading' | 'ready' | 'empty' | 'error';
  visibleCount: number;
};

export default function DashboardSidebar({
  totalPoints,
  categories,
  filter,
  onFilterChange,
  selectedCategories,
  onToggleCategory,
  onClearCategories,
  selected,
  onOpenSelected,
  recent,
  onReplay,
  status,
  visibleCount,
}: Props) {
  const [tab, setTab] = useState<Tab>('BROWSE');
  const consensus = useMemo(() => {
    if (totalPoints === 0) return 0;
    return Math.round((visibleCount / totalPoints) * 100);
  }, [visibleCount, totalPoints]);

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-ink-700/70 bg-ink-950/85 backdrop-blur-md">
      <div className="grid grid-cols-3 border-b border-ink-700/70">
        {(['BROWSE', 'FILTER', 'INSIGHTS'] as const).map((t) => {
          const on = t === tab;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative px-2 py-2 font-mono text-[10px] uppercase tracking-[0.24em] transition-colors ${
                on ? 'bg-ink-900 text-ink-50' : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              {t}
              {on && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-ember-500" />}
            </button>
          );
        })}
      </div>

      {tab === 'BROWSE' && (
        <BrowseTab
          totalPoints={totalPoints}
          categories={categories}
          filter={filter}
          onFilterChange={onFilterChange}
          selectedCategories={selectedCategories}
          onToggleCategory={onToggleCategory}
          onClearCategories={onClearCategories}
          selected={selected}
          onOpenSelected={onOpenSelected}
          recent={recent}
          onReplay={onReplay}
          status={status}
          consensus={consensus}
        />
      )}

      {tab === 'FILTER' && (
        <FilterTab
          filter={filter}
          onFilterChange={onFilterChange}
          selectedCategories={selectedCategories}
          onClearCategories={onClearCategories}
          consensus={consensus}
          visibleCount={visibleCount}
          totalPoints={totalPoints}
        />
      )}

      {tab === 'INSIGHTS' && (
        <InsightsTab
          totalPoints={totalPoints}
          categories={categories}
          recent={recent}
          consensus={consensus}
        />
      )}
    </aside>
  );
}

function BrowseTab({
  totalPoints,
  categories,
  filter,
  onFilterChange,
  selectedCategories,
  onToggleCategory,
  onClearCategories,
  selected,
  onOpenSelected,
  recent,
  onReplay,
  status,
  consensus,
}: Pick<
  Props,
  | 'totalPoints'
  | 'categories'
  | 'filter'
  | 'onFilterChange'
  | 'selectedCategories'
  | 'onToggleCategory'
  | 'onClearCategories'
  | 'selected'
  | 'onOpenSelected'
  | 'recent'
  | 'onReplay'
  | 'status'
> & { consensus: number }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 py-3">
        <label className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.24em] text-ink-400">
          SUBSTRING FILTER
        </label>
        <CategorySearchInput value={filter} onChange={onFilterChange} disabled={status !== 'ready'} />
        <div className="mt-2 flex items-center gap-2">
          <ProcessingPill status={status} />
          <ConsensusReadout pct={consensus} />
        </div>

        <ul className="mt-3 grid grid-cols-1 gap-1 rounded-sm border border-ink-700/60 bg-ink-900/40 p-2 text-[10px] text-ink-300">
          <KeyRow swatch="bg-amber-300" label="Marker" detail="default state" />
          <KeyRow swatch="bg-emerald-400" label="Hover / select" detail="active focus" />
          <KeyRow swatch="bg-ember-500" label="Match" detail="passes filter" />
        </ul>
      </div>

      <CategoryList
        categories={categories}
        filter={filter}
        selected={selectedCategories}
        onToggle={onToggleCategory}
        onClear={onClearCategories}
        total={totalPoints}
      />

      <SelectedPanel hit={selected} onOpen={onOpenSelected} />
      <RecentPicks picks={recent} onReplay={onReplay} />
    </div>
  );
}

function FilterTab({
  filter,
  onFilterChange,
  selectedCategories,
  onClearCategories,
  consensus,
  visibleCount,
  totalPoints,
}: {
  filter: string;
  onFilterChange: (v: string) => void;
  selectedCategories: Set<string>;
  onClearCategories: () => void;
  consensus: number;
  visibleCount: number;
  totalPoints: number;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <Section title="ACTIVE QUERY">
        <CategorySearchInput value={filter} onChange={onFilterChange} disabled={false} />
        <p className="mt-2 text-[11px] text-ink-400">
          Markers whose category contains this substring stay illuminated. Others dim to 12% but
          remain raycastable.
        </p>
      </Section>

      <Section title="LOCKED CATEGORIES">
        {selectedCategories.size === 0 ? (
          <p className="text-[11px] text-ink-500">none — toggle a row in BROWSE to lock</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {[...selectedCategories].map((c) => (
              <span
                key={c}
                className="rounded-sm border border-emerald-400/40 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-200"
              >
                {c}
              </span>
            ))}
            <button
              type="button"
              onClick={onClearCategories}
              className="rounded-sm border border-ink-700 px-1.5 py-0.5 font-mono text-[10px] text-ink-300 hover:border-ember-500/50 hover:text-ember-300"
            >
              clear all
            </button>
          </div>
        )}
      </Section>

      <Section title="SELECTION READOUT">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="VISIBLE" value={visibleCount.toLocaleString()} />
          <Stat label="TOTAL" value={totalPoints.toLocaleString()} />
          <Stat label="COVERAGE" value={`${consensus}%`} />
        </div>
      </Section>
    </div>
  );
}

function InsightsTab({
  totalPoints,
  categories,
  recent,
  consensus,
}: {
  totalPoints: number;
  categories: CategoryStat[];
  recent: RecentPick[];
  consensus: number;
}) {
  const top = categories.slice(0, 5);
  const longTail = categories.length > 5 ? categories.length - 5 : 0;
  const topCoverage = totalPoints
    ? Math.round((top.reduce((s, c) => s + c.count, 0) / totalPoints) * 100)
    : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <Section title="DISTRIBUTION">
        <div className="space-y-1.5">
          {top.map((c) => {
            const pct = totalPoints ? (c.count / totalPoints) * 100 : 0;
            return (
              <div key={c.name}>
                <div className="flex items-center justify-between font-mono text-[10px] text-ink-300">
                  <span className="truncate">{c.name || 'untagged'}</span>
                  <span className="tabular-nums text-ink-400">{c.count.toLocaleString()}</span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full bg-ember-500/80"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-500">
          top 5 = {topCoverage}% · {longTail} more in tail
        </p>
      </Section>

      <Section title="SESSION">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="INSPECTED" value={String(recent.length)} />
          <Stat label="COVERAGE" value={`${consensus}%`} />
        </div>
        <p className="mt-2 text-[11px] text-ink-400">
          Coverage = markers currently illuminated divided by total. Filtering reduces it; clearing
          all filters returns to 100%.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-ink-700/70 bg-ink-900/40 p-2.5">
      <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.24em] text-ink-400">
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-ink-700/70 bg-ink-950/60 p-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">{label}</div>
      <div className="font-mono text-[14px] tabular-nums text-ink-100">{value}</div>
    </div>
  );
}

function KeyRow({ swatch, label, detail }: { swatch: string; label: string; detail: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`h-1.5 w-1.5 rounded-full ${swatch}`} />
      <span className="font-mono text-[10px] tracking-tight text-ink-100">{label}</span>
      <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-500">
        {detail}
      </span>
    </li>
  );
}

function CategorySearchInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="relative flex items-center rounded-sm border border-ink-700 bg-ink-900/80 transition-colors focus-within:border-ember-500/60">
      <span className="pl-2.5 pr-1 text-ink-500">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3-3" />
        </svg>
      </span>
      <input
        type="text"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="search categories…"
        className="flex-1 bg-transparent py-1.5 pr-2 font-mono text-[11px] text-ink-100 placeholder:text-ink-500 focus:outline-none disabled:opacity-50"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="mr-1 rounded p-0.5 text-ink-400 hover:text-ember-400"
          aria-label="clear filter"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function ProcessingPill({ status }: { status: Props['status'] }) {
  if (status === 'ready') {
    return (
      <span className="flex items-center gap-1.5 rounded-sm border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-200">
        <span className="h-1 w-1 rounded-full bg-emerald-300" />
        consensus reached
      </span>
    );
  }
  if (status === 'loading') {
    return (
      <span className="flex items-center gap-1.5 rounded-sm border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-amber-200">
        <span className="h-1 w-1 rounded-full bg-amber-300 animate-pulse" />
        agents processing
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-sm border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-red-300">
      <span className="h-1 w-1 rounded-full bg-red-400" />
      offline
    </span>
  );
}

function ConsensusReadout({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative h-1.5 w-12 overflow-hidden rounded-full bg-ink-800">
        <div className="absolute inset-y-0 left-0 bg-ember-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-400">
        {pct}%
      </span>
    </div>
  );
}
