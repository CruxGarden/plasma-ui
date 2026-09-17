import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BackgroundSource, PlasmaRenderer, RendererSettings } from "./renderer";
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
  /** Strength of the thin line along the outline. 0 turns it off. Default 1. */
  edgeLine?: number;
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
  /** Maximum visible plasma surfaces. Compiled into the shaders, so it is fixed for the provider's lifetime; more surfaces cost GPU time. Default 16. */
  maxSurfaces?: number;
  /** z-index of the fixed canvas. Default -1 (behind content). */
  zIndex?: number;
}

export interface PlasmaContextValue {
  renderer: PlasmaRenderer | null;
  /** Provider-level tint and opacity, used by the CSS fallback. */
  tint: string;
  opacity: number;
  frost: number;
  /** Provider-level default corner radius. */
  radius: number;
  /** False when WebGL2 is unavailable; <Plasma> falls back to a CSS frosted panel. */
  supported: boolean;
  grid: number;
  magnet: number;
  spring: Mood["spring"];
  reducedMotion: boolean;
  pulse: (x: number, y: number, strength?: number) => void;
  bump: (energy: number) => void;
}

const noop = () => {};
const PlasmaContext = createContext<PlasmaContextValue>({
  renderer: null, tint: "#ffffff", opacity: 0, frost: 0, radius: 26, supported: false, grid: 24, magnet: 40,
  spring: { stiffness: 170, damping: 16 }, reducedMotion: false, pulse: noop, bump: noop,
});

export const usePlasma = () => useContext(PlasmaContext);

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

export function PlasmaProvider({
  children, mood = "tidal", theme = "auto", blend, refraction = 1, dispersion = 1, rim = 1, smoothness = 1,
  background, radius = 26, tint = "#ffffff", opacity = 0, frost = 0, elevation = 0.35, viscosity = 0.5, stretch = 1, flow = 0, rimColor = "iridescent", rimWidth = 1, highlight = 1, edgeLine = 1,
  pointerDrop = true, ambientDrops = false, grid = 24, magnet = 40, quality = 1.25, maxSurfaces = 16, zIndex = -1,
}: PlasmaProviderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderer, setRenderer] = useState<PlasmaRenderer | null>(null);
  const [supported, setSupported] = useState(true);
  const reducedMotion = useReducedMotion();
  const m = resolveMood(mood);

  const settings: RendererSettings = {
    colors: m.colors, blend: blend ?? m.blend, refraction, dispersion, rim, smoothness,
    pointerDrop: pointerDrop && !reducedMotion, ambientDrops, theme, quality, reducedMotion, tint, opacity,
    rimColor, rimWidth, highlight, edgeLine, viscosity, stretch, flow, frost, elevation, maxSurfaces, background: background ?? null,
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useLayoutEffect(() => {
    const r = PlasmaRenderer.create(canvasRef.current!, settingsRef.current);
    if (!r) { setSupported(false); return; }
    setRenderer(r);
    return () => { r.destroy(); setRenderer(null); };
  }, []);

  useEffect(() => { renderer?.configure(settings); }, [
    renderer, m.colors.join(), settings.blend, refraction, dispersion, rim, smoothness,
    settings.pointerDrop, ambientDrops, theme, quality, reducedMotion, tint, opacity,
    rimColor, rimWidth, highlight, edgeLine, viscosity, stretch, flow, frost, elevation, background,
  ]);

  // Viscosity scales the UI springs too: thinner is snappier and bouncier, thicker is slower and calmer.
  const vis = Math.min(Math.max(viscosity, 0), 1);
  const stiffK = vis < 0.5 ? 1.6 - 1.2 * vis : 1 - 1.1 * (vis - 0.5);
  const dampK = vis < 0.5 ? 0.6 + 0.8 * vis : 1 + 1.6 * (vis - 0.5);
  const spring = { stiffness: m.spring.stiffness * stiffK, damping: m.spring.damping * dampK * Math.sqrt(stiffK) };

  const value = useMemo<PlasmaContextValue>(() => ({
    renderer, tint, opacity, frost, radius, supported, grid, magnet, spring, reducedMotion,
    pulse: (x, y, s) => renderer?.pulse(x, y, s),
    bump: e => renderer?.bump(e),
  }), [renderer, tint, opacity, frost, radius, supported, grid, magnet, spring.stiffness, spring.damping, reducedMotion]);

  return (
    <PlasmaContext.Provider value={value}>
      <style>{FALLBACK_CSS}</style>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "fixed", inset: 0, width: "100%", height: "100%", zIndex,
          pointerEvents: "none", display: supported ? "block" : "none",
        }}
      />
      {children}
    </PlasmaContext.Provider>
  );
}
