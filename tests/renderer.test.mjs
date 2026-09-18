import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { makeGL, makeCanvas, installDOM, SETTINGS } from "./webgl-harness.mjs";

const r = await build({ entryPoints: ["src/renderer.ts"], bundle: true, format: "esm", write: false });
const { PlasmaRenderer } = await import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));

/** Build a renderer on a fake canvas; returns everything a test needs to poke it. */
function mount(settings = {}, domOpts = {}) {
  const dom = installDOM(domOpts);
  const ctx = makeGL();
  const canvas = makeCanvas(ctx.gl);
  const renderer = PlasmaRenderer.create(canvas, { ...SETTINGS, ...settings });
  return { dom, ctx, canvas, renderer };
}

test("create() returns null when WebGL2 is unavailable", () => {
  const dom = installDOM();
  try {
    const canvas = makeCanvas(null);
    canvas.getContext = () => null;
    assert.equal(PlasmaRenderer.create(canvas, SETTINGS), null);
  } finally {
    dom.restore();
  }
});

test("compiled shaders are freed once the program is linked", () => {
  const { dom, ctx, renderer } = mount();
  try {
    const shaders = ctx.created("shader");
    assert.ok(shaders.length >= 10, `expected the five programs' shaders, got ${shaders.length}`);
    assert.deepEqual(
      shaders.filter((s) => !s.deleted),
      [],
      "shader objects stranded after linking - deleteProgram() will not free them",
    );
  } finally {
    renderer.destroy();
    dom.restore();
  }
});

test("destroy() frees every GL object, including the background texture", () => {
  const { dom, ctx, renderer, canvas } = mount({ background: "/bg.jpg" });
  try {
    dom.images[0].finish();
    assert.equal(ctx.created("texture").filter((t) => !t.deleted).length, 9, "8 render targets + the background");

    renderer.destroy();

    assert.deepEqual(ctx.live(), [], "GL objects still alive after destroy()");
    assert.deepEqual(ctx.violations, []);
    assert.equal(canvas.listenerCount("webglcontextlost"), 0);
    assert.equal(dom.globalListenerCount("resize"), 0);
    assert.equal(dom.globalListenerCount("pointermove"), 0);
    assert.equal(dom.docListenerCount("visibilitychange"), 0);
  } finally {
    dom.restore();
  }
});

test("an image that loads after destroy() allocates nothing", () => {
  const { dom, ctx, renderer } = mount({ background: "/slow.jpg" });
  try {
    renderer.destroy();
    const before = ctx.live().length;
    dom.images[0].finish(); // the fetch lands on a context nothing can free it from
    assert.equal(ctx.live().length, before, "a late load created an orphan texture");
    assert.deepEqual(ctx.violations, []);
  } finally {
    dom.restore();
  }
});

test("a context restore rebuilds the background instead of keeping a dead handle", () => {
  const { dom, ctx, canvas, renderer } = mount({ background: "/bg.jpg" });
  try {
    dom.images[0].finish();
    dom.frames(2);

    ctx.loseContext();
    canvas.fire("webglcontextlost");
    assert.equal(dom.pending(), 0, "the frame loop must stop while the context is gone");

    const mark = ctx.mark();
    canvas.fire("webglcontextrestored");
    assert.equal(dom.images.length, 2, "the background source was never reloaded");
    dom.images[1].finish();
    dom.frames(2);

    assert.ok(ctx.createdSince(mark, "texture").length >= 9, "render targets and background not rebuilt");
    assert.deepEqual(ctx.violations, [], "the restored context was handed objects from the dead one");
    assert.ok(canvas.width > 0 && canvas.height > 0, "targets were left with no storage");
    assert.ok(dom.pending() > 0, "the frame loop did not resume");
  } finally {
    renderer.destroy();
    dom.restore();
  }
});

test("a context restore during a scroll freeze reallocates and resumes", () => {
  const { dom, ctx, canvas, renderer } = mount(
    { freezeOnScroll: true },
    { coarsePointer: true },
  );
  try {
    dom.frames(2);
    dom.fireGlobal("scroll");
    assert.equal(canvas.style.position, "absolute", "the fling freeze did not engage");
    assert.equal(dom.pending(), 0, "a freeze stops the loop");

    ctx.loseContext();
    canvas.fire("webglcontextlost");
    canvas.fire("webglcontextrestored");

    assert.ok(canvas.width > 0 && canvas.height > 0, "restored while frozen: no storage on any target");
    assert.equal(canvas.style.position, "fixed", "the canvas is still pinned to a frame that no longer exists");
    assert.ok(dom.pending() > 0, "the frame loop did not resume");
    assert.deepEqual(ctx.violations, []);
  } finally {
    renderer.destroy();
    dom.restore();
  }
});

