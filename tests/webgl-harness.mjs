// A fake DOM + WebGL2 context, enough to drive PlasmaRenderer's lifecycle
// (create -> configure -> context loss -> restore -> destroy) under node:test.
//
// The point is not to render anything: it is to account for every GL object
// the renderer creates, and to notice the moment it touches one that belongs
// to a dead context or has already been deleted. Those two mistakes are
// invisible in a browser until the field goes black, and they are exactly
// what the restore and teardown paths get wrong.

/** Stable pseudo-constant for any GL enum name, so `gl.RGBA8` etc. are numbers. */
function enumValue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 60000;
}

const CREATE = {
  createShader: "shader", createProgram: "program", createTexture: "texture",
  createFramebuffer: "framebuffer", createBuffer: "buffer", createVertexArray: "vao",
};
const DELETE = {
  deleteShader: "shader", deleteProgram: "program", deleteTexture: "texture",
  deleteFramebuffer: "framebuffer", deleteBuffer: "buffer", deleteVertexArray: "vao",
};

export function makeGL() {
  let generation = 0;
  let nextId = 1;
  const objects = [];
  /** Every use of an object from a previous context, or one already deleted. */
  const violations = [];

  const track = (kind) => {
    const o = { __kind: kind, __gen: generation, __id: nextId++, deleted: false };
    objects.push(o);
    return o;
  };

  const check = (method, args) => {
    for (const a of args) {
      if (!a || typeof a !== "object" || a.__id === undefined) continue;
      if (a.__gen !== generation) violations.push(`${method}: ${a.__kind}#${a.__id} from context gen ${a.__gen} (now ${generation})`);
      else if (a.deleted) violations.push(`${method}: deleted ${a.__kind}#${a.__id}`);
    }
  };

  const impl = {
    getExtension: () => null,
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getShaderInfoLog: () => "",
    getProgramInfoLog: () => "",
    getUniformLocation: (_pr, name) => ({ __kind: "uniform:" + name, __gen: generation, __id: nextId++, deleted: false }),
    isContextLost: () => false,
  };
  for (const [fn, kind] of Object.entries(CREATE)) impl[fn] = () => track(kind);
  for (const [fn, kind] of Object.entries(DELETE)) {
    impl[fn] = (o) => {
      if (!o) return;
      if (o.__gen !== generation) return violations.push(`${fn}: ${kind}#${o.__id} from context gen ${o.__gen}`);
      if (o.deleted) return violations.push(`${fn}: ${kind}#${o.__id} deleted twice`);
      o.deleted = true;
    };
  }

  const calls = [];
  const gl = new Proxy(impl, {
    get(target, prop) {
      if (typeof prop !== "string") return undefined;
      if (prop in target) {
        const fn = target[prop];
        return (...args) => { calls.push([prop, args]); check(prop, args); return fn(...args); };
      }
      // GL enums are SCREAMING_CASE; everything else is a method we do not model.
      if (/^[A-Z][A-Z0-9_]*$/.test(prop)) return enumValue(prop);
      return (...args) => { calls.push([prop, args]); check(prop, args); };
    },
  });

  return {
    gl,
    /** Simulate the driver dropping the context: every existing object dies with it. */
    loseContext() { generation++; },
    violations,
    calls,
    /** Every value passed to gl.uniform1f for the named uniform, in order. */
    uniform1f: (name) =>
      calls
        .filter(([fn, args]) => fn === "uniform1f" && args[0] && args[0].__kind === "uniform:" + name)
        .map(([, args]) => args[1]),
    /** How many draw calls were issued (one per full-screen pass). */
    draws: () => calls.filter(([fn]) => fn === "drawArrays").length,
    clearCalls() { calls.length = 0; },
    /** Objects of the CURRENT context generation that are still alive. */
    live: () => objects.filter((o) => o.__gen === generation && !o.deleted),
    created: (kind) => objects.filter((o) => o.__kind === kind),
    createdSince: (mark, kind) => objects.slice(mark).filter((o) => o.__kind === kind),
    mark: () => objects.length,
  };
}

/** Minimal canvas: a GL context, style, size, and dispatchable listeners. */
export function makeCanvas(gl) {
  const listeners = new Map();
  return {
    width: 0,
    height: 0,
    style: {},
    getContext: (kind) => (kind === "webgl2" ? gl : null),
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 1024, height: 768 }),
    addEventListener(type, fn) { (listeners.get(type) ?? listeners.set(type, []).get(type)).push(fn); },
    removeEventListener(type, fn) {
      const l = listeners.get(type);
      if (l) listeners.set(type, l.filter((f) => f !== fn));
    },
    /** Fire a canvas event; returns how many handlers ran. */
    fire(type, event = {}) {
      const l = listeners.get(type) ?? [];
      l.forEach((fn) => fn({ preventDefault() {}, ...event }));
      return l.length;
    },
    listenerCount: (type) => (listeners.get(type) ?? []).length,
  };
}

