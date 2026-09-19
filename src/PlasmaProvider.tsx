import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BackgroundSource, MaterialName, PlasmaRenderer, RendererSettings } from "./renderer";
import { Mood, MoodName, resolveMood } from "./moods";

export interface PlasmaProviderProps {
  children?: React.ReactNode;
  /** Preset name or a custom mood. */
  mood?: MoodName | Mood;
  /** "auto" follows prefers-color-scheme and a data-theme attribute on <html>. */
  theme?: "auto" | "light" | "dark";
  /** Override the mood's fuse distance in px. */
  blend?: number;
  /** Lens strength multiplier. Default 1. */
  refraction?: number;
  /** Color-splitting multiplier. Default 1. */
  dispersion?: number;
  /** Colored rim strength. 0 turns it off. Default 1. */
  rim?: number;
  /** Rim color: "iridescent", "tint" (follows each surface's tint), or a hex color. Default "iridescent". */
  rimColor?: "iridescent" | "tint" | (string & {});
  /** Rim width multiplier. Default 1. */
  rimWidth?: number;
  /** Strength of the highlight that faces the pointer. 0 turns it off. Default 1. */
  highlight?: number;
  /** How the pointer highlight reflects in the edge, 0-1: 0 the broad, matte glow (the default); 1 a compact reflection of a light held above the pointer, sitting in the bevel like a lamp in the rim of a glass. Plasma material only. */
  highlightSharpness?: number;
  /** Strength of the thin line along the outline. 0 turns it off. Default 1. */
  edgeLine?: number;
  /**
   * The slow iridescent sheen that drifts across the body of each surface.
   * 0 turns it off. Default 1. Set it to 0 along with `rim`, `highlight`,
   * `edgeLine`, `glow` and `wash` for plain water - see "Clear as water" in
   * the README.
   */
  shimmer?: number;
  /** Colored bloom the plasma casts onto the background around it. 0 turns it off. Default 1. */
  glow?: number;
  /**
   * How much of its own cast the material puts on what you see through it -
   * a slight desaturation and lift. 0 passes the background through
   * untouched. Default 1.
   */
  wash?: number;
  /** Film grain over the background (never over the surfaces). 0 turns it off. Default 1. */
  grain?: number;
  /**
   * What the surfaces are made of: "plasma" (the default), "crystal",
   * "metal", "wood", "stone" or "cloud". Every material shares the same
   * geometry, springs and fusing and differs only in how it is shaded.
   */
  material?: MaterialName;
  /**
   * Where the one light comes from, as a direction. Every opaque material
   * reads it, so two of them on a page agree about the sun. Default is up and
   * to the left, in front.
   */
  lightDir?: [number, number, number];
  /** Surface finish for metal: 0 is a mirror, 1 is chalk. Default 0.28. */
  roughness?: number;
  /** How far a highlight stretches along the grain. 0 is isotropic. Default 0. */
  anisotropy?: number;
  /**
   * How far the outline is displaced from its rounded box, in CSS px. A
   * rounded rectangle is right for a liquid and wrong for almost everything
   * else: stone chips, cloud billows, cut metal does neither. Default 0.
   */
  edge?: number;
  /** Size of that displacement, in cycles per px: small is billows, large is chips. Default 0.01. */
  edgeScale?: number;
  /** 0 rolls the displaced edge, 1 breaks it into flats and points. Default 0. */
  edgeSharpness?: number;
  /** How thick a panel is as a solid, in CSS px. The marched materials light a body of this depth. Default 18. */
  thickness?: number;
  /** Surface tension: how hard a material pulls its own shape toward a bead, and how eagerly two merge. Default 0. */
  tension?: number;
  /** Blur the background itself, in CSS px, 0-40. Softens the whole field, unlike `frost`, which blurs only what a frosted surface sees. Default 0. */
  backgroundBlur?: number;
  /**
   * What the canvas shows where there is no surface. "field" paints the
   * background everywhere. "clear" leaves it transparent, so this provider's
   * canvas can sit above other content - a dialog above a scrim - and draw
   * only its surfaces, their shadows and rims; what they refract is the
   * `background` source, usually another provider's canvas. Default "field".
   */
  ground?: "field" | "clear";
  /**
   * Keep each frame after it is shown, so another provider can pass this
   * canvas as its `background` and sample it live (the pair a clear-ground
   * overlay needs). Costs a copy per frame. Fixed at creation. Default false.
   */
  preserveDrawingBuffer?: boolean;
  /** How thick the material feels: 0 is watery and bouncy, 1 is slow like syrup. Also scales drag and snap springs. Default 0.5. */
  viscosity?: number;
  /** How far the plasma trails and stretches behind moving panels. 0 turns it off. Default 1. */
  stretch?: number;
  /** Slow ripple along the edges. Default 0 (still edges). */
  flow?: number;
  /** Background: any CSS color (subtle luminance drift), an image URL or data URI (refracted, slow swirl), or an img/canvas/video element - canvas and video update live. Change it any time. Omit for the procedural mood field. */
  background?: BackgroundSource;
  /** Default corner radius (px) for every surface. Default 26. */
  radius?: number;
  /** Plasma tint color (hex). Default "#ffffff". */
  tint?: string;
  /** Tint strength from 0 (clear) to 1 (solid color). Default 0. */
  opacity?: number;
  /** Translucency from 0 (clear) to 1 (frosted). Default 0. */
  frost?: number;
  /** How high surfaces float: 0 sits flat with no shadow, 1 floats high with a deep soft shadow. Dragged surfaces raise automatically. Default 0.35. */
  elevation?: number;
  /** Outline smoothing multiplier. Default 1. */
  smoothness?: number;
  /** Show a liquid drop that follows the pointer. Default true. */
  pointerDrop?: boolean;
  /** Decorative drops orbiting near the bottom right. Default false. */
  ambientDrops?: boolean;
  /** Grid cell size used when a draggable panel snaps. Default 24. */
  grid?: number;
  /** Edge latch distance for snapping. Default 40. */
  magnet?: number;
  /** Maximum device pixel ratio for the canvas. Default 1.25. */
  quality?: number;
  /**
   * Touch devices only: during a fling, pin the last drawn frame to the page
   * and pause, so the compositor scrolls it with the content; resume when the
   * scrolling stops. Off by default. Needs the canvas's positioned ancestor,
   * if any, to scroll with the page.
   */
  freezeOnScroll?: boolean;
  /** Maximum visible plasma surfaces at once. Raising it costs GPU time; changing it rebuilds the shaders. Default 16. */
  maxSurfaces?: number;
  /** z-index of the canvas this provider renders. Default -1 (behind content). Ignored when `canvas` is false. */
  zIndex?: number;
  /**
   * Whether the provider renders the canvas itself. Set false and place a
   * `<PlasmaCanvas />` anywhere in the tree to control where the element
   * lives and how it is styled. Default true.
   */
  canvas?: boolean;
}

