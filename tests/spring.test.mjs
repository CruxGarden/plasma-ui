import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

// deterministic rAF: 16ms virtual frames
let queue = [];
let clock = 0;
globalThis.performance = { now: () => clock };
globalThis.requestAnimationFrame = fn => { queue.push(fn); return queue.length; };
globalThis.cancelAnimationFrame = id => { queue[id - 1] = null; };
function frames(n) {
  for (let i = 0; i < n; i++) {
    clock += 16;
    const q = queue; queue = [];
    q.forEach(fn => fn && fn(clock));
  }
}

const r = await build({ entryPoints: ["src/spring.ts"], bundle: true, format: "esm", write: false });
const { springValue, animateSpring } = await import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));

test("reaches the target and rests exactly on it", () => {
  const v = springValue(0);
  animateSpring(v, 100, { stiffness: 170, damping: 16 });
  frames(300);
  assert.equal(v.get(), 100);
  assert.equal(queue.filter(Boolean).length, 0); // loop ended
});

test("underdamped spring overshoots, overdamped doesn't", () => {
  const a = springValue(0);
  let maxA = 0;
  a.on(x => { maxA = Math.max(maxA, x); });
  animateSpring(a, 100, { stiffness: 300, damping: 8 });
  frames(300);
  assert.ok(maxA > 101, `overshoot ${maxA}`);

  const b = springValue(0);
  let maxB = 0;
  b.on(x => { maxB = Math.max(maxB, x); });
  animateSpring(b, 100, { stiffness: 120, damping: 40 });
  frames(300);
  assert.ok(maxB <= 100.01, `no overshoot ${maxB}`);
});

test("initial velocity carries the value past a nearby target", () => {
  const v = springValue(0);
  let peak = 0;
  v.on(x => { peak = Math.max(peak, x); });
  animateSpring(v, 10, { stiffness: 170, damping: 16, velocity: 2000 });
  frames(300);
  assert.ok(peak > 40, `momentum peak ${peak}`);
  assert.equal(v.get(), 10);
});

test("stop() halts the animation", () => {
  const v = springValue(0);
  const h = animateSpring(v, 100, { stiffness: 170, damping: 16 });
  frames(5);
  const mid = v.get();
  h.stop();
  frames(50);
  assert.equal(v.get(), mid);
  assert.ok(mid > 0 && mid < 100);
});

test("velocity is measured from spaced sets and zero when stale", () => {
  const v = springValue(0);
  clock += 1000;
  v.set(10); clock += 16; v.set(26);
  assert.ok(Math.abs(v.getVelocity() - 1000) < 1, String(v.getVelocity()));
  clock += 200;
  assert.equal(v.getVelocity(), 0);
});

test("frame-batched events still measure real velocity", () => {
  // Chrome delivers pointer moves rAF-aligned: several arrive in the same ms,
  // one batch per frame. Velocity must read across batches.
  const v = springValue(0);
  clock += 1000;
  for (let f = 0; f < 4; f++) {
    v.set(f * 32 + 10); v.set(f * 32 + 20); v.set(f * 32 + 32); // burst
    clock += 16;
  }
  const vel = v.getVelocity();
  assert.ok(vel > 1500 && vel < 2500, String(vel));
});

test("a single stale-preceded burst yields zero, not garbage", () => {
  const v = springValue(0);
  clock += 5000;
  v.set(50); v.set(60); v.set(70); // one same-ms burst, nothing recent before it
  assert.equal(v.getVelocity(), 0);
});
