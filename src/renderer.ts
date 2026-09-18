import { vert, makeShaders, DEFAULT_MAX_SHAPES, MAX_PULSES } from "./shaders";
import { hexToRgb } from "./moods";
import { Box, boxGap } from "./snap";

export interface RendererSettings {
  colors: [string, string, string];
  blend: number;
  refraction: number;
  dispersion: number;
  rim: number;
  smoothness: number;
  pointerDrop: boolean;
  ambientDrops: boolean;
  theme: "auto" | "light" | "dark";
  quality: number;
  reducedMotion: boolean;
  /** Touch devices: pin the last frame to the page during a fling and resume when it stops. */
  freezeOnScroll: boolean;
  /** Rim color: "iridescent", "tint" (each surface's tint), or a hex color. */
  rimColor: string;
  /** Rim width multiplier. */
  rimWidth: number;
  /** Pointer-facing highlight strength. */
  highlight: number;
  /** Thin edge line strength. */
  edgeLine: number;
  /** Slow iridescent sheen across the body of each surface. 0 = none. */
  shimmer: number;
  /** Colored bloom the plasma casts onto the background around it. 0 = none. */
  glow: number;
  /** How much the material tints what is seen through it. 0 = clear as water. */
  wash: number;
  /** Film grain over the background. 0 = none. */
  grain: number;
  /** Blur applied to the background only, in CSS px (0-40). Costs 8 extra blur passes when above 0. */
  backgroundBlur: number;
  /** What the surfaces are made of. */
  material: MaterialName;
  /** Direction the one light comes from. Every opaque material reads it, so they agree. */
  lightDir: [number, number, number];
  /** Surface finish: 0 mirror, 1 chalk. Used by metal; the others carry their own. */
  roughness: number;
  /** How far the highlight stretches along the grain. 0 is isotropic. */
  anisotropy: number;
  /** How far the outline is displaced from the rounded box, in CSS px. 0 leaves it clean. */
  edge: number;
  /** Size of the displacement, in cycles per px. Small is billows, large is chips. */
  edgeScale: number;
  /** 0 rolls the displaced edge, 1 breaks it into flats and points. */
  edgeSharpness: number;
  /** How thick a panel is as a solid, in CSS px. Only the marched materials use it. */
  thickness: number;
  /** Surface tension: how hard the material pulls its own shape toward a bead. */
  tension: number;
  /** 0 = watery and bouncy, 1 = thick and slow. */
  viscosity: number;
  /** How far the surface trails behind moving panels. 0 = no trailing. */
  stretch: number;
  /** Slow ripple along the outline. 0 = still edges. */
  flow: number;
  /** Default plasma tint (hex). */
  tint: string;
  /** Default tint strength, 0 (clear) to 1 (solid color). */
  opacity: number;
  /** Default translucency, 0 (clear) to 1 (frosted). */
  frost: number;
  /** Default elevation, 0 (flat, no shadow) to 1 (floating high). */
  elevation: number;
  /** Maximum visible surfaces, compiled into the shaders (fixed at creation). */
  maxSurfaces: number;
  /** Background: CSS color, image URL, or a live img/canvas/video source (null for the procedural mood field). */
  background: BackgroundSource | null;
}

/**
 * The materials a surface can be made of. `plasma` is the original and the
 * default; the rest share its geometry, its springs and its fusing, and differ
 * only in the composite pass — which is the whole reason they are cheap.
 */
export const MATERIALS = ["plasma", "crystal", "metal", "mercury", "wood", "stone", "cloud"] as const;
export type MaterialName = (typeof MATERIALS)[number];

/** Anything the background can be: a CSS color string, an image URL, or an element to sample (canvas and video update live). */
export type BackgroundSource = string | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap;

export interface ShapeOptions {
  radius: number;
  lean: number;
  /** Per-shape tint override (hex). */
  tint?: string | null;
  /** Per-shape tint strength override. */
  opacity?: number | null;
  /** Per-shape frost override. */
  frost?: number | null;
  /** Per-shape elevation override. */
  elevation?: number | null;
  /** When false, this surface never blends, bridges, or joins with others. Default true. */
  fuse?: boolean;
  /** Snap only against surfaces carrying the same group. null groups with the other ungrouped surfaces. */
  group?: string | null;
}

/** Handle returned by `register`, used by <Plasma>. */
export interface JoinedSides { top: boolean; right: boolean; bottom: boolean; left: boolean }

export interface ShapeHandle {
  id: number;
  update(o: Partial<ShapeOptions>): void;
  setLayoutBox(fn: (() => Box) | null): void;
  setDragging(on: boolean): void;
  leanOffset(): { x: number; y: number };
  isJoined(): boolean;
  remove(): void;
}

interface Rec extends ShapeOptions {
  id: number;
  el: HTMLElement;
  form: number; formV: number; removing: boolean;
  lx: number; ly: number;
  /**
   * Last translate and scale written, so an unchanged frame writes nothing.
   * These are written before the rect is read on purpose: the spring's target
   * has to include this frame's lean, or the plasma trails the DOM by a frame
   * and shimmers wherever the pointer keeps lean alive.
   */
  leanCss: string;
  scaleCss: string;
  joined: boolean; dragging: boolean;
  layoutBox: (() => Box) | null;
  pulseAt: number; pulseS: number;
  box: Box | null;
  onJoin?: (j: boolean) => void;
  onSides?: (sides: JoinedSides) => void;
  sidesKey: string;
  /** Surface spring (page coordinates): edges l, t, r, b and their velocities. */
  sp: { e: number[]; v: number[]; live: boolean };
  drawn: Box | null;
  elevNow: number;
}

