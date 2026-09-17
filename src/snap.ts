export interface Box { l: number; t: number; w: number; h: number }

export interface SnapOptions {
  /** Grid cell size in px. 0 disables the grid. */
  grid: number;
  /** Distance (px) at which an edge latches onto a neighbor's edge. */
  magnet: number;
  /** Area the box must stay inside; also the grid origin. */
  bounds: Box;
  /** Inset from the bounds edges. */
  inset?: number;
}

/**
 * Snap a proposed box position. Edges first latch onto nearby panels
 * (aligned or butted), otherwise fall to the grid. Overlaps are pushed out
 * so the result sits flush against its neighbor.
 */
export function snapBox(b: Box, others: Box[], o: SnapOptions): { l: number; t: number } {
  const { grid, magnet, bounds } = o;
  const inset = o.inset ?? 0;

  const pick = (cur: number, cands: number[]) => {
    let best: number | null = null, bd = magnet;
    for (const v of cands) { const d = Math.abs(v - cur); if (d < bd) { bd = d; best = v; } }
    return best;
  };
  const nearX = (n: Box) => b.t < n.t + n.h + magnet && b.t + b.h > n.t - magnet;
  const nearY = (n: Box) => b.l < n.l + n.w + magnet && b.l + b.w > n.l - magnet;

  let l = pick(b.l, others.flatMap(n => nearX(n) ? [n.l, n.l + n.w - b.w, n.l + n.w, n.l - b.w] : []));
  let t = pick(b.t, others.flatMap(n => nearY(n) ? [n.t, n.t + n.h - b.h, n.t + n.h, n.t - b.h] : []));
  if (l === null) l = grid > 0 ? bounds.l + Math.round((b.l - bounds.l) / grid) * grid : b.l;
  if (t === null) t = grid > 0 ? bounds.t + Math.round((b.t - bounds.t) / grid) * grid : b.t;

  for (const n of others) {
    const ox = Math.min(l + b.w, n.l + n.w) - Math.max(l, n.l);
    const oy = Math.min(t + b.h, n.t + n.h) - Math.max(t, n.t);
    if (ox > 2 && oy > 2) {
      if (ox < oy) l = (l + b.w / 2 < n.l + n.w / 2) ? n.l - b.w : n.l + n.w;
      else t = (t + b.h / 2 < n.t + n.h / 2) ? n.t - b.h : n.t + n.h;
    }
  }

  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  return {
    l: clamp(l, bounds.l + inset, bounds.l + bounds.w - b.w - inset),
    t: clamp(t, bounds.t + inset, bounds.t + bounds.h - b.h - inset),
  };
}

/** Gap between two boxes (negative when overlapping). */
export function boxGap(a: Box, b: Box): number {
  const gx = Math.max(a.l - (b.l + b.w), b.l - (a.l + a.w));
  const gy = Math.max(a.t - (b.t + b.h), b.t - (a.t + a.h));
  return Math.max(gx, gy);
}
