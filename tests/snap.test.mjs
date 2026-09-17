import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const r = await build({ entryPoints: ["src/snap.ts"], bundle: true, format: "esm", write: false });
const { snapBox, boxGap } = await import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));

const bounds = { l: 0, t: 0, w: 1000, h: 800 };
const o = { grid: 24, magnet: 40, bounds };

test("falls to the grid with no neighbors", () => {
  assert.deepEqual(snapBox({ l: 100, t: 50, w: 200, h: 100 }, [], o), { l: 96, t: 48 });
});

test("butts against a neighbor's edge and aligns tops", () => {
  const n = [{ l: 100, t: 100, w: 200, h: 100 }];
  assert.deepEqual(snapBox({ l: 335, t: 100, w: 200, h: 100 }, n, o), { l: 300, t: 100 });
  assert.deepEqual(snapBox({ l: 300, t: 112, w: 200, h: 100 }, n, o), { l: 300, t: 100 });
});

test("edge alignment beats the grid", () => {
  const n = [{ l: 103, t: 100, w: 200, h: 100 }];
  assert.deepEqual(snapBox({ l: 110, t: 230, w: 200, h: 100 }, n, o).l, 103);
});

test("pushes out of overlaps to sit flush", () => {
  const n = [{ l: 100, t: 100, w: 200, h: 100 }];
  const s = snapBox({ l: 150, t: 110, w: 200, h: 100 }, n, o);
  const clear = s.l >= 300 || s.l + 200 <= 100 || s.t >= 200 || s.t + 100 <= 100;
  assert.ok(clear, JSON.stringify(s));
});

test("clamps to bounds with inset", () => {
  assert.deepEqual(snapBox({ l: 990, t: -20, w: 200, h: 100 }, [], { ...o, inset: 8 }), { l: 792, t: 8 });
});

test("boxGap measures gaps and overlaps", () => {
  assert.equal(boxGap({ l: 0, t: 0, w: 100, h: 100 }, { l: 130, t: 0, w: 100, h: 100 }), 30);
  assert.ok(boxGap({ l: 0, t: 0, w: 100, h: 100 }, { l: 50, t: 0, w: 100, h: 100 }) < 0);
});
