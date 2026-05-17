'use client';

import type { PlaybackState } from '@/lib/perf-clock';

type Props = {
  state: PlaybackState;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (s: number) => void;
};

const SPEEDS = [1, 3, 10] as const;

export default function RaceControls({
  state,
  speed,
  onPlay,
  onPause,
  onReset,
  onSpeedChange,
}: Props) {
  const playing = state === 'playing';

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex items-center gap-1 rounded-full border border-ink-700 bg-ink-900/60 p-0.5">
        <ControlButton
          onClick={playing ? onPause : onPlay}
          primary
          label={playing ? 'PAUSE' : state === 'done' ? 'REPLAY' : 'PLAY'}
          icon={
            playing ? (
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
                <path d="M7 5v14l12-7L7 5z" />
              </svg>
            )
          }
        />
        <ControlButton
          onClick={onReset}
          label="RESET"
          icon={
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
          }
        />
      </div>

      <div className="flex items-center gap-0.5 rounded-full border border-ink-700 bg-ink-900/60 p-0.5">
        {SPEEDS.map((s) => {
          const active = speed === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onSpeedChange(s)}
              className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] tabular-nums transition-colors ${
                active
                  ? 'bg-ember-500/15 text-ember-700'
                  : 'text-ink-400 hover:text-ink-100'
              }`}
            >
              {s}×
            </button>
          );
        })}
      </div>

      <span className="hidden font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-500 sm:inline">
        {state === 'idle'
          ? 'press play to start replay'
          : state === 'playing'
          ? 'replay in progress'
          : state === 'paused'
          ? 'paused'
          : 'replay complete'}
      </span>
    </div>
  );
}

function ControlButton({
  onClick,
  label,
  icon,
  primary = false,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  primary?: boolean;
}) {
  const cls = primary
    ? 'bg-ember-500/15 text-ember-700 hover:bg-ember-500/25'
    : 'text-ink-400 hover:text-ink-100 hover:bg-ink-900/40';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${cls}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
