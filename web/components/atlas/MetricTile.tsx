import type { ReactNode } from 'react';

type Props = {
  icon: ReactNode;
  value: string;
  label: string;
  tone?: 'default' | 'amber' | 'emerald' | 'ember';
};

const TONE_RING: Record<NonNullable<Props['tone']>, string> = {
  default: 'border-ink-700 bg-ink-900/70 text-ink-200',
  amber: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  emerald: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  ember: 'border-ember-500/40 bg-ember-500/10 text-ember-200',
};

const TONE_ICON: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-ink-300',
  amber: 'text-amber-300',
  emerald: 'text-emerald-300',
  ember: 'text-ember-400',
};

export default function MetricTile({ icon, value, label, tone = 'default' }: Props) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 backdrop-blur-md ${TONE_RING[tone]}`}
    >
      <span className={`grid h-6 w-6 place-items-center rounded-sm bg-ink-950/40 ${TONE_ICON[tone]}`}>
        {icon}
      </span>
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-[12px] font-semibold tracking-tight text-ink-50">
          {value}
        </span>
        <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-ink-400">
          {label}
        </span>
      </div>
    </div>
  );
}
