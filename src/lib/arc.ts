import type { ArcTable } from './types';

/* Sample point / tangent at arc length s (binary search over the cum table).
   Pure and dependency-free: used at build time for layout and on the client
   for the camera + compass. */

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

function idxAt(t: ArcTable, s: number): number {
  let lo = 0;
  let hi = t.cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (t.cum[mid]! < s) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(1, lo);
}

export function samplePt(t: ArcTable, s: number): { x: number; y: number } {
  s = Math.max(0, Math.min(t.total, s));
  const i = idxAt(t, s);
  const f = (s - t.cum[i - 1]!) / Math.max(t.cum[i]! - t.cum[i - 1]!, 0.0001);
  return { x: lerp(t.px[i - 1]!, t.px[i]!, f), y: lerp(t.py[i - 1]!, t.py[i]!, f) };
}

export function tangent(t: ArcTable, s: number): { x: number; y: number } {
  const i = idxAt(t, Math.max(0, Math.min(t.total, s)));
  const dx = t.px[i]! - t.px[i - 1]!;
  const dy = t.py[i]! - t.py[i - 1]!;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}
