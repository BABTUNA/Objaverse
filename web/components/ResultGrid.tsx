'use client';

import type { Hit } from '@/lib/api';
import ResultCard from './ResultCard';

type Props = {
  hits: Hit[];
  loading: boolean;
  onOpen: (hit: Hit) => void;
};

export default function ResultGrid({ hits, loading, onOpen }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <SkeletonCard key={i} delay={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {hits.map((hit, i) => (
        <ResultCard key={hit.uid} hit={hit} index={i} onOpen={onOpen} />
      ))}
    </div>
  );
}

function SkeletonCard({ delay }: { delay: number }) {
  return (
    <div
      style={{ animationDelay: `${delay * 30}ms` }}
      className="animate-rise-in flex flex-col rounded-xl border border-ink-700/60 bg-ink-900/40 overflow-hidden"
    >
      <div className="aspect-square skeleton-shimmer" />
      <div className="border-t border-ink-700/60 px-3 py-2 flex items-center justify-between">
        <div className="h-2 w-16 rounded-full skeleton-shimmer" />
        <div className="h-2 w-8 rounded-full skeleton-shimmer" />
      </div>
    </div>
  );
}
