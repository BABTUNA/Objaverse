export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') || 'http://localhost:8000';

export type Hit = {
  uid: string;
  category: string;
  score: number;
  thumb_url: string;
  glb_url: string;
};

export type SearchResponse = {
  query: string;
  hits: Hit[];
};

export function resolveAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${clean}`;
}

export async function search(query: string, k = 24, signal?: AbortSignal): Promise<SearchResponse> {
  const url = `${API_BASE}/search?q=${encodeURIComponent(query)}&k=${k}`;
  const res = await fetch(url, { signal, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Search failed (${res.status})`);
  }
  const data = (await res.json()) as SearchResponse;
  return data;
}

export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/healthz`, { signal, cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}
