'use client';

type Props = {
  speedupX: number;
  nModels: number;
};

export default function HeroSpeedup({ speedupX, nModels }: Props) {
  const formatted = speedupX.toFixed(1);

  return (
    <section className="relative px-6 pt-14 pb-12 md:pt-20 md:pb-16">
      <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-300">
          <span className="h-1.5 w-1.5 rounded-full bg-ember-500 animate-pulse-slow" />
          <span>render pipeline · daft vs naive</span>
        </div>

        <h1
          className="relative font-display font-light leading-[0.85] tracking-tightest text-ink-100"
          style={{
            fontSize: 'clamp(7rem, 22vw, 18rem)',
            textShadow:
              '0 0 80px rgba(255, 122, 26, 0.28), 0 0 24px rgba(255, 122, 26, 0.18)',
          }}
        >
          <span className="tabular-nums">{formatted}</span>
          <span className="italic text-ember-500">×</span>
        </h1>

        <p className="mt-6 max-w-2xl text-balance font-display text-xl md:text-2xl text-ink-200">
          Daft renders <span className="italic text-ember-500">{formatted}× faster</span> than
          naive sequential, across {nModels.toLocaleString()} models.
        </p>

        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.24em] text-ink-500">
          the entire pipeline is a daft dataframe
        </p>
      </div>
    </section>
  );
}