/**
 * The parts of the context that exist for the provider's lifetime. This value
 * is stable: it changes once when the renderer is created and then only if
 * the reduced-motion preference does, so `usePlasmaRuntime()` consumers are
 * not re-rendered by every styling change.
 */
export interface PlasmaRuntime {
  renderer: PlasmaRenderer | null;
  /** False when WebGL2 is unavailable; <Plasma> falls back to a CSS frosted panel. */
  supported: boolean;
  reducedMotion: boolean;
  pulse: (x: number, y: number, strength?: number) => void;
  bump: (energy: number) => void;
}

/** The provider-level values a surface falls back to, and the layout settings. */
export interface PlasmaDefaults {
  tint: string;
  opacity: number;
  frost: number;
  radius: number;
  grid: number;
  magnet: number;
  spring: Mood["spring"];
}

/** Everything `usePlasma()` returns: the runtime and the defaults together. */
export interface PlasmaContextValue extends PlasmaRuntime, PlasmaDefaults {}

const noop = () => {};
const DEFAULT_RUNTIME: PlasmaRuntime = { renderer: null, supported: false, reducedMotion: false, pulse: noop, bump: noop };
const DEFAULT_DEFAULTS: PlasmaDefaults = {
  tint: "#ffffff", opacity: 0, frost: 0, radius: 26, grid: 24, magnet: 40,
  spring: { stiffness: 170, damping: 16 },
};

const RuntimeContext = createContext<PlasmaRuntime>(DEFAULT_RUNTIME);
const DefaultsContext = createContext<PlasmaDefaults>(DEFAULT_DEFAULTS);
/** Set by the provider; a <PlasmaCanvas> hands its element back through this. */
const AttachContext = createContext<((el: HTMLCanvasElement | null) => void) | null>(null);