test("registered surfaces are released and their inline styles cleared on destroy", () => {
  const { dom, renderer } = mount();
  try {
    const el = { style: {}, offsetWidth: 200, offsetHeight: 100, getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 100 }) };
    const handle = renderer.register(el, { radius: 26, lean: 10 });
    el.style.translate = "4px 4px";
    el.style.scale = "1.02";
    renderer.destroy();
    assert.equal(el.style.translate, "");
    assert.equal(el.style.scale, "");
    assert.equal(typeof handle.remove, "function");
  } finally {
    dom.restore();
  }
});

test("the clarity controls reach the composite shader", () => {
  const { dom, ctx, renderer } = mount({ shimmer: 0, glow: 0, wash: 0, grain: 0 });
  try {
    dom.frames(1);
    for (const u of ["uShim", "uGlow", "uWash", "uGrain"]) {
      const sent = ctx.uniform1f(u);
      assert.ok(sent.length > 0, `${u} was never set - is it missing from the UNIFORMS list?`);
      assert.equal(sent.at(-1), 0, `${u} did not carry the value it was configured with`);
    }
    renderer.configure({ ...SETTINGS, shimmer: 1, glow: 0.5, wash: 0.25, grain: 1 });
    dom.frames(1);
    assert.deepEqual(
      ["uShim", "uGlow", "uWash", "uGrain"].map((u) => ctx.uniform1f(u).at(-1)),
      [1, 0.5, 0.25, 1],
    );
  } finally {
    renderer.destroy();
    dom.restore();
  }
});

test("backgroundBlur costs eight passes and nothing when it is zero", () => {
  const { dom, ctx, renderer } = mount({ backgroundBlur: 0 });
  try {
    dom.frames(1);
    ctx.clearCalls();
    dom.frames(1);
    const plain = ctx.draws();

    renderer.configure({ ...SETTINGS, backgroundBlur: 16 });
    ctx.clearCalls();
    dom.frames(1);
    // one downsample, three horizontal/vertical pairs, one upsample
    assert.equal(ctx.draws() - plain, 8);

    renderer.configure({ ...SETTINGS, backgroundBlur: 0 });
    ctx.clearCalls();
    dom.frames(1);
    assert.equal(ctx.draws(), plain, "turning it back off must cost nothing");
    assert.deepEqual(ctx.violations, []);
  } finally {
    renderer.destroy();
    dom.restore();
  }
});

test("changing maxSurfaces rebuilds the shaders and frees the old ones", () => {
  const { dom, ctx, renderer } = mount({ maxSurfaces: 4 });
  try {
    dom.frames(1);
    const before = ctx.live().length;
    const mark = ctx.mark();

    renderer.configure({ ...SETTINGS, maxSurfaces: 32 });
    dom.frames(1);

    assert.ok(ctx.createdSince(mark, "program").length >= 5, "the five programs were not recompiled");
    assert.equal(ctx.live().length, before, "the old context objects were stranded, not freed");
    assert.deepEqual(
      ctx.createdSince(mark, "shader").filter((s) => !s.deleted),
      [],
      "rebuilt shaders stranded",
    );
    assert.deepEqual(ctx.violations, []);
    assert.ok(dom.pending() > 0, "the frame loop stopped across the rebuild");
  } finally {
    renderer.destroy();
    assert.deepEqual(ctx.live(), [], "destroy() after a rebuild left objects behind");
    dom.restore();
  }
});

test("a surface only snaps against its own group", () => {
  const { dom, renderer } = mount();
  try {
    const make = (l, t) => ({
      style: {}, offsetWidth: 100, offsetHeight: 50,
      getBoundingClientRect: () => ({ left: l, top: t, width: 100, height: 50 }),
    });
    const a = renderer.register(make(0, 0), { radius: 8, lean: 0, group: "left" });
    renderer.register(make(200, 0), { radius: 8, lean: 0, group: "left" });
    renderer.register(make(400, 0), { radius: 8, lean: 0, group: "right" });
    renderer.register(make(600, 0), { radius: 8, lean: 0, group: null });

    assert.equal(renderer.layoutBoxes(a.id, true, "left").length, 1);
    assert.equal(renderer.layoutBoxes(a.id, true, "right").length, 1);
    assert.equal(renderer.layoutBoxes(a.id, true, null).length, 1);
    // omitting the group is what every caller written before groups did: see everything
    assert.equal(renderer.layoutBoxes(a.id, true).length, 3);
  } finally {
    renderer.destroy();
    dom.restore();
  }
});
