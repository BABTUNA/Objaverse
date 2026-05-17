'use client';

import type { Hardware } from '@/lib/api';

type Props = {
  hardware: Hardware;
  ranAt: string;
};

export default function HardwareBanner({ hardware, ranAt }: Props) {
  const cpuShort = shortenCpu(hardware.cpu);
  const items = [
    hardware.platform,
    `${hardware.cpu_physical_cores}c/${hardware.cpu_logical_cores}t`,
    cpuShort,
    `${hardware.ram_gb}GB RAM`,
    hardware.gpu ?? 'no GPU',
    `last run ${formatRelative(ranAt)}`,
  ];

  return (
    <div className="relative z-20 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-ink-700/60 bg-ink-900/40 px-4 py-2 md:px-6">
      <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.24em] text-ink-400">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-ink-500/70 animate-pulse-slow" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-ink-500" />
        </span>
        STATIC SNAPSHOT
      </span>
      <span className="text-ink-700">·</span>
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
            {it}
          </span>
          {i < items.length - 1 && <span className="text-ink-700">·</span>}
        </span>
      ))}
    </div>
  );
}

function shortenCpu(cpu: string): string {
  // Trim long Windows-style CPU descriptors so the banner reads cleanly.
  return cpu
    .replace(/\(R\)|\(TM\)|CPU @ .+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