/** Renderer, support flag and commands. Stable - use this when you only need `pulse`. */
export const usePlasmaRuntime = () => useContext(RuntimeContext);
/** Provider-level tint, opacity, frost, radius, grid, magnet and spring. */
export const usePlasmaDefaults = () => useContext(DefaultsContext);

/** Everything at once. Re-renders on any provider change; prefer the narrower hooks. */
export function usePlasma(): PlasmaContextValue {
  const runtime = usePlasmaRuntime();
  const defaults = usePlasmaDefaults();
  return useMemo(() => ({ ...runtime, ...defaults }), [runtime, defaults]);
}

// Declared locally so the library needs no @types/node, while the expression
// below stays the literal text every bundler substitutes - so the dev-only
// warnings drop out of a production build entirely.
declare const process: { env: { NODE_ENV?: string } } | undefined;
/** True in every build except a production one. */
export const DEV = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

/**
 * useLayoutEffect on the client, useEffect on the server - React warns about
 * the former during SSR, and none of this work means anything there anyway.
 */
export const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Keeps a ref pointing at the newest value without writing to it during render. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useIsoLayoutEffect(() => { ref.current = value; });
  return ref;
}

const FALLBACK_CSS = `
.plasma-panel{box-sizing:border-box}
.plasma-fallback{
  background:linear-gradient(160deg,rgb(255 255 255/.14),rgb(255 255 255/.05));
  -webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);
  border:1px solid rgb(255 255 255/.22);
  box-shadow:inset 0 1px 0 rgb(255 255 255/.25),0 20px 40px -20px rgb(0 0 0/.5);
}
.plasma-panel[data-plasma-draggable]{touch-action:none;cursor:grab}
.plasma-panel[data-plasma-dragging]{cursor:grabbing;user-select:none}
`;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(q.matches);
    on(); q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return reduced;
}

export interface PlasmaCanvasProps {
  className?: string;
  style?: React.CSSProperties;
  /** z-index of the canvas. Default -1 (behind content). */
  zIndex?: number;
}

/**
 * The canvas the plasma is drawn on. The provider renders one by default;
 * render this yourself (with `canvas={false}` on the provider) to choose
 * where the element sits in the DOM and how it is styled.
 *
 * The drawn region is still the whole viewport - this controls the element,
 * not the area the renderer covers. Clipping the field to a container is not
 * supported yet.
 */
export function PlasmaCanvas({ className, style, zIndex = -1 }: PlasmaCanvasProps) {
  const attach = useContext(AttachContext);
  const { supported } = usePlasmaRuntime();
  useEffect(() => {
    if (DEV && !attach) console.warn("[plasma-ui] <PlasmaCanvas> must be rendered inside a <PlasmaProvider>.");
  }, [attach]);
  return (
    <canvas
      ref={attach ?? undefined}
      aria-hidden="true"
      className={className}
      style={{
        position: "fixed", inset: 0, width: "100%", height: "100%", zIndex,
        pointerEvents: "none", display: supported ? "block" : "none",
        ...style,
      }}
    />
  );
}