type Prog = { pr: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
type Target = { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number };

const UNIFORMS = ["uRes", "uView", "uScale", "uTime", "uGoo", "uEnergy", "uLight", "uMouseAmt", "uDropR", "uAmbient", "uScroll",
  "uMouse", "uP", "uR", "uF", "uT", "uFr", "uEl", "uSolo", "uTint", "uImg", "uImgRes", "uHasImg", "uBgColor", "uBgSolid", "uBg", "uBgM", "uBgH", "uFrost", "uOut", "uCount", "uRip", "uA", "uB", "uC", "uH", "uS", "uTex", "uDir", "uVisc", "uFlow", "uRefract", "uDisp", "uRim", "uRimMode", "uRimColor", "uRimWidth", "uSpec", "uHair", "uShim", "uGlow", "uWash", "uGrain", "uMat", "uLightDir", "uRough", "uAniso", "uEdge", "uEdgeScale", "uEdgeSharp", "uThick", "uTension"];
const MASK_SCALE = 0.5;
// Every pass is full-viewport, so cost scales with the canvas. Past this many
// pixels the resolution drops rather than the frame rate: a 4K monitor or a
// tall phone at devicePixelRatio 3 asks for far more than the effect needs.
const MAX_PIXELS = 2_600_000;

/** Visible box of an element with the centered pulse scale removed. */
function elementBox(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight;
  return { l: r.left + (r.width - w) / 2, t: r.top + (r.height - h) / 2, w, h };
}

const near = (d: number) => d <= 0 ? 1 : d >= 6 ? 0 : 1 - (d / 6) * (d / 6) * (3 - 2 * d / 6);

/**
 * Square off corners that sit against a neighbor so flush panels form one clean
 * outline. Returns radii as [top-right, bottom-right, top-left, bottom-left].
 * A corner stays round only where it sticks out past the neighbor.
 */
function cornerRadii(a: Box, radius: number, all: Box[], self: number): number[] {
  const aR = a.l + a.w, aB = a.t + a.h;
  const corners: [number, number][] = [[1, -1], [1, 1], [-1, -1], [-1, 1]];
  return corners.map(([sx, sy]) => {
    let f = 0;
    for (let j = 0; j < all.length && f < 1; j++) {
      if (j === self) continue;
      const b = all[j], bR = b.l + b.w, bB = b.t + b.h;
      // neighbor beside this corner, spanning its height
      const beyondX = (sx > 0 ? bR > aR + 1 : b.l < a.l - 1) && (sy < 0 ? bB > a.t + 1 : b.t < aB - 1);
      if (beyondX) {
        const touch = near(sx > 0 ? b.l - aR : a.l - bR);
        const cover = near(sy < 0 ? b.t - a.t : aB - bB);
        f = Math.max(f, touch * cover);
      }
      // neighbor above or below this corner, spanning its x position
      const beyondY = (sy < 0 ? b.t < a.t - 1 : bB > aB + 1) && (sx > 0 ? b.l < aR - 1 : bR > a.l + 1);
      if (beyondY) {
        const touch = near(sy < 0 ? a.t - bB : b.t - aB);
        const cover = near(sx > 0 ? aR - bR : b.l - a.l);
        f = Math.max(f, touch * cover);
      }
    }
    return radius * (1 - f);
  });
}

/** Parse any CSS color via the canvas fillStyle round-trip; null when src isn't a color. */
function parseCssColor(src: string): [number, number, number] | null {
  if (typeof document === "undefined") return null;
  const ctx = (parseCssColor as any)._c ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#010203"; ctx.fillStyle = src; const a = ctx.fillStyle;
  ctx.fillStyle = "#040506"; ctx.fillStyle = src; const b = ctx.fillStyle;
  if (a !== b) return null; // invalid: fillStyle kept the sentinel
  const m = /^#([0-9a-f]{6})$/i.exec(a);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255) as [number, number, number];
  const r = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(a);
  if (r) return [+r[1] / 255, +r[2] / 255, +r[3] / 255];
  return null;
}

export class PlasmaRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private progs!: { bg: Prog; mask: Prog; tint: Prog; blur: Prog; comp: Prog };
  private rtA!: Target; private rtB!: Target; private rtC!: Target; private rtT!: Target;
  private rtFr!: Target; private rtBg!: Target; private rtBgM!: Target; private rtBgH!: Target;
  private mrtFb!: WebGLFramebuffer;
  private imgTex: WebGLTexture | null = null;
  private imgRes: [number, number] = [1, 1];
  private imgSrc: BackgroundSource | null = null;
  private bgColor: [number, number, number] | null = null;
  private srcEl: HTMLCanvasElement | HTMLVideoElement | null = null; // re-uploaded each frame
  private floatOK = false;
  /** True between webglcontextlost and webglcontextrestored: draw nothing. */
  private lost = false;
  private warnedOverflow = false;
  /**
   * Set by destroy(). The canvas and its context outlive this renderer, so an
   * async callback that lands afterwards would happily allocate on a context
   * nothing can free it from.
   */
  private destroyed = false;
  private resizeSettle: ReturnType<typeof setTimeout> | undefined;
  /** Everything initGL() created, so destroy() can free it by hand. */
  private owned: { tex: WebGLTexture[]; fb: WebGLFramebuffer[]; prog: WebGLProgram[]; buf: WebGLBuffer[] } = { tex: [], fb: [], prog: [], buf: [] };
  private recs = new Map<number, Rec>();
  private nextId = 1;
  private raf = 0;
  private last = 0;
  private time = 0;
  private dpr = 1;
  /** Coarse pointer = touch. Only there does a fling run on the compositor with rAF deferred. */
  private coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  private frozen = false;
  private scrollIdle: ReturnType<typeof setTimeout> | undefined;
  private resizeWhileFrozen = false;
  /** Scroll offset the last frame was drawn for: where the pinned image belongs on the page. */
  private drawnScroll = [0, 0];
  /**
   * The region a frame covers, in CSS px: origin is where the viewport's
   * top-left sits inside it, size is the whole region. Normally the viewport
   * exactly. When pinning for a fling it is three viewports tall, so the
   * scroll has a viewport of runway above and below before it runs out.
   */
  private region = { ox: 0, oy: 0, w: 0, h: 0 };
  private static readonly RUNWAY = 1; // viewports of runway above and below when pinned
  private energy = 0;
  private mouse = { x: 0, y: 0, tx: 0, ty: 0, amt: 0, target: 0 };
  private pulses: number[][] = Array.from({ length: MAX_PULSES }, () => [0, 0, -99, 0]);
  private pulseIdx = 0;
  private colors: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  private colorTarget: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  private blend = 40;
  private lightQuery = typeof matchMedia !== "undefined" ? matchMedia("(prefers-color-scheme: light)") : null;
  private max: number;
  private P!: Float32Array;
  private R!: Float32Array;
  private F!: Float32Array;
  private T!: Float32Array;
  private FR!: Float32Array;
  private EL!: Float32Array;
  private SOLO!: Float32Array;
  private tintCache = new Map<string, [number, number, number]>();
  private RP = new Float32Array(MAX_PULSES * 4);
  settings: RendererSettings;

  /** Returns null when WebGL2 is unavailable. */
  static create(canvas: HTMLCanvasElement, settings: RendererSettings): PlasmaRenderer | null {
    const gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: false });
    if (!gl) return null;
    try { return new PlasmaRenderer(canvas, gl, settings); } catch (e) { console.error("[plasma-ui]", e); return null; }
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, settings: RendererSettings) {
    this.canvas = canvas; this.gl = gl; this.settings = settings;
    this.max = Math.max(1, Math.round(settings.maxSurfaces || DEFAULT_MAX_SHAPES));
    this.allocUniformArrays();
    this.initGL();
    this.mouse.x = this.mouse.tx = innerWidth / 2;
    this.mouse.y = this.mouse.ty = innerHeight / 2;
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVisibility);
    // The setting is read per event, so it can be toggled through configure().
    if (this.coarse) addEventListener("scroll", this.onScroll, { passive: true });
    addEventListener("pointermove", this.onPointer, { passive: true });
    document.addEventListener("pointerleave", this.onLeave);
    this.applyResize();
    this.raf = requestAnimationFrame(this.frame);
  }

  private loadBackground(src: BackgroundSource | null) {
    if (src === this.imgSrc) return;
    this.imgSrc = src;
    const gl = this.gl;
    const clearTex = () => { if (this.imgTex) { gl.deleteTexture(this.imgTex); this.imgTex = null; } };
    this.bgColor = null; this.srcEl = null;
    if (!src) { clearTex(); return; }

    // element sources: sample directly; canvas and video re-upload every frame
    if (typeof src !== "string") {
      clearTex();
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.imgTex = tex;
      const up = (source: TexImageSource, w: number, h: number) => {
        if (this.destroyed || !w || !h) return;
        gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        this.imgRes = [w, h];
      };
      if (src instanceof HTMLCanvasElement || (typeof HTMLVideoElement !== "undefined" && src instanceof HTMLVideoElement)) {
        this.srcEl = src; // uploaded per frame in draw()
      } else if (typeof ImageBitmap !== "undefined" && src instanceof ImageBitmap) {
        up(src, src.width, src.height);
      } else {
        const img = src as HTMLImageElement;
        if (img.complete && img.naturalWidth) up(img, img.naturalWidth, img.naturalHeight);
        else img.addEventListener("load", () => { if (!this.destroyed && this.imgSrc === src) up(img, img.naturalWidth, img.naturalHeight); }, { once: true });
      }
      return;
    }

    // string: any CSS color, else an image URL
    const rgb = parseCssColor(src);
    if (rgb) { this.bgColor = rgb; clearTex(); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // A load can land after destroy(): the context is still alive (it
      // belongs to the canvas, not to us), so this would allocate a texture
      // with nothing left to free it.
      if (this.destroyed || this.imgSrc !== src) return;
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (this.imgTex) gl.deleteTexture(this.imgTex);
      this.imgTex = tex;
      this.imgRes = [img.naturalWidth, img.naturalHeight];
    };
    img.src = src;
  }

  configure(s: RendererSettings, immediate = false) {
    const qualityChanged = s.quality !== this.settings.quality;
    const max = Math.max(1, Math.round(s.maxSurfaces || DEFAULT_MAX_SHAPES));
    this.settings = s;
    // The surface budget is compiled into the shaders, so changing it means
    // rebuilding every program. initGL() is the same path a context restore
    // takes, so it is safe to re-enter - but the context is alive here, so
    // what it is about to replace has to be freed first, or it all leaks.
    if (max !== this.max) { this.setMax(max); return; }
    this.loadBackground(s.background ?? null);
    this.colorTarget = s.colors.map(hexToRgb);
    if (immediate) { this.colors = this.colorTarget.map(c => [...c]); this.blend = s.blend; }
    if (qualityChanged) this.resize();
  }

  register(el: HTMLElement, o: ShapeOptions, onJoin?: (j: boolean) => void, onSides?: (sides: JoinedSides) => void): ShapeHandle {
    const id = this.nextId++;
    const rec: Rec = {
      id, el, ...o, form: this.settings.reducedMotion ? 1 : 0, formV: 0, removing: false,
      lx: 0, ly: 0, leanCss: "", scaleCss: "", joined: false, dragging: false, layoutBox: null, pulseAt: -1, pulseS: 0, box: null, onJoin, onSides, sidesKey: "",
      sp: { e: [0, 0, 0, 0], v: [0, 0, 0, 0], live: false }, drawn: null, elevNow: -1,
    };
    this.recs.set(id, rec);
    return {
      id,
      update: p => Object.assign(rec, p),
      setLayoutBox: fn => { rec.layoutBox = fn; },
      setDragging: on => { rec.dragging = on; },
      leanOffset: () => ({ x: rec.lx, y: rec.ly }),
      isJoined: () => rec.joined,
      remove: () => { el.style.translate = ""; el.style.scale = ""; this.recs.delete(id); },
    };
  }

  /**
   * Layout boxes of all shapes (lean removed; animating draggables report
   * their destination). Pass `group` to see only the surfaces in that group;
   * omit it - as any caller written before groups existed does - to see them all.
   */
  layoutBoxes(excludeId?: number, fusingOnly = false, group?: string | null): Box[] {
    const out: Box[] = [];
    this.recs.forEach(r => {
      if (r.id === excludeId) return;
      if (fusingOnly && r.fuse === false) return;
      if (group !== undefined && (r.group ?? null) !== group) return;
      out.push(this.layoutBoxOf(r));
    });
    return out;
  }

  private layoutBoxOf(r: Rec): Box {
    if (r.layoutBox) return r.layoutBox();
    // The frame already read this element's rect a moment ago, with no style
    // write in between, so that box is exact - reading it again cost a second
    // getBoundingClientRect per panel per frame for the same numbers.
    const b = r.box ?? elementBox(r.el);
    return { l: b.l - r.lx, t: b.t - r.ly, w: b.w, h: b.h };
  }

  /** Send a pulse through the material from a viewport point. */
  pulse(x: number, y: number, strength = 1) {
    this.pulses[this.pulseIdx] = [x, y, this.time, strength];
    this.pulseIdx = (this.pulseIdx + 1) % MAX_PULSES;
    this.recs.forEach(r => {
      const b = elementBox(r.el);
      const dist = Math.hypot(b.l + b.w / 2 - x, b.t + b.h / 2 - y);
      r.pulseAt = this.time + dist / 520;
      r.pulseS = strength;
    });
    this.bump(0.9 * strength);
  }

  /** Raise the material's energy (brightens contours and color); it decays on its own. */
  bump(e: number) { this.energy = Math.max(this.energy, Math.min(e, 1)); }

  /** Rebuild the shaders and uniform arrays for a new surface budget. */
  private setMax(max: number) {
    this.max = max;
    this.allocUniformArrays();
    this.releaseGL();
    this.initGL();
    this.applyResize(); // initGL zeroes the canvas size, so this always reallocates
    this.warnedOverflow = false;
  }

  private allocUniformArrays() {
    this.P = new Float32Array(this.max * 4);
    this.R = new Float32Array(this.max * 4);
    this.F = new Float32Array(this.max);
    this.T = new Float32Array(this.max * 4);
    this.FR = new Float32Array(this.max);
    this.EL = new Float32Array(this.max);
    this.SOLO = new Float32Array(this.max);
  }

  /** Delete every GL object this renderer created, leaving the canvas usable. */
  private releaseGL() {
    const gl = this.gl;
    if (!gl.isContextLost()) {
      this.owned.tex.forEach(t => gl.deleteTexture(t));
      this.owned.fb.forEach(f => gl.deleteFramebuffer(f));
      this.owned.prog.forEach(pr => gl.deleteProgram(pr));
      this.owned.buf.forEach(b => gl.deleteBuffer(b));
      // Not in `owned`: loadBackground creates it, so nothing else would.
      if (this.imgTex) gl.deleteTexture(this.imgTex);
    }
    this.imgTex = null;
    this.imgSrc = null;
    this.srcEl = null;
    this.owned = { tex: [], fb: [], prog: [], buf: [] };
  }

  /**
   * Every GL object this renderer owns. A lost context invalidates all of
   * them, so creation lives here rather than in the constructor: the restore
   * handler runs exactly the same path.
   */
  private initGL() {
    const gl = this.gl;
    this.owned = { tex: [], fb: [], prog: [], buf: [] };
    // The background texture is created outside this method (loadBackground,
    // often asynchronously), so it is not in `owned` and does not come back
    // with everything else. On a restore its handle belongs to the dead
    // context: drop the reference — deleting it is neither possible nor
    // needed — and clear the source, or the configure() below early-returns
    // on an unchanged src and the background is gone for good while uHasImg
    // still says 1.
    this.imgTex = null;
    this.imgSrc = null;
    this.srcEl = null;
    this.floatOK = !!gl.getExtension("EXT_color_buffer_float");
    const sh = makeShaders(this.max);
    this.progs = { bg: this.program(sh.bgFrag), mask: this.program(sh.maskFrag), tint: this.program(sh.tintFrag), blur: this.program(sh.blurFrag), comp: this.program(sh.compFrag) };
    const buf = gl.createBuffer();
    if (buf) this.owned.buf.push(buf);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.rtA = this.target(); this.rtB = this.target(); this.rtC = this.target(); this.rtT = this.target();
    this.rtFr = this.target(); this.rtBg = this.target(); this.rtBgM = this.target(); this.rtBgH = this.target();
    this.mrtFb = gl.createFramebuffer()!;
    this.owned.fb.push(this.mrtFb);
    this.configure(this.settings, true);
    // These objects have no storage or attachments yet, and allocate() skips
    // its work when the pixel size is unchanged — which it is whenever this
    // renderer replaced another on the same canvas (every StrictMode remount
    // in development, and every context restore). Zero the size so the next
    // applyResize() always reallocates; otherwise mrtFb is drawn into with no
    // attachment: "Framebuffer is incomplete: No attachments".
    this.canvas.width = this.canvas.height = 0;
  }

  /**
   * A drag-resize reallocates eight render targets per distinct size, and the
   * driver can drop the context under that. Without these two handlers the
   * field simply stopped: the frame loop kept running against a dead context
   * and nothing ever brought it back. preventDefault is what asks the browser
   * to attempt a restore at all.
   */
  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  private onContextRestored = () => {
    this.lost = false;
    this.initGL();
    this.last = 0;
    // initGL zeroes the canvas size so the next allocation always runs, but
    // applyResize() refuses to do that work while frozen — which would leave
    // every target without storage and mrtFb without attachments. The pinned
    // image is a texture of the dead context anyway, so a freeze in flight is
    // ended rather than kept; thaw() reallocates and restarts the loop.
    if (this.frozen) { clearTimeout(this.scrollIdle); this.thaw(); return; }
    this.applyResize();
    if (!document.hidden && !this.raf) this.raf = requestAnimationFrame(this.frame);
  };

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.resizeSettle);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    removeEventListener("scroll", this.onScroll);
    clearTimeout(this.scrollIdle);
    removeEventListener("pointermove", this.onPointer);
    document.removeEventListener("pointerleave", this.onLeave);
    this.recs.forEach(r => { r.el.style.translate = ""; r.el.style.scale = ""; });
    this.recs.clear();
    // Free the GPU objects, but leave the canvas usable. loseContext() is a
    // testing sledgehammer: the <canvas> belongs to React and outlives this
    // renderer, so poisoning its context meant a remount — every StrictMode
    // mount in development — got a context that could never draw again.
    this.releaseGL();
  }

  /**
   * A hidden tab draws nothing anyone can see. Browsers throttle rAF there
   * but do not all stop it, so the loop stops itself and picks up where it
   * left off - `last` is reset so the first frame back does not see a
   * minute-long dt.
   */
  private onVisibility = () => {
    if (document.hidden) { cancelAnimationFrame(this.raf); this.raf = 0; }
    else if (!this.raf && !this.frozen) { this.last = 0; this.raf = requestAnimationFrame(this.frame); }
  };

  /**
   * A fling on a touch device is driven by the compositor, and rAF is deferred
   * while it runs, so anything JS repositions arrives late: the plasma trails
   * the panels it belongs to. Instead of chasing, the canvas is pinned to the
   * page for the duration - the last drawn frame becomes a texture that
   * scrolls with the content, moved by the compositor with no JS in the path -
   * and the loop resumes once the scroll events stop.
   *
   * The field's scroll parallax is 1:1 on these devices (see draw), so the
   * pinned image and the first live frame after it line up.
   */
  private onScroll = () => {
    if (!this.settings.freezeOnScroll) return;
    if (!this.frozen) this.freeze();
    clearTimeout(this.scrollIdle);
    this.scrollIdle = setTimeout(this.thaw, 120);
  };

  private freeze() {
    const c = this.canvas;
    cancelAnimationFrame(this.raf); this.raf = 0;
    // One frame covering three viewports, the current one in the middle, so
    // the fling has a viewport of runway each way. It is drawn for the scroll
    // offset of this moment, and pinned there.
    const vw = innerWidth, vh = innerHeight, runway = Math.round(vh * PlasmaRenderer.RUNWAY);
    this.region = { ox: 0, oy: runway, w: vw, h: vh + 2 * runway };
    this.allocate();
    this.oneShot = true; this.frame(performance.now()); this.oneShot = false;
    // Absolute, sized in pixels so a positioned ancestor cannot stretch it,
    // then offset so the viewport band of the image sits on the viewport.
    c.style.inset = "";
    c.style.width = `${this.region.w}px`; c.style.height = `${this.region.h}px`;
    c.style.position = "absolute"; c.style.top = "0px"; c.style.left = "0px";
    const r = c.getBoundingClientRect();
    c.style.top = `${-r.top - (scrollY - this.drawnScroll[1]) - runway}px`;
    c.style.left = `${-r.left - (scrollX - this.drawnScroll[0])}px`;
    this.frozen = true;
  }

  private thaw = () => {
    if (!this.frozen) return;
    const c = this.canvas;
    c.style.top = ""; c.style.left = ""; c.style.width = "100%"; c.style.height = "100%";
    c.style.position = "fixed"; c.style.inset = "0";
    this.frozen = false;
    this.resizeWhileFrozen = false;
    this.applyResize(); // back to the viewport region, which also picks up any resize that arrived meanwhile
    this.last = 0;
    if (!document.hidden && !this.raf) this.raf = requestAnimationFrame(this.frame);
  };

  private onPointer = (e: PointerEvent) => { this.mouse.tx = e.clientX; this.mouse.ty = e.clientY; this.mouse.target = 1; };
  private onLeave = () => { this.mouse.target = 0; };

  /**
   * Resizing reallocates eight render targets, so it must not run per event.
   * Mobile fires `resize` continuously while the URL bar collapses, which
   * otherwise reallocated every texture repeatedly mid-scroll.
   */
  private resize = () => {
    // Coalescing per frame still reallocated once per distinct size, which is
    // dozens of times through a window drag — enough to lose the context. Wait
    // for the drag to settle instead. The canvas is sized in CSS, so it
    // stretches meanwhile and sharpens when the reallocation lands.
    clearTimeout(this.resizeSettle);
    this.resizeSettle = setTimeout(this.applyResize, 120);
  };

  private applyResize = () => {
    if (this.frozen) { this.resizeWhileFrozen = true; return; }
    this.region = { ox: 0, oy: 0, w: innerWidth, h: innerHeight };
    this.allocate();
  };

  /** Size the canvas and every target for the current region. */
  private allocate = () => {
    const gl = this.gl;
    const { w: rw, h: rh } = this.region;
    let dpr = Math.min(devicePixelRatio || 1, this.settings.quality);
    const pixels = rw * rh * dpr * dpr;
    if (pixels > MAX_PIXELS) dpr *= Math.sqrt(MAX_PIXELS / pixels);
    this.dpr = dpr;
    const cw = Math.max(1, Math.round(rw * this.dpr));
    const ch = Math.max(1, Math.round(rh * this.dpr));
    // Nothing to do when the pixel size is unchanged, which is most of the
    // resize events a mobile browser sends.
    if (cw === this.canvas.width && ch === this.canvas.height) return;
    this.canvas.width = cw;
    this.canvas.height = ch;
    const w = Math.max(1, Math.round(this.canvas.width * MASK_SCALE));
    const h = Math.max(1, Math.round(this.canvas.height * MASK_SCALE));
    const size = (t: Target, tw: number, th: number, color = false) => {
      t.w = tw; t.h = th;
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      // Field and height targets carry signed distances and blur weights and
      // want the half-float precision. A colour target is only ever shown, and
      // the screen is 8-bit: at full resolution that halves the largest
      // allocation here.
      if (this.floatOK && !color) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, tw, th, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    };
    [this.rtA, this.rtB, this.rtC, this.rtT, this.rtFr, this.rtBgM, this.rtBgH].forEach(t => size(t, w, h));
    size(this.rtBg, this.canvas.width, this.canvas.height, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.mrtFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.rtT.tex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.rtFr.tex, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  private isLight() {
    const t = this.settings.theme;
    if (t !== "auto") return t === "light";
    const attr = document.documentElement.dataset.theme;
    if (attr === "light" || attr === "dark") return attr === "light";
    return !!this.lightQuery?.matches;
  }

  private frame = (now: number) => {
    if (this.lost) { this.raf = 0; return; }
    if (!this.oneShot) this.raf = requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 0.016;
    this.last = now;
    const s = this.settings;
    this.time += dt * (s.reducedMotion ? 0.4 : 1);

    // ease shared state
    const m = this.mouse;
    m.x += (m.tx - m.x) * 0.18; m.y += (m.ty - m.y) * 0.18;
    m.amt += (m.target - m.amt) * Math.min(1, dt * 4);
    const ce = 1 - Math.exp(-dt * 2);
    this.colors.forEach((c, i) => c.forEach((v, j) => { c[j] = v + (this.colorTarget[i][j] - v) * ce; }));
    this.blend += (s.blend - this.blend) * ce;
    this.energy *= Math.exp(-dt * 1.2);

    // per-shape: form spring, visibility, join state, lean, pulse
    // Region bounds in viewport coordinates: the viewport itself, plus runway
    // above and below while a pinned frame is being drawn.
    const rg = this.region;
    const top = -rg.oy - 80, bottom = rg.h - rg.oy + 80, left = -rg.ox - 80, right = rg.w - rg.ox + 80;
    const list: Rec[] = [];
    this.recs.forEach(r => {
      if (!r.el.isConnected) return;
      if (!s.reducedMotion) {
        // Critically damped: surfaces form in without overshooting. At the
        // old damping of 12 they went 17.6% past full size and rang back,
        // which read as a bounce on first paint.
        r.formV += (170 * (1 - r.form) - 26 * r.formV) * dt;
        r.form += r.formV * dt;
      } else r.form = 1;
      const b = elementBox(r.el);
      r.box = b;
      if (b.w === 0 || b.l > right || b.t > bottom || b.l + b.w < left || b.t + b.h < top) { r.sp.live = false; return; }
      list.push(r);
    });

    const boxes = list.map(r => this.layoutBoxOf(r));
    // surfaces visibly fuse once the gap is inside roughly half the blend distance
    const joinGap = Math.max(1.5, this.blend * 0.5);
    list.forEach((r, i) => {
      const a = boxes[i];
      const sides = { top: false, right: false, bottom: false, left: false };
      const iSolo = list[i].fuse === false;
      boxes.forEach((b, j) => {
        if (j === i || iSolo || list[j].fuse === false) return;
        const overX = b.l < a.l + a.w - 1 && b.l + b.w > a.l + 1;
        const overY = b.t < a.t + a.h - 1 && b.t + b.h > a.t + 1;
        if (overX) {
          if (a.t - (b.t + b.h) < joinGap && b.t < a.t) sides.top = true;
          if (b.t - (a.t + a.h) < joinGap && b.t + b.h > a.t + a.h) sides.bottom = true;
        }
        if (overY) {
          if (a.l - (b.l + b.w) < joinGap && b.l < a.l) sides.left = true;
          if (b.l - (a.l + a.w) < joinGap && b.l + b.w > a.l + a.w) sides.right = true;
        }
      });
      const joined = sides.top || sides.right || sides.bottom || sides.left;
      if (joined !== r.joined) { r.joined = joined; r.onJoin?.(joined); }
      const key = `${+sides.top}${+sides.right}${+sides.bottom}${+sides.left}`;
      if (key !== r.sidesKey) { r.sidesKey = key; r.onSides?.(sides); }

      let tx = 0, ty = 0;
      if (r.lean > 0 && !joined && !r.dragging && !s.reducedMotion) {
        const dx = m.tx - (a.l + a.w / 2), dy = m.ty - (a.t + a.h / 2);
        const pull = Math.exp(-(dx * dx + dy * dy) / 120000) * r.lean * m.amt;
        const len = Math.hypot(dx, dy) || 1;
        tx = dx / len * pull; ty = dy / len * pull;
      }
      const le = 1 - Math.exp(-dt * 3);
      r.lx += (tx - r.lx) * le; r.ly += (ty - r.ly) * le;
      // Lean eases asymptotically, so it never quite stops changing. Writing
      // it every frame dirtied layout for every panel every frame, and the
      // getBoundingClientRect below then forced a reflow to resolve it.
      // Below a twentieth of a pixel there is nothing to see, so settle.
      if (Math.abs(tx - r.lx) < 0.05 && Math.abs(ty - r.ly) < 0.05) { r.lx = tx; r.ly = ty; }
      const lean = tx === 0 && ty === 0 && r.lx === 0 && r.ly === 0
        ? ""
        : `${r.lx.toFixed(2)}px ${r.ly.toFixed(2)}px`;
      if (lean !== r.leanCss) { r.leanCss = lean; r.el.style.translate = lean; }

      const u = (this.time - r.pulseAt) / 0.36;
      const scale = r.pulseAt >= 0 && u >= 0 && u <= 1 && !s.reducedMotion
        ? String(1 + 0.04 * r.pulseS * Math.sin(Math.PI * u))
        : "";
      if (scale !== r.scaleCss) { r.scaleCss = scale; r.el.style.scale = scale; }
    });

    // Viscous surface: each plasma box is a spring that chases its element (in page
    // coordinates, so scrolling doesn't count as motion). The drawn shape is the union
    // of the element and the spring, so content never leaves the plasma: moving panels
    // leave a trailing stretch, and stopping panels overshoot forward before settling.
    const v = Math.min(Math.max(s.viscosity, 0), 1);
    const st = Math.max(s.stretch, 0);
    const stiff = (900 - 810 * v) / Math.max(st * st, 1e-4);
    const zeta = 0.28 + 0.87 * v;
    const damp = 2 * zeta * Math.sqrt(stiff);
    const sx = scrollX, sy = scrollY;
    // The substep has to satisfy the spring, not just the frame rate. stiff
    // grows as 1/stretch^2, so a small stretch with low viscosity pushes
    // stiff past two million: at a fixed 1/120s step, explicit Euler diverges
    // and the surface visibly oscillates instead of settling. Keeping
    // h well inside 1/omega holds it stable at every slider position.
    const hMax = 0.2 / Math.sqrt(Math.max(stiff, 1e-6));
    const steps = Math.min(240, Math.max(Math.ceil(dt * 120), Math.ceil(dt / hMax), 1));
    const h = dt / steps;
    list.forEach(r => {
      const rr = r.el.getBoundingClientRect(); // includes pulse scale and lean
      const tgt = [rr.left + sx, rr.top + sy, rr.right + sx, rr.bottom + sy];
      const sp = r.sp;
      if (!sp.live || st < 0.01 || s.reducedMotion) { sp.e = tgt.slice(); sp.v = [0, 0, 0, 0]; sp.live = true; }
      else {
        for (let k = 0; k < steps; k++) for (let j = 0; j < 4; j++) {
          sp.v[j] += (stiff * (tgt[j] - sp.e[j]) - damp * sp.v[j]) * h;
          sp.e[j] += sp.v[j] * h;
        }
        for (let j = 0; j < 4; j++) if (Math.abs(tgt[j] - sp.e[j]) < 0.02 && Math.abs(sp.v[j]) < 0.05) { sp.e[j] = tgt[j]; sp.v[j] = 0; }
      }
      const l = Math.min(tgt[0], sp.e[0]) - sx, t = Math.min(tgt[1], sp.e[1]) - sy;
      const rgt = Math.max(tgt[2], sp.e[2]) - sx, btm = Math.max(tgt[3], sp.e[3]) - sy;
      r.drawn = { l, t, w: rgt - l, h: btm - t };
    });

    this.drawnScroll = [scrollX, scrollY];
    if (list.length > this.max && !this.warnedOverflow) {
      this.warnedOverflow = true;
      console.warn(`[plasma-ui] ${list.length} plasma surfaces are on screen but maxSurfaces is ${this.max}; the rest are not drawn. Raise maxSurfaces on <PlasmaProvider>.`);
    }
    this.lastList = list.slice(0, this.max);
    this.draw(this.lastList);
  };
  private lastList: Rec[] = [];
  private oneShot = false;

  private draw(list: Rec[]) {
    const gl = this.gl, s = this.settings, rg = this.region;
    const drawn = list.map(r => r.drawn ?? elementBox(r.el));
    list.forEach((r, i) => {
      const b = drawn[i];
      this.P.set([b.l + b.w / 2 + rg.ox, b.t + b.h / 2 + rg.oy, b.w / 2, b.h / 2], i * 4);
      // fuse={false} surfaces neither square others' corners nor get squared
      const squareAgainst = r.fuse === false ? [] : drawn.filter((_, j) => j !== i && list[j].fuse !== false);
      this.R.set(cornerRadii(b, r.radius, squareAgainst, -1), i * 4);
      this.F[i] = Math.max(0, r.form);
      const [tr, tg, tb] = this.rgb(r.tint ?? s.tint);
      this.T.set([tr, tg, tb, Math.min(Math.max(r.opacity ?? s.opacity, 0), 1)], i * 4);
      this.FR[i] = Math.min(Math.max(r.frost ?? s.frost, 0), 1);
      // ease toward base elevation, raised while dragging
      const base = Math.min(Math.max(r.elevation ?? s.elevation, 0), 1);
      const target = r.dragging ? Math.min(base + 0.35, 1) : base;
      r.elevNow = r.elevNow < 0 ? target : r.elevNow + (target - r.elevNow) * 0.12;
      this.EL[i] = r.elevNow;
      this.SOLO[i] = r.fuse === false ? 1 : 0;
    });
    this.pulses.forEach((p, i) => this.RP.set([p[0] + rg.ox, p[1] + rg.oy, p[2], p[3]], i * 4));
    const light = this.isLight() ? 1 : 0;
    const setCommon = (u: Prog["u"], scale: number) => {
      gl.uniform2f(u.uRes, rg.w, rg.h);
      gl.uniform4f(u.uView, rg.ox, rg.oy, innerWidth, innerHeight);
      gl.uniform1f(u.uScale, scale);
      gl.uniform1f(u.uTime, this.time);
      gl.uniform1f(u.uGoo, this.blend);
      gl.uniform1f(u.uEnergy, this.energy);
      gl.uniform1f(u.uLight, light);
      gl.uniform1f(u.uMouseAmt, this.mouse.amt);
      gl.uniform1f(u.uDropR, s.pointerDrop ? 15 : 0);
      gl.uniform1f(u.uAmbient, s.ambientDrops ? 1 : 0);
      // 1:1 where pinning is on, so the pinned image and the next live frame
      // agree; the region origin keeps the field continuous across the runway.
      gl.uniform1f(u.uScroll, this.coarse && s.freezeOnScroll ? scrollY - rg.oy : scrollY * 0.25);
      gl.uniform1f(u.uVisc, Math.min(Math.max(s.viscosity, 0), 1));
      gl.uniform1f(u.uFlow, Math.max(s.flow, 0));
      gl.uniform2f(u.uMouse, this.mouse.x + rg.ox, this.mouse.y + rg.oy);
      gl.uniform4fv(u.uP, this.P); gl.uniform4fv(u.uR, this.R); gl.uniform1fv(u.uF, this.F); gl.uniform4fv(u.uT, this.T); gl.uniform1fv(u.uFr, this.FR); gl.uniform1fv(u.uEl, this.EL); gl.uniform1fv(u.uSolo, this.SOLO);
      gl.uniform1i(u.uCount, list.length);
      gl.uniform4fv(u.uRip, this.RP);
      gl.uniform3fv(u.uA, this.colors[0]); gl.uniform3fv(u.uB, this.colors[1]); gl.uniform3fv(u.uC, this.colors[2]);
      // Shared with the mask and tint passes: the silhouette has to be the
      // same shape the composite marches, or it clips it.
      gl.uniform1f(u.uTension, s.tension);
      gl.uniform1f(u.uThick, s.thickness);
    };

    const bl = this.progs.blur;
    const pass = (src: Target, dst: Target, dx: number, dy: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform2f(bl.u.uDir, dx, dy);
      gl.uniform2f(bl.u.uOut, dst.w, dst.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const k = this.dpr / 1.25;

    // 0. background, plus two blurred copies for frosted plasma
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.rtBg.fb);
    gl.viewport(0, 0, this.rtBg.w, this.rtBg.h);
    gl.useProgram(this.progs.bg.pr);
    setCommon(this.progs.bg.u, this.dpr);
    gl.activeTexture(gl.TEXTURE7);
    if (this.srcEl && this.imgTex) {
      const el = this.srcEl;
      const ready = el instanceof HTMLCanvasElement ? el.width > 0 : el.readyState >= 2;
      if (ready) {
        const w = el instanceof HTMLCanvasElement ? el.width : el.videoWidth;
        const h = el instanceof HTMLCanvasElement ? el.height : el.videoHeight;
        gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, el);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        this.imgRes = [w, h];
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
    gl.uniform1i(this.progs.bg.u.uImg, 7);
    gl.uniform2f(this.progs.bg.u.uImgRes, this.imgRes[0], this.imgRes[1]);
    gl.uniform1f(this.progs.bg.u.uHasImg, this.imgTex ? 1 : 0);
    const bc = this.bgColor;
    gl.uniform3f(this.progs.bg.u.uBgColor, bc?.[0] ?? 0, bc?.[1] ?? 0, bc?.[2] ?? 0);
    gl.uniform1f(this.progs.bg.u.uBgSolid, bc ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.viewport(0, 0, this.rtA.w, this.rtA.h);
    gl.useProgram(bl.pr);
    gl.uniform1i(bl.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    // Blur the background itself, before any surface is drawn: unlike frost,
    // which blurs only what a frosted surface sees, this softens the whole
    // field. It runs through the half-resolution scratch targets and lands
    // back in rtBg, so every later pass - shadows, refraction, frost - reads
    // the softened background with no extra work of its own.
    const bgBlur = Math.min(40, Math.max(0, s.backgroundBlur || 0));
    if (bgBlur > 0) {
      const step = (bgBlur * this.dpr * MASK_SCALE) / 4;
      pass(this.rtBg, this.rtBgM, 0, 0); // full res -> half res (the viewport is already half res)
      for (let i = 0; i < 3; i++) {
        pass(this.rtBgM, this.rtB, step, 0);
        pass(this.rtB, this.rtBgM, 0, step);
      }
      gl.viewport(0, 0, this.rtBg.w, this.rtBg.h);
      pass(this.rtBgM, this.rtBg, 0, 0); // and back up
      gl.viewport(0, 0, this.rtA.w, this.rtA.h);
    }

    // Which chains have anything to blur. Frost and elevation share a target
    // (frost in .r, elevation in .g), so that chain runs if either is set.
    const n = list.length;
    let hasFrost = false, hasTint = false, hasElev = false;
    for (let i = 0; i < n; i++) {
      if (this.FR[i] > 0.002) hasFrost = true;
      if (this.T[i * 4 + 3] > 0.002) hasTint = true;
      if (this.EL[i] > 0.002) hasElev = true;
    }
    // A reflective material reads the same blurred copies frost does — that is
    // the whole trick behind roughness costing nothing — so the chain has to
    // run for it too. Without this, metal at frost 0 sampled whatever those
    // targets happened to hold, which drew ghosts of the previous pass inside
    // every panel.
    const reflective = s.material === "metal" || s.material === "crystal";
    if (hasFrost || reflective) {
      // Ping-pong arranged so the sixth pass lands in rtBgM; this used to end
      // in the scratch target and spend a seventh pass copying it across.
      pass(this.rtBg, this.rtB, 1.5 * k, 0); pass(this.rtB, this.rtBgM, 0, 2.5 * k);
      pass(this.rtBgM, this.rtB, 2.5 * k, 0); pass(this.rtB, this.rtBgM, 0, 2.5 * k);
      pass(this.rtBgM, this.rtB, 2.5 * k, 0); pass(this.rtB, this.rtBgM, 0, 2.5 * k);
      pass(this.rtBgM, this.rtB, 5 * k, 0); pass(this.rtB, this.rtBgH, 0, 5 * k);
      pass(this.rtBgH, this.rtB, 5 * k, 0); pass(this.rtB, this.rtBgH, 0, 5 * k);
      pass(this.rtBgH, this.rtB, 5 * k, 0); pass(this.rtB, this.rtBgH, 0, 5 * k);
    }


    // 1. silhouette
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.rtA.fb);
    gl.viewport(0, 0, this.rtA.w, this.rtA.h);
    gl.useProgram(this.progs.mask.pr);
    setCommon(this.progs.mask.u, this.dpr * MASK_SCALE);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 1b. tint and frost layers
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.mrtFb);
    gl.useProgram(this.progs.tint.pr);
    setCommon(this.progs.tint.u, this.dpr * MASK_SCALE);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. outline field (rtA), tint and frost (same blur), and height field (rtC).
    // A chain whose input is all zero is skipped: blurring zeros gives zeros,
    // and the composite reads the tint through its alpha, so an unblurred
    // colour under a zero alpha is invisible.
    gl.useProgram(bl.pr);
    gl.uniform1i(bl.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    const so = 1.4 * k * s.smoothness;
    for (let i = 0; i < 3; i++) { pass(this.rtA, this.rtB, so, 0); pass(this.rtB, this.rtA, 0, so); }
    if (hasTint) for (let i = 0; i < 3; i++) { pass(this.rtT, this.rtB, so, 0); pass(this.rtB, this.rtT, 0, so); }
    if (hasFrost || hasElev) for (let i = 0; i < 3; i++) { pass(this.rtFr, this.rtB, so, 0); pass(this.rtB, this.rtFr, 0, so); }
    pass(this.rtA, this.rtB, 2 * k, 0); pass(this.rtB, this.rtC, 0, 2 * k);
    for (let i = 0; i < 3; i++) { pass(this.rtC, this.rtB, 2 * k, 0); pass(this.rtB, this.rtC, 0, 2 * k); }

    // 3. composite
    const c = this.progs.comp;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(c.pr);
    setCommon(c.u, this.dpr);
    gl.uniform1f(c.u.uRefract, s.refraction);
    gl.uniform1f(c.u.uDisp, s.dispersion);
    gl.uniform1f(c.u.uRim, s.rim);
    const mode = s.rimColor === "iridescent" ? 0 : s.rimColor === "tint" ? 2 : 1;
    gl.uniform1f(c.u.uRimMode, mode);
    gl.uniform3fv(c.u.uRimColor, mode === 1 ? this.rgb(s.rimColor) : [1, 1, 1]);
    gl.uniform1f(c.u.uRimWidth, s.rimWidth);
    gl.uniform1f(c.u.uSpec, s.highlight);
    gl.uniform1f(c.u.uHair, s.edgeLine);
    gl.uniform1f(c.u.uShim, s.shimmer);
    gl.uniform1f(c.u.uGlow, s.glow);
    gl.uniform1f(c.u.uWash, s.wash);
    gl.uniform1f(c.u.uGrain, s.grain);
    gl.uniform1f(c.u.uMat, Math.max(0, MATERIALS.indexOf(s.material)));
    gl.uniform3f(c.u.uLightDir, s.lightDir[0], s.lightDir[1], s.lightDir[2]);
    gl.uniform1f(c.u.uRough, s.roughness);
    gl.uniform1f(c.u.uAniso, s.anisotropy);
    gl.uniform1f(c.u.uEdge, s.edge);
    gl.uniform1f(c.u.uEdgeScale, s.edgeScale);
    gl.uniform1f(c.u.uEdgeSharp, s.edgeSharpness);
    gl.uniform1f(c.u.uThick, s.thickness);
    gl.uniform1f(c.u.uTension, s.tension);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.rtC.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.rtA.tex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.rtT.tex);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.rtBg.tex);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, this.rtBgM.tex);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, this.rtBgH.tex);
    gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, this.rtFr.tex);
    gl.uniform1i(c.u.uBg, 3); gl.uniform1i(c.u.uBgM, 4); gl.uniform1i(c.u.uBgH, 5); gl.uniform1i(c.u.uFrost, 6);
    gl.uniform1i(c.u.uH, 0);
    gl.uniform1i(c.u.uS, 1);
    gl.uniform1i(c.u.uTint, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }

  private rgbCache = new Map<string, [number, number, number]>();
  private rgb(hex: string): [number, number, number] {
    let v = this.rgbCache.get(hex);
    if (!v) { v = this.rgbParse(hex); this.rgbCache.set(hex, v); }
    return v;
  }
  private rgbParse(hex: string): [number, number, number] {
    let c = this.tintCache.get(hex);
    if (!c) { c = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hexToRgb(hex) : [1, 1, 1]; this.tintCache.set(hex, c); }
    return c;
  }

  private program(fsrc: string): Prog {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error(log || "shader compile failed");
      }
      return sh;
    };
    const pr = gl.createProgram()!;
    // Shader objects outlive the call that compiled them: a program holds a
    // reference, and deleteProgram() alone does not free one that was never
    // flagged. Ten of them stranded per initGL() — once per StrictMode
    // remount and once per context restore. Detach and delete here and the
    // program is the only thing left to free.
    const attached: WebGLShader[] = [];
    try {
      const vs = compile(gl.VERTEX_SHADER, vert);
      let fs: WebGLShader;
      try { fs = compile(gl.FRAGMENT_SHADER, fsrc); } catch (e) { gl.deleteShader(vs); throw e; }
      gl.attachShader(pr, vs); attached.push(vs);
      gl.attachShader(pr, fs); attached.push(fs);
      gl.bindAttribLocation(pr, 0, "p");
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr) || "program link failed");
    } catch (e) {
      gl.deleteProgram(pr);
      throw e;
    } finally {
      attached.forEach(sh => { gl.detachShader(pr, sh); gl.deleteShader(sh); });
    }
    const u: Prog["u"] = {};
    UNIFORMS.forEach(n => { u[n] = gl.getUniformLocation(pr, n); });
    this.owned.prog.push(pr);
    return { pr, u };
  }

  private target(): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    this.owned.tex.push(tex); this.owned.fb.push(fb);
    return { tex, fb, w: 0, h: 0 };
  }
}