/**
 * Install the browser globals renderer.ts reads. Returns controls for the
 * things a test needs to drive: the rAF queue, the clock, global events, and
 * the Image objects the background loader creates.
 */
export function installDOM({ coarsePointer = false } = {}) {
  const raf = { queue: [], clock: 0 };
  const images = [];
  const globalListeners = new Map();
  const docListeners = new Map();
  const add = (map) => (type, fn) => (map.get(type) ?? map.set(type, []).get(type)).push(fn);
  const remove = (map) => (type, fn) => {
    const l = map.get(type);
    if (l) map.set(type, l.filter((f) => f !== fn));
  };

  const COLOR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgba?\(|hsla?\(|red|blue|green|black|white|transparent)/i;
  const ctx2d = {
    _v: "#000000",
    get fillStyle() { return this._v; },
    set fillStyle(v) { if (COLOR.test(String(v))) this._v = String(v); }, // a real canvas ignores invalid values
  };

  const saved = {};
  const set = (k, v) => { saved[k] = globalThis[k]; globalThis[k] = v; };

  set("performance", { now: () => raf.clock });
  set("requestAnimationFrame", (fn) => { raf.queue.push(fn); return raf.queue.length; });
  set("cancelAnimationFrame", (id) => { if (id) raf.queue[id - 1] = null; });
  set("innerWidth", 1024);
  set("innerHeight", 768);
  set("scrollX", 0);
  set("scrollY", 0);
  set("devicePixelRatio", 2);
  set("matchMedia", (q) => ({
    matches: q.includes("coarse") ? coarsePointer : false,
    addEventListener() {}, removeEventListener() {},
  }));
  set("addEventListener", add(globalListeners));
  set("removeEventListener", remove(globalListeners));
  set("document", {
    hidden: false,
    documentElement: { dataset: {} },
    createElement: () => ({ getContext: () => ctx2d }),
    addEventListener: add(docListeners),
    removeEventListener: remove(docListeners),
  });
  set("HTMLCanvasElement", class HTMLCanvasElement {});
  set("HTMLVideoElement", class HTMLVideoElement {});
  set("Image", class Image {
    constructor() { this.crossOrigin = ""; this.naturalWidth = 0; this.naturalHeight = 0; this.complete = false; images.push(this); }
    set src(v) { this._src = v; }
    get src() { return this._src; }
    addEventListener(type, fn) { if (type === "load") this.onload = fn; }
    /** Resolve this load the way the browser would. */
    finish(w = 800, h = 600) { this.naturalWidth = w; this.naturalHeight = h; this.complete = true; this.onload?.(); }
  });

  return {
    images,
    /** Run n virtual frames of 16ms. */
    frames(n = 1) {
      for (let i = 0; i < n; i++) {
        raf.clock += 16;
        const q = raf.queue;
        raf.queue = [];
        q.forEach((fn) => fn && fn(raf.clock));
      }
    },
    pending: () => raf.queue.filter(Boolean).length,
    fireGlobal(type, event = {}) { (globalListeners.get(type) ?? []).forEach((fn) => fn(event)); },
    globalListenerCount: (type) => (globalListeners.get(type) ?? []).length,
    docListenerCount: (type) => (docListeners.get(type) ?? []).length,
    restore() { for (const k of Object.keys(saved)) globalThis[k] = saved[k]; },
  };
}

export const SETTINGS = {
  colors: ["#3fb0ff", "#7b5cff", "#2ee6a8"],
  blend: 40, refraction: 1, dispersion: 1, rim: 1, smoothness: 1,
  pointerDrop: true, ambientDrops: false, theme: "dark", quality: 1.25,
  reducedMotion: false, freezeOnScroll: false, rimColor: "iridescent", rimWidth: 1,
  highlight: 1, edgeLine: 1, shimmer: 1, glow: 1, wash: 1, grain: 1, backgroundBlur: 0,
  viscosity: 0.5, stretch: 1, flow: 0,
  tint: "#ffffff", opacity: 0, frost: 0, elevation: 0.35, maxSurfaces: 4,
  background: null,
};
