/**
 * Minimal animated value + spring, replacing the previous Motion dependency.
 * A SpringValue tracks velocity from recent set() calls (so a pointer drag
 * carries momentum into the spring), and animateSpring() integrates a damped
 * spring on requestAnimationFrame.
 */

export interface SpringValue {
  get(): number;
  set(v: number): void;
  /** Subscribe to changes; returns an unsubscribe function. */
  on(fn: (v: number) => void): () => void;
  /** Velocity in px/s, estimated from recent set() calls. */
  getVelocity(): number;
}

export interface SpringHandle { stop(): void }

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function springValue(initial: number): SpringValue {
  let v = initial;
  // short history of (time, value) samples; velocity reads across it, so
  // event batches delivered in the same frame still measure real speed
  const hist: [number, number][] = [[0, initial]];
  const subs = new Set<(v: number) => void>();
  return {
    get: () => v,
    set(next) {
      if (next === v) return;
      v = next;
      const t = now();
      const last = hist[hist.length - 1];
      if (t - last[0] < 1) last[1] = next;      // same-ms burst: update in place
      else { hist.push([t, next]); if (hist.length > 6) hist.shift(); }
      subs.forEach(fn => fn(v));
    },
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    getVelocity() {
      const t = now();
      const newest = hist[hist.length - 1];
      if (t - newest[0] > 100) return 0;        // stale: the value stopped moving
      // measure against the oldest sample still inside the window
      for (let i = 0; i < hist.length - 1; i++) {
        const [rt, rv] = hist[i];
        if (newest[0] - rt <= 100) {
          const dt = newest[0] - rt;
          return dt >= 4 ? ((newest[1] - rv) / dt) * 1000 : 0;
        }
      }
      return 0;
    },
  };
}

export interface SpringOptions { stiffness: number; damping: number; velocity?: number }

/** Animate a SpringValue to a target with a damped spring. */
export function animateSpring(value: SpringValue, to: number, o: SpringOptions): SpringHandle {
  let x = value.get();
  let vel = o.velocity ?? 0;
  let raf = 0;
  let last = now();
  const tick = () => {
    const t = now();
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    // fixed substeps keep stiff springs stable at low frame rates
    const steps = Math.max(1, Math.ceil(dt * 240));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      vel += (o.stiffness * (to - x) - o.damping * vel) * h;
      x += vel * h;
    }
    if (Math.abs(vel) < 1 && Math.abs(to - x) < 0.05) { value.set(to); return; }
    value.set(x);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(raf) };
}
