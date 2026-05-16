import type { AtlasPoint } from '@/lib/api';

export type CategoryStat = {
  name: string;
  count: number;
  hue: number;
};

export type RecentPick = {
  uid: string;
  category: string;
  thumb_url: string;
  pickedAt: number;
};

// Cheap deterministic hue per category — same algorithm the scene used to color
// dust before, so the swatches in the sidebar match what users would expect if
// the scene reverted to category coloring.
export function categoryHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return ((h % 1000) / 1000 + 0.55) % 1;
}

export function buildCategoryStats(points: AtlasPoint[]): CategoryStat[] {
  const tally = new Map<string, number>();
  for (const p of points) {
    const key = p.category || 'untagged';
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  const out: CategoryStat[] = [];
  tally.forEach((count, name) => {
    out.push({ name, count, hue: categoryHue(name) });
  });
  out.sort((a, b) => b.count - a.count);
  return out;
}

export function hueToHex(hue: number, saturation = 0.55, lightness = 0.55): string {
  // Minimal HSL→RGB→hex without pulling three.js into client list components.
  const h = ((hue % 1) + 1) % 1;
  const s = saturation;
  const l = lightness;
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to8 = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${to8(f(0))}${to8(f(8))}${to8(f(4))}`;
}

// uid → 3-char "city code" the hover tooltip displays. First three alphanumeric
// chars of the uid uppercased; falls back to padding so the tooltip always has
// something to render.
export function uidCode(uid: string): string {
  const stripped = uid.replace(/[^a-z0-9]/gi, '');
  return (stripped.slice(0, 3) || 'XXX').toUpperCase();
}

export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
