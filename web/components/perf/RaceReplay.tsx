'use client';

import { useMemo } from 'react';
import type { BenchmarkRunSummary, PerModelTiming } from '@/lib/api';
import { usePlaybackClock } from '@/lib/perf-clock';
import CornerBrackets from '@/components/perf/CornerBrackets';
import RaceCell, { type CellPhase } from '@/components/perf/RaceCell';
import RaceControls from '@/components/perf/RaceControls';

type Props = {
  naive: BenchmarkRunSummary;
  daft: BenchmarkRunSummary;
};

const GRID_COLS = 10;

export default function RaceReplay({ naive, daft }: Props) {
  const naiveTimings = naive.per_model ?? [];
  const daftTimings = daft.per_model ?? [];

  // The replay only makes sense when both sides emitted per-model timings.
  // Fall back caller is responsible for not rendering us otherwise.
  const naiveDur = naive.elapsed_seconds;
  const daftDur = daft.elapsed_seconds;
  const maxDur = Math.max(naiveDur, daftDur, 0.001);

  const { elapsed, state, speed, setSpeed, play, pause, reset } =
    usePlaybackClock(maxDur);

  const naiveElapsed = Math.min(elapsed, naiveDur);
  const daftElapsed = Math.min(elapsed, daftDur);

  const naiveDoneAt = elapsed >= naiveDur ? naiveDur : null;
  const daftDoneAt = elapsed >= daftDur ? daftDur : null;

  const speedupX = daftDur > 0 ? naiveDur / daftDur : 0;
  const timeSaved = Math.max(0, naiveDur - daftDur);

  return (
    <section className="relative mx-auto w-full max-w-5xl px-4 pb-16 md:px-6">
      <div className="relative rounded-2xl border border-ink-700/70 bg-ink-900/40 p-5 backdrop-blur-md md:p-7">
        <ScanlineGrid />
        <CornerBrackets />

        <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/60 pb-3">
          <div className="flex flex-col">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-400">
              RACE REPLAY · NAIVE vs DAFT
            </h2>
            <span className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-500">
              one cell per model · cells light up at recorded finish times
            </span>
          </div>
          <RaceControls
            state={state}
            speed={speed}
            onPlay={play}
            onPause={pause}
            onReset={reset}
            onSpeedChange={setSpeed}
          />
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel
            label="NAIVE"
            tone="naive"
            note="sequential for-loop · 1 worker"
            timings={naiveTimings}
            elapsed={naiveElapsed}
            totalDur={naiveDur}
            finishedAt={naiveDoneAt}
            slots={Math.max(naiveTimings.length, daftTimings.length)}
            globalElapsed={elapsed}
            playState={state}
          />
          <Panel
            label="DAFT"
            tone="daft"
            note="parallel UDF · N workers"
            timings={daftTimings}
            elapsed={daftElapsed}
            totalDur={daftDur}
            finishedAt={daftDoneAt}
            slots={Math.max(naiveTimings.length, daftTimings.length)}
            globalElapsed={elapsed}
            playState={state}
          />
        </div>

        {state === 'done' && (
          <div className="pointer-events-none relative mt-5 overflow-hidden rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 animate-rise-in">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                DAFT FINISHED {speedupX.toFixed(1)}× FASTER
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-400 tabular-nums">
                {timeSaved.toFixed(1)}s RECLAIMED
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Panel({
  label,
  tone,
  note,
  timings,
  elapsed,
  totalDur,
  finishedAt,
  slots,
  globalElapsed,
  playState,
}: {
  label: string;
  tone: 'naive' | 'daft';
  note: string;
  timings: PerModelTiming[];
  elapsed: number;
  totalDur: number;
  finishedAt: number | null;
  slots: number;
  globalElapsed: number;
  playState: 'idle' | 'playing' | 'paused' | 'done';
}) {
  const labelText = tone === 'daft' ? 'text-ember-700' : 'text-ink-400';
  const dot = tone === 'daft' ? 'bg-ember-500' : 'bg-ink-500';

  // Pre-compute phases per cell. We render exactly `slots` cells so naive and
  // daft grids stay aligned; missing entries (lopsided counts) render empty.
  const phases = useMemo(() => {
    const out: { uid: string | null; phase: CellPhase }[] = [];
    for (let i = 0; i < slots; i++) {
      const t = timings[i];
      if (!t) {
        out.push({ uid: null, phase: 'empty' });
        continue;
      }
      if (!t.ok) {
        const reached = globalElapsed >= t.end_s;
        out.push({ uid: t.uid, phase: reached ? 'skipped' : 'pending' });
        continue;
      }
      let phase: CellPhase = 'pending';
      if (globalElapsed >= t.end_s) phase = 'done';
      else if (globalElapsed >= t.start_s) phase = 'active';
      out.push({ uid: t.uid, phase });
    }
    return out;
  }, [timings, slots, globalElapsed]);

  const completed = phases.filter((p) => p.phase === 'done').length;
  const total = timings.length;

  const statusLabel =
    playState === 'idle'
      ? 'READY'
      : finishedAt != null
      ? 'DONE'
      : playState === 'paused'
      ? 'PAUSED'
      : 'RUNNING';

  const statusCls =
    statusLabel === 'DONE'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
      : statusLabel === 'RUNNING'
      ? tone === 'daft'
        ? 'border-ember-500/40 bg-ember-500/10 text-ember-700'
        : 'border-amber-400/40 bg-amber-400/10 text-amber-700'
      : 'border-ink-700 bg-ink-900/60 text-ink-400';

  const rows = Math.max(1, Math.ceil(slots / GRID_COLS));

  return (
    <div className="relative flex flex-col gap-3 rounded-lg border border-ink-700/60 bg-ink-900/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-700/50 pb-2">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.28em] ${labelText}`}>
            {label}
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-500">
            {note}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] tabular-nums text-ink-300">
            <span className={tone === 'daft' ? 'text-ember-700' : 'text-ink-200'}>
              {elapsed.toFixed(1)}s
            </span>
            <span className="text-ink-500"> / {totalDur.toFixed(1)}s</span>
          </span>
          <span
            className={`flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] ${statusCls}`}
          >
            <span
              className={`h-1 w-1 rounded-full ${
                statusLabel === 'DONE'
                  ? 'bg-emerald-500'
                  : statusLabel === 'RUNNING'
                  ? tone === 'daft'
                    ? 'bg-ember-500 animate-pulse'
                    : 'bg-amber-500 animate-pulse'
                  : 'bg-ink-500'
              }`}
            />
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Cell grid. Each row is exactly GRID_COLS wide; the final row pads
          with empty placeholders so the grid stays a clean rectangle. */}
      <div className="flex flex-col gap-1">
        {Array.from({ length: rows }).map((_, rowIdx) => {
          const start = rowIdx * GRID_COLS;
          const end = Math.min(start + GRID_COLS, slots);
          const rowCells = phases.slice(start, end);
          const padCount = GRID_COLS - rowCells.length;
          return (
            <div
              key={rowIdx}
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
            >
              {rowCells.map((c, i) => (
                <RaceCell key={start + i} uid={c.uid} phase={c.phase} />
              ))}
              {Array.from({ length: padCount }).map((_, i) => (
                <RaceCell key={`pad-${i}`} uid={null} phase="empty" />
              ))}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-ink-700/50 pt-2 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-500 tabular-nums">
        <span>
          {completed} / {total} rendered
        </span>
        <span>
          {total > 0 ? Math.round((completed / total) * 100) : 0}% complete
        </span>
      </div>

      {finishedAt != null && (
        <div
          className={`pointer-events-none absolute right-3 top-3 rounded-sm border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.24em] animate-rise-in ${
            tone === 'daft'
              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700'
              : 'border-ink-700 bg-ink-900/80 text-ink-300'
          }`}
        >
          FINISHED · {finishedAt.toFixed(1)}s
        </div>
      )}
    </div>
  );
}

function ScanlineGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.22]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,122,26,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,122,26,0.04) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    />
  );
}