export function PlasmaProvider({
  children, mood = "tidal", theme = "auto", blend, refraction = 1, dispersion = 1, rim = 1, smoothness = 1,
  background, radius = 26, tint = "#ffffff", opacity = 0, frost = 0, elevation = 0.35, viscosity = 0.5, stretch = 1, flow = 0, rimColor = "iridescent", rimWidth = 1, highlight = 1, highlightSharpness = 0, edgeLine = 1,
  shimmer = 1, glow = 1, wash = 1, grain = 1, backgroundBlur = 0, ground = "field", preserveDrawingBuffer = false,
  material = "plasma", lightDir = [-0.42, -0.62, 0.66], roughness = 0.28, anisotropy = 0,
  edge = 0, edgeScale = 0.01, edgeSharpness = 0, thickness = 18, tension = 0,
  pointerDrop = true, ambientDrops = false, grid = 24, magnet = 40, quality = 1.25, maxSurfaces = 16, zIndex = -1,
  freezeOnScroll = false, canvas = true,
}: PlasmaProviderProps) {
  // The canvas arrives through a callback ref - from the one below, or from a
  // <PlasmaCanvas> the consumer placed. Children commit before this component's
  // own effects run, so either way the element is here by the time the
  // renderer is created.
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [renderer, setRenderer] = useState<PlasmaRenderer | null>(null);
  const [supported, setSupported] = useState(true);
  const reducedMotion = useReducedMotion();
  const m = resolveMood(mood);

  const settings: RendererSettings = {
    colors: m.colors, blend: blend ?? m.blend, refraction, dispersion, rim, smoothness,
    pointerDrop: pointerDrop && !reducedMotion, ambientDrops, theme, quality, reducedMotion, freezeOnScroll, tint, opacity,
    rimColor, rimWidth, highlight, highlightSharpness, edgeLine, shimmer, glow, wash, grain, backgroundBlur, ground, preserveDrawingBuffer,
    material, lightDir, roughness, anisotropy, edge, edgeScale, edgeSharpness, thickness, tension,
    viscosity, stretch, flow, frost, elevation, maxSurfaces, background: background ?? null,
  };
  const settingsRef = useLatest(settings);

  useIsoLayoutEffect(() => {
    if (!canvasEl) return;
    const r = PlasmaRenderer.create(canvasEl, settingsRef.current);
    if (!r) { setSupported(false); return; }
    setSupported(true);
    setRenderer(r);
    return () => { r.destroy(); setRenderer(null); };
    // settingsRef is a stable ref; the renderer picks up later changes through configure().
  }, [canvasEl]);

  useEffect(() => {
    if (!DEV || canvasEl) return;
    // Deferred by a tick: with canvas={false} a <PlasmaCanvas> child attaches
    // during the same commit, and this would fire before it did.
    const t = setTimeout(() => console.warn("[plasma-ui] PlasmaProvider has no canvas. Either leave `canvas` on, or render a <PlasmaCanvas /> inside the provider."), 0);
    return () => clearTimeout(t);
  }, [canvasEl]);

  // Every renderer setting flattened to a primitive. Deriving the dependencies
  // from the settings object instead of listing them by hand means a new field
  // goes live the moment it is added: the hand-written list had to be edited
  // in lockstep, and a missed entry silently froze that prop at its mount
  // value with nothing to catch it. `settings` is a fixed object literal, so
  // this array's length and order are the same on every render.
  const settingsDeps = Object.values(settings).map(v => (Array.isArray(v) ? v.join() : v));
  useEffect(() => { renderer?.configure(settings); }, [renderer, ...settingsDeps]);

  // Viscosity scales the UI springs too: thinner is snappier and bouncier, thicker is slower and calmer.
  const vis = Math.min(Math.max(viscosity, 0), 1);
  const stiffK = vis < 0.5 ? 1.6 - 1.2 * vis : 1 - 1.1 * (vis - 0.5);
  const dampK = vis < 0.5 ? 0.6 + 0.8 * vis : 1 + 1.6 * (vis - 0.5);
  const stiffness = m.spring.stiffness * stiffK;
  const damping = m.spring.damping * dampK * Math.sqrt(stiffK);

  // pulse and bump read the renderer through a ref, so the runtime value does
  // not change identity when the renderer is replaced mid-session.
  const rendererRef = useLatest(renderer);
  const pulse = useCallback<PlasmaRuntime["pulse"]>((x, y, s) => rendererRef.current?.pulse(x, y, s), []);
  const bump = useCallback<PlasmaRuntime["bump"]>(e => rendererRef.current?.bump(e), []);

  const runtime = useMemo<PlasmaRuntime>(
    () => ({ renderer, supported, reducedMotion, pulse, bump }),
    [renderer, supported, reducedMotion, pulse, bump],
  );
  const defaults = useMemo<PlasmaDefaults>(
    () => ({ tint, opacity, frost, radius, grid, magnet, spring: { stiffness, damping } }),
    [tint, opacity, frost, radius, grid, magnet, stiffness, damping],
  );

  return (
    <RuntimeContext.Provider value={runtime}>
      <DefaultsContext.Provider value={defaults}>
        <AttachContext.Provider value={setCanvasEl}>
          <style>{FALLBACK_CSS}</style>
          {canvas && <PlasmaCanvas zIndex={zIndex} />}
          {children}
        </AttachContext.Provider>
      </DefaultsContext.Provider>
    </RuntimeContext.Provider>
  );
}
