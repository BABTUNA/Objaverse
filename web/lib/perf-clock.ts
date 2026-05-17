'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'done';

// rAF-driven playback clock. We advance `elapsed` by real wall-clock deltas
// multiplied by `speed`, never by setInterval — that keeps the cell-fill
// cadence faithful to the recorded `(start_s, end_s)` pairs even when the
// tab throttles.
export function usePlaybackClock(maxDuration: number) {
  const [elapsed, setElapsed] = useState(0);
  const [state, setState] = useState<PlaybackState>('idle');
  const [speed, setSpeed] = useState(3);

  const elapsedRef = useRef(0);
  const speedRef = useRef(speed);
  const stateRef = useRef<PlaybackState>('idle');
  const maxRef = useRef(maxDuration);
  const lastTickRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    maxRef.current = maxDuration;
  }, [maxDuration]);

  const tick = useCallback((now: number) => {
    if (stateRef.current !== 'playing') return;
    const last = lastTickRef.current ?? now;
    const dtMs = now - last;
    lastTickRef.current = now;

    const next = elapsedRef.current + (dtMs / 1000) * speedRef.current;
    if (next >= maxRef.current) {
      elapsedRef.current = maxRef.current;
      setElapsed(maxRef.current);
      stateRef.current = 'done';
      setState('done');
      rafRef.current = null;
      lastTickRef.current = null;
      return;
    }
    elapsedRef.current = next;
    setElapsed(next);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback(() => {
    if (stateRef.current === 'playing') return;
    if (stateRef.current === 'done') {
      elapsedRef.current = 0;
      setElapsed(0);
    }
    stateRef.current = 'playing';
    setState('playing');
    lastTickRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    if (stateRef.current !== 'playing') return;
    stateRef.current = 'paused';
    setState('paused');
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTickRef.current = null;
  }, []);

  const reset = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTickRef.current = null;
    elapsedRef.current = 0;
    setElapsed(0);
    stateRef.current = 'idle';
    setState('idle');
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { elapsed, state, speed, setSpeed, play, pause, reset };
}
