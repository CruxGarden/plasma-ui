import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PlasmaProvider,
  Plasma,
  usePlasma,
  moods,
  MoodName,
  Offset,
} from "../src";

type Theme = "auto" | "light" | "dark";
interface Settings {
  mood: MoodName;
  theme: Theme;
  blend: number;
  refraction: number;
  dispersion: number;
  rim: number;
  radius: number;
  tint: string;
  opacity: number;
  frost: number;
  elevation: number;
  panelColors: boolean;
  viscosity: number;
  stretch: number;
  flow: number;
  rimStyle: "iridescent" | "color" | "tint";
  rimHex: string;
  rimWidth: number;
  highlight: number;
  highlightSharpness: number;
  edgeLine: number;
  shimmer: number;
  glow: number;
  wash: number;
  grain: number;
  backgroundBlur: number;
  smoothness: number;
  pointerDrop: boolean;
  ambientDrops: boolean;
  grid: number;
  magnet: number;
}
const DEFAULTS: Settings = {
  mood: "tidal",
  // Dark, not the device's preference. The light theme washes the mood field
  // with 58% white, and the colour is the point of the page. The theme control
  // below still offers auto and light - this is only where it starts.
  theme: "dark",
  blend: 40,
  refraction: 1,
  dispersion: 1,
  rim: 1,
  radius: 26,
  tint: "#ffffff",
  opacity: 0,
  frost: 0,
  elevation: 0.35,
  panelColors: false,
  viscosity: 0.5,
  stretch: 1,
  flow: 0,
  rimStyle: "iridescent",
  rimHex: "#9ff3e4",
  rimWidth: 1,
  highlight: 1,
  highlightSharpness: 0,
  edgeLine: 1,
  shimmer: 1,
  glow: 1,
  wash: 1,
  grain: 1,
  backgroundBlur: 0,
  smoothness: 1,
  pointerDrop: true,
  ambientDrops: false,
  grid: 24,
  magnet: 40,
};

/**
 * Mobile scroll experiment: pin the plasma to the page during a fling and
 * resume when it stops. Flip to false to compare against the live renderer.
 */
const FREEZE_ON_SCROLL = true;

const PANEL_W = 216,
  PANEL_H = 144;
// Full configurations shown in the nav: one look per use case.
const CONFIGS: { name: string; blurb: string; patch: Partial<Settings> }[] = [
  {
    name: "Lumen",
    blurb: "Clear plasma, iridescent rim. The default look.",
    patch: {
      mood: "tidal",
      tint: "#ffffff",
      opacity: 0,
      frost: 0,
      panelColors: false,
      rimStyle: "iridescent",
      rimHex: "#9ff3e4",
      rim: 1,
      rimWidth: 1,
      highlight: 1,
      highlightSharpness: 0,
      shimmer: 1,
      glow: 1,
      wash: 1,
      grain: 1,
      backgroundBlur: 0,
      edgeLine: 1,
      viscosity: 0.5,
      stretch: 1,
      flow: 0,
      blend: 40,
      refraction: 1,
      dispersion: 1,
      smoothness: 1,
      elevation: 0.35,
      ambientDrops: false,
    },
  },
  {
    name: "Studio",
    blurb: "Frosted workspace. Calm motion, quiet edges.",
    patch: {
      mood: "tidal",
      tint: "#000000",
      // A black tint has to carry far more weight than the white one did: at
      // 8% it just greyed the mood field instead of reading as a dark panel.
      opacity: 0.55,
      frost: 0.85,
      panelColors: false,
      rimStyle: "iridescent",
      rim: 0.25,
      rimWidth: 0.7,
      highlight: 0.4,
      highlightSharpness: 0,
      shimmer: 0.6,
      glow: 0.5,
      wash: 1,
      grain: 1,
      backgroundBlur: 0,
      edgeLine: 0.8,
      viscosity: 0.7,
      stretch: 0.4,
      flow: 0,
      blend: 32,
      refraction: 0.6,
      dispersion: 0.4,
      smoothness: 1,
      elevation: 0.2,
      ambientDrops: false,
    },
  },
  {
    name: "Slate",
    blurb: "Opaque panels, no shine. Reads as a plain app.",
    patch: {
      mood: "tidal",
      tint: "#1c2733",
      opacity: 1,
      frost: 0,
      panelColors: false,
      rimStyle: "color",
      rimHex: "#3d4c5c",
      rim: 0.5,
      rimWidth: 0.6,
      highlight: 0,
      highlightSharpness: 0,
      shimmer: 0,
      glow: 0,
      wash: 0,
      grain: 0.4,
      backgroundBlur: 0,
      edgeLine: 0.6,
      viscosity: 0.6,
      stretch: 0,
      flow: 0,
      blend: 40,
      refraction: 0,
      dispersion: 0,
      smoothness: 1,
      elevation: 0.12,
      ambientDrops: false,
    },
  },
  {
    name: "Aqua",
    blurb: "Clear as water. Every sheen off, only the lens remains.",
    patch: {
      mood: "tidal",
      tint: "#ffffff",
      opacity: 0,
      frost: 0,
      panelColors: false,
      rimStyle: "iridescent",
      rimHex: "#9ff3e4",
      // The six controls that give the material a look of its own, all off.
      rim: 0,
      shimmer: 0,
      glow: 0,
      wash: 0,
      grain: 0,
      highlight: 0,
      highlightSharpness: 0,
      edgeLine: 0.35, // a hairline is what still reads as an edge once the rim is gone
      rimWidth: 1,
      backgroundBlur: 0,
      viscosity: 0.35,
      stretch: 1,
      flow: 0.4,
      blend: 40,
      refraction: 1.5,
      dispersion: 1.6,
      smoothness: 1,
      elevation: 0,
      ambientDrops: false,
    },
  },
  {
    name: "Neon",
    blurb: "Dark tinted panels, colored rims, fast and springy.",
    patch: {
      mood: "ember",
      tint: "#160b1e",
      opacity: 0.75,
      frost: 0.2,
      panelColors: false,
      rimStyle: "color",
      rimHex: "#ff2d95",
      rim: 1.6,
      rimWidth: 1.3,
      highlight: 0.6,
      shimmer: 1.4,
      glow: 1.4,
      wash: 1,
      grain: 1,
      backgroundBlur: 0,
      edgeLine: 1.4,
      viscosity: 0.15,
      stretch: 1.2,
      flow: 0,
      blend: 40,
      refraction: 1,
      dispersion: 2,
      smoothness: 1,
      elevation: 0.55,
      ambientDrops: false,
    },
  },
  {
    name: "Entropy",
    blurb: "Every motion field at maximum. Wobbly, dreamy, never still.",
    patch: {
      mood: "aurora",
      tint: "#ffffff",
      opacity: 0,
      frost: 0.25,
      panelColors: false,
      rimStyle: "iridescent",
      rim: 1.3,
      rimWidth: 1.4,
      highlight: 1,
      highlightSharpness: 0,
      shimmer: 1.6,
      glow: 1.4,
      wash: 1,
      grain: 1,
      backgroundBlur: 0,
      edgeLine: 1,
      viscosity: 0,
      stretch: 2.5,
      flow: 2,
      blend: 56,
      refraction: 1.4,
      dispersion: 2.2,
      smoothness: 1,
      elevation: 0.5,
      ambientDrops: true,
    },
  },
];

const MOTION_PRESETS = [
  { name: "Water", viscosity: 0.1, stretch: 1.3, flow: 0.6 },
  { name: "Gel", viscosity: 0.5, stretch: 1, flow: 0 },
  { name: "Honey", viscosity: 0.85, stretch: 1.8, flow: 0.3 },
  { name: "Solid", viscosity: 0.6, stretch: 0, flow: 0 },
];
const PANEL_COLORS = [
  "#ff5fa2",
  "#5fd4ff",
  "#b58cff",
  "#ffb347",
  "#6cf2a8",
  "#ff7a5c",
  "#7c9bff",
  "#f4e36b",
];
const PANEL_SEED = [
  { title: "Inbox", body: "4 unread, 2 flagged." },
  { title: "Tasks", body: "Ship the release notes." },
  { title: "Player", body: "Side B, 12:41 remaining." },
  { title: "Notes", body: "Draft for Thursday's demo." },
  { title: "Files", body: "23 items, 1.2 GB." },
  { title: "Metrics", body: "Up 12% this week." },
  { title: "Chat", body: "3 people online." },
  { title: "Calendar", body: "Next: standup at 10." },
];

export function App() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [config, setConfig] = useState<string | null>("Lumen");
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setConfig(null);
    setS((p) => ({ ...p, [k]: v }));
  };
  const applyConfig = (name: string) => {
    const c = CONFIGS.find((c) => c.name === name);
    if (!c) return;
    setConfig(name);
    setS((p) => ({ ...p, ...c.patch }));
  };

  useEffect(() => {
    if (s.theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = s.theme;
  }, [s.theme]);

  return (
    <PlasmaProvider
      mood={s.mood}
      theme={s.theme}
      freezeOnScroll={FREEZE_ON_SCROLL}
      blend={s.blend}
      refraction={s.refraction}
      dispersion={s.dispersion}
      rim={s.rim}
      smoothness={s.smoothness}
      radius={s.radius}
      tint={s.tint}
      opacity={s.opacity}
      frost={s.frost}
      elevation={s.elevation}
      viscosity={s.viscosity}
      stretch={s.stretch}
      flow={s.flow}
      rimColor={rimColorOf(s)}
      rimWidth={s.rimWidth}
      highlight={s.highlight}
      highlightSharpness={s.highlightSharpness}
      edgeLine={s.edgeLine}
      shimmer={s.shimmer}
      glow={s.glow}
      wash={s.wash}
      grain={s.grain}
      backgroundBlur={s.backgroundBlur}
      pointerDrop={s.pointerDrop}
      ambientDrops={s.ambientDrops}
      grid={s.grid}
      magnet={s.magnet}
    >
      <Nav config={config} apply={applyConfig} />
      <main
        style={{
          ["--plate-bg" as string]: `color-mix(in srgb, ${s.tint} ${Math.round(Math.min(Math.max(s.opacity, 0), 1) * 40)}%, var(--plate))`,
        }}
      >
        <Hero />
        <Usage />
        <Playground
          s={s}
          set={set}
          reset={() => {
            setS(DEFAULTS);
            setConfig("Lumen");
          }}
        />
        <Api />
        <Limitations />
        <footer className="footer">
          Plasma UI 0.1 · MIT license · a{" "}
          <a href="https://crux.garden">Crux Garden</a> project
        </footer>
      </main>
    </PlasmaProvider>
  );
}

function Nav({
  config,
  apply,
}: {
  config: string | null;
  apply: (name: string) => void;
}) {
  return (
    // Plain frosted CSS: content scrolls underneath, and one shared material would fuse with it.
    <nav className="nav plasma-fallback" aria-label="Sections">
      <a className="brand" href="#top">
        Plasma UI
      </a>
      <div className="nav-links">
        <a href="#playground">Playground</a>
        <a href="#api">API</a>
        <a href="examples/workspace/" target="_blank" rel="noreferrer">
          Example app
        </a>
      </div>
      <div className="seg" role="group" aria-label="Configuration">
        {CONFIGS.map((c) => (
          <button
            key={c.name}
            aria-pressed={config === c.name}
            title={c.blurb}
            onClick={() => apply(c.name)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <a
        className="repo"
        href="https://github.com/CruxGarden/plasma-ui"
        target="_blank"
        rel="noreferrer"
        title="Plasma UI on GitHub"
        aria-label="Plasma UI on GitHub"
      >
        <svg
          viewBox="0 0 16 16"
          width="20"
          height="20"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
          />
        </svg>
      </a>
    </nav>
  );
}

function Hero() {
  const { pulse } = usePlasma();
  return (
    <section className="hero" id="top">
      <div className="hero-stack">
        <Plasma className="hero-title" radius={36}>
          <h1>Plasma UI</h1>
          <p className="lede">
            Liquid panels for React, rendered in WebGL on canvas. Every panel is
            one shared plasma: they fuse on contact, refract what's behind them,
            and snap to a grid.
          </p>
          <div className="row">
            <a className="btn primary" href="#playground">
              Open the playground
            </a>
            <button
              className="btn"
              onClick={(e) => pulse(e.clientX, e.clientY, 1)}
            >
              Send a pulse
            </button>
          </div>
          <p className="hero-note">
            For the best experience, use a desktop browser or app. The effect is
            GPU-heavy and does not run well on mobile.
          </p>
        </Plasma>
        <Plasma className="hero-install" radius={36}>
          <code>npm install @cruxgarden/plasma-ui</code>
        </Plasma>
      </div>
    </section>
  );
}

function Playground({
  s,
  set,
  reset,
}: {
  s: Settings;
  set: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  reset: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const { pulse } = usePlasma();
  const [count, setCount] = useState(5);
  const [offsets, setOffsets] = useState<Offset[]>([]);
  const [joined, setJoined] = useState<boolean[]>([]);

  const cols = () =>
    Math.max(
      1,
      Math.floor(((stage.current?.clientWidth ?? 700) - s.grid) / PANEL_W),
    );
  const arrange = (n = count) =>
    setOffsets(
      Array.from({ length: PANEL_SEED.length }, (_, i) => {
        const c = Math.min(cols(), 4);
        return {
          x: s.grid + (i % c) * PANEL_W,
          y: s.grid + Math.floor(i / c) * PANEL_H,
        };
      }),
    );
  const scatter = () => {
    const w = stage.current?.clientWidth ?? 700,
      h = stage.current?.clientHeight ?? 560;
    const g = s.grid;
    const cellsX = Math.max(1, Math.floor((w - PANEL_W) / g)),
      cellsY = Math.max(1, Math.floor((h - PANEL_H) / g));
    setOffsets(
      Array.from({ length: PANEL_SEED.length }, () => ({
        x: Math.floor(Math.random() * cellsX) * g,
        y: Math.floor(Math.random() * cellsY) * g,
      })),
    );
  };

  // Starting composition in grid cells: a flush pair with a stepped neighbor, and a stepped pair.
  useEffect(() => {
    const g = s.grid,
      w = stage.current?.clientWidth ?? 700;
    const wide = [
      [1, 1],
      [10, 1],
      [19, 5],
      [4, 13],
      [13, 16],
      [19, 17],
      [1, 20],
      [19, 23],
    ];
    const narrow = [
      [0, 1],
      [0, 7],
      [5, 14],
      [0, 21],
      [5, 21],
      [0, 27],
      [5, 27],
      [0, 33],
    ];
    const cells = w >= 680 ? wide : narrow;
    setOffsets(
      cells.map(([cx, cy]) => ({
        x: Math.min(cx * 24, Math.max(0, w - PANEL_W)),
        y: cy * 24,
      })),
    );
  }, []);

  const code = useMemo(() => {
    const props = (Object.keys(DEFAULTS) as (keyof Settings)[])
      .filter(
        (k) =>
          (!["theme", "panelColors", "rimStyle", "rimHex"].includes(k) &&
            s[k] !== DEFAULTS[k]) ||
          k === "mood",
      )
      .map((k) =>
        typeof s[k] === "string" ? `${k}="${s[k]}"` : `${k}={${s[k]}}`,
      );
    const theme = s.theme !== "auto" ? [`theme="${s.theme}"`] : [];
    if (s.rimStyle !== "iridescent") theme.push(`rimColor="${rimColorOf(s)}"`);
    const panelProps = s.panelColors
      ? ` tint="${PANEL_COLORS[0]}" opacity={${Math.max(s.opacity, 0.35)}}`
      : "";
    return `<PlasmaProvider ${[...props, ...theme].join(" ")}>\n  <Plasma draggable bounds={stageRef}${panelProps}>\n    <h3>Inbox</h3>\n  </Plasma>\n</PlasmaProvider>`;
  }, [s]);

  const joinedCount = joined.slice(0, count).filter(Boolean).length;

  return (
    <section id="playground">
      <h2>Playground</h2>
      <p className="section-lede">
        Drag panels; they fuse on contact and snap to the grid on release. Throw
        one to stretch the plasma. Click empty space to send a pulse. The
        controls change the whole page.
      </p>
      <div className="play">
        <div className="stage-wrap">
          <div
            ref={stage}
            className="stage"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) pulse(e.clientX, e.clientY, 1);
            }}
          >
            {PANEL_SEED.slice(0, count).map((p, i) => (
              <Plasma
                key={p.title}
                className="panel"
                draggable
                bounds={stage}
                offset={offsets[i]}
                onDragEnd={(o) =>
                  setOffsets((prev) => prev.map((v, j) => (j === i ? o : v)))
                }
                onJoinChange={(j) =>
                  setJoined((prev) => {
                    const n = [...prev];
                    n[i] = j;
                    return n;
                  })
                }
                tint={s.panelColors ? PANEL_COLORS[i] : undefined}
                opacity={s.panelColors ? Math.max(s.opacity, 0.35) : undefined}
                padding={20}
                aria-label={`${p.title} panel. Use arrow keys to move.`}
                style={{ width: PANEL_W, height: PANEL_H }}
              >
                <div
                  className="plate"
                  style={plateStyle(
                    s.panelColors ? PANEL_COLORS[i] : s.tint,
                    s.panelColors ? Math.max(s.opacity, 0.35) : s.opacity,
                  )}
                >
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                  <span className="status">
                    {joined[i] ? "Joined" : "Standalone"}
                  </span>
                </div>
              </Plasma>
            ))}
          </div>
          <div className="stage-bar">
            <span>
              {count} panels, {joinedCount} joined
            </span>
            <span>{s.grid}px grid</span>
          </div>
        </div>

        <Plasma
          className="controls"
          radius={30}
          lean={false}
          padding={14}
          aria-label="Playground controls"
        >
          <div className="plate">
            <h3>Layout</h3>
            <div className="row wrap">
              <button className="btn" onClick={() => arrange()}>
                Arrange
              </button>
              <button className="btn" onClick={scatter}>
                Scatter
              </button>
              <button
                className="btn"
                disabled={count >= PANEL_SEED.length}
                onClick={() => setCount((c) => c + 1)}
              >
                Add panel
              </button>
              <button
                className="btn"
                disabled={count <= 1}
                onClick={() => setCount((c) => c - 1)}
              >
                Remove panel
              </button>
            </div>

            <h3>Motion</h3>
            <Slider
              label="Viscosity"
              min={0}
              max={1}
              step={0.05}
              value={s.viscosity}
              onChange={(v) => set("viscosity", v)}
            />
            <Slider
              label="Stretch"
              min={0}
              max={2.5}
              step={0.1}
              value={s.stretch}
              onChange={(v) => set("stretch", v)}
            />
            <Slider
              label="Flow"
              min={0}
              max={2}
              step={0.1}
              value={s.flow}
              onChange={(v) => set("flow", v)}
            />
            <div
              className="row wrap presets"
              role="group"
              aria-label="Motion presets"
            >
              {MOTION_PRESETS.map((p) => (
                <button
                  key={p.name}
                  className="btn"
                  aria-pressed={
                    s.viscosity === p.viscosity &&
                    s.stretch === p.stretch &&
                    s.flow === p.flow
                  }
                  onClick={() => {
                    set("viscosity", p.viscosity);
                    set("stretch", p.stretch);
                    set("flow", p.flow);
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <h3>Material</h3>
            <Select
              label="Mood"
              value={s.mood}
              options={Object.keys(moods)}
              onChange={(v) => set("mood", v as MoodName)}
            />
            <div className="field inline">
              <label className="flabel" htmlFor="tint">
                Tint
              </label>
              <span className="color">
                <input
                  id="tint"
                  type="color"
                  value={s.tint}
                  onChange={(e) => set("tint", e.target.value)}
                />
                <code>{s.tint}</code>
              </span>
            </div>
            <Slider
              label="Opacity"
              min={0}
              max={1}
              step={0.05}
              value={s.opacity}
              onChange={(v) => set("opacity", v)}
            />
            <Slider
              label="Frost"
              min={0}
              max={1}
              step={0.05}
              value={s.frost}
              onChange={(v) => set("frost", v)}
            />
            <Slider
              label="Radius"
              unit="px"
              min={0}
              max={48}
              step={2}
              value={s.radius}
              onChange={(v) => set("radius", v)}
            />
            <Slider
              label="Elevation"
              min={0}
              max={1}
              step={0.05}
              value={s.elevation}
              onChange={(v) => set("elevation", v)}
            />
            <Toggle
              label="Color each panel"
              value={s.panelColors}
              onChange={(v) => set("panelColors", v)}
            />
            <Slider
              label="Blend distance"
              unit="px"
              min={0}
              max={90}
              step={2}
              value={s.blend}
              onChange={(v) => set("blend", v)}
            />
            <Slider
              label="Smoothness"
              min={0.4}
              max={2}
              step={0.1}
              value={s.smoothness}
              onChange={(v) => set("smoothness", v)}
            />
            <Slider
              label="Refraction"
              min={0}
              max={2.5}
              step={0.1}
              value={s.refraction}
              onChange={(v) => set("refraction", v)}
            />
            <Slider
              label="Dispersion"
              min={0}
              max={3}
              step={0.1}
              value={s.dispersion}
              onChange={(v) => set("dispersion", v)}
            />

            <h3>Rim</h3>
            <Select
              label="Style"
              value={s.rimStyle}
              options={["iridescent", "color", "tint"]}
              onChange={(v) => set("rimStyle", v as Settings["rimStyle"])}
            />
            {s.rimStyle === "color" && (
              <div className="field inline">
                <label className="flabel" htmlFor="rimhex">
                  Rim color
                </label>
                <span className="color">
                  <input
                    id="rimhex"
                    type="color"
                    value={s.rimHex}
                    onChange={(e) => set("rimHex", e.target.value)}
                  />
                  <code>{s.rimHex}</code>
                </span>
              </div>
            )}
            <Slider
              label="Strength"
              min={0}
              max={2.5}
              step={0.1}
              value={s.rim}
              onChange={(v) => set("rim", v)}
            />
            <Slider
              label="Width"
              min={0.3}
              max={3}
              step={0.1}
              value={s.rimWidth}
              onChange={(v) => set("rimWidth", v)}
            />
            <Slider
              label="Highlight"
              min={0}
              max={2}
              step={0.1}
              value={s.highlight}
              onChange={(v) => set("highlight", v)}
            />
            <Slider
              label="Highlight sharpness"
              min={0}
              max={1}
              step={0.05}
              value={s.highlightSharpness}
              onChange={(v) => set("highlightSharpness", v)}
            />
            <Slider
              label="Edge line"
              min={0}
              max={2}
              step={0.1}
              value={s.edgeLine}
              onChange={(v) => set("edgeLine", v)}
            />

            <h3>Clarity</h3>
            <p className="control-note">
              Four separate looks the material adds on its own. Turn all four
              off, with Rim and Highlight, and the plasma is a plain lens - the
              Aqua tab above.
            </p>
            <Slider
              label="Shimmer"
              min={0}
              max={2}
              step={0.1}
              value={s.shimmer}
              onChange={(v) => set("shimmer", v)}
            />
            <Slider
              label="Glow"
              min={0}
              max={2}
              step={0.1}
              value={s.glow}
              onChange={(v) => set("glow", v)}
            />
            <Slider
              label="Wash"
              min={0}
              max={1}
              step={0.05}
              value={s.wash}
              onChange={(v) => set("wash", v)}
            />
            <Slider
              label="Grain"
              min={0}
              max={2}
              step={0.1}
              value={s.grain}
              onChange={(v) => set("grain", v)}
            />
            <Slider
              label="Background blur"
              unit="px"
              min={0}
              max={40}
              step={2}
              value={s.backgroundBlur}
              onChange={(v) => set("backgroundBlur", v)}
            />

            <h3>Snapping</h3>
            <Slider
              label="Grid"
              unit="px"
              min={8}
              max={48}
              step={4}
              value={s.grid}
              onChange={(v) => set("grid", v)}
            />
            <Slider
              label="Magnet"
              unit="px"
              min={0}
              max={80}
              step={4}
              value={s.magnet}
              onChange={(v) => set("magnet", v)}
            />

            <h3>Extras</h3>
            <Toggle
              label="Pointer drop"
              value={s.pointerDrop}
              onChange={(v) => set("pointerDrop", v)}
            />
            <Toggle
              label="Ambient drops"
              value={s.ambientDrops}
              onChange={(v) => set("ambientDrops", v)}
            />
            <button className="btn subtle" onClick={reset}>
              Reset controls
            </button>
          </div>
        </Plasma>
      </div>

      <Plasma className="code" radius={26} lean={false} padding={14}>
        <div className="plate">
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      </Plasma>
    </section>
  );
}

function Api() {
  return (
    <section id="api">
      <h2>API</h2>
      <Plasma className="api" radius={30} lean={false} padding={16}>
        <div className="plate">
          <h3>
            <code>&lt;PlasmaProvider&gt;</code>
          </h3>
          <p>Wrap the app once; it owns the canvas and the material.</p>
          <PropTable
            rows={[
              [
                "mood",
                `"tidal" | "aurora" | "ember" | Mood`,
                `"tidal"`,
                "Colors, blend distance, spring feel.",
              ],
              [
                "theme",
                `"auto" | "light" | "dark"`,
                `"auto"`,
                "Auto follows the OS and <html data-theme>.",
              ],
              [
                "radius",
                "number",
                "26",
                "Default corner radius (px) for every surface.",
              ],
              [
                "background",
                "string | element",
                "",
                "Any CSS color, image URL, or img/canvas/video element (canvas and video are live). Omit for the mood field.",
              ],
              [
                "blend",
                "number",
                "mood",
                "Distance (px) at which surfaces fuse.",
              ],
              ["smoothness", "number", "1", "Outline smoothing."],
              [
                "viscosity",
                "number",
                "0.5",
                "0 watery and bouncy, 1 thick and slow. Also scales drag and snap springs.",
              ],
              [
                "stretch",
                "number",
                "1",
                "How far the plasma trails behind moving panels. 0 = off.",
              ],
              ["flow", "number", "0", "Slow ripple along the edges."],
              ["tint", "string", `"#ffffff"`, "Plasma color (hex)."],
              ["opacity", "number", "0", "Tint strength: 0 clear, 1 solid."],
              ["frost", "number", "0", "Translucency: 0 clear, 1 frosted."],
              [
                "elevation",
                "number",
                "0.35",
                "Shadow depth: 0 flat, 1 floating. Dragged surfaces raise automatically.",
              ],
              [
                "refraction · dispersion",
                "number",
                "1",
                "Lens strength; color splitting at edges.",
              ],
              ["rim", "number", "1", "Colored rim strength. 0 = off."],
              [
                "rimColor",
                `"iridescent" | "tint" | string`,
                `"iridescent"`,
                "Rainbow, each surface's tint, or a hex color.",
              ],
              ["rimWidth", "number", "1", "How far the rim reaches inward."],
              [
                "highlight",
                "number",
                "1",
                "Pointer-facing highlight. 0 = off.",
              ],
              [
                "highlightSharpness",
                "number",
                "0",
                "How tight that highlight is: 0 the broad matte glow, 1 a small hard glint as on water. Plasma only.",
              ],
              ["edgeLine", "number", "1", "Thin outline. 0 = off."],
              [
                "shimmer",
                "number",
                "1",
                "The slow iridescent sheen drifting across each surface. 0 = off.",
              ],
              [
                "glow",
                "number",
                "1",
                "The halo of color the plasma casts on the background around it - the soft light that remains at elevation 0. 0 = off.",
              ],
              [
                "wash",
                "number",
                "1",
                "How much of its own cast the material puts on what you see through it. 0 = clear as water.",
              ],
              [
                "grain",
                "number",
                "1",
                "Film grain on the background. 0 = off.",
              ],
              [
                "material",
                `"plasma" | "crystal" | "metal" | "wood" | "stone" | "cloud"`,
                `"plasma"`,
                "What the surfaces are made of. One engine; only the composite pass differs.",
              ],
              [
                "lightDir",
                "[x, y, z]",
                "up-left",
                "Where the one light comes from. Every opaque material reads it, so they agree.",
              ],
              [
                "roughness · anisotropy",
                "number",
                "0.28 · 0",
                "Metal's finish, and how far a highlight stretches along the grain.",
              ],
              [
                "thickness · tension",
                "number",
                "18 · 0",
                "A panel as a solid: how deep it is, and how hard the material pulls it toward a bead.",
              ],
              [
                "edge · edgeScale · edgeSharpness",
                "number",
                "0 · 0.01 · 0",
                "Displace the outline off its rounded box: stone chips, cloud billows, metal is cut.",
              ],
              [
                "backgroundBlur",
                "number",
                "0",
                "Blur the background itself, in px (0-40). Unlike frost, which blurs only what a frosted surface sees.",
              ],
              [
                "preserveDrawingBuffer",
                "boolean",
                "false",
                "Keep each frame after it is shown, so another provider can sample this canvas as its background. Fixed at creation.",
              ],
              [
                "ground",
                '"field" | "clear"',
                '"field"',
                "What shows where there is no surface. clear leaves the canvas transparent, so a second provider can sit above a scrim and draw only its surfaces, refracting the first provider's canvas passed as its background.",
              ],
              [
                "pointerDrop",
                "boolean",
                "true",
                "Liquid drop under the pointer.",
              ],
              [
                "ambientDrops",
                "boolean",
                "false",
                "Decorative orbiting drops.",
              ],
              [
                "grid · magnet",
                "number",
                "24 · 40",
                "Snap grid size; edge latch distance.",
              ],
              ["quality", "number", "1.25", "Max canvas pixel ratio."],
              [
                "freezeOnScroll",
                "boolean",
                "false",
                "Touch only: pin the last frame through a fling, resume when scrolling stops.",
              ],
              [
                "maxSurfaces",
                "number",
                "16",
                "Visible surface budget. Changing it rebuilds the shaders; higher costs GPU time.",
              ],
              [
                "canvas",
                "boolean",
                "true",
                "false: render <PlasmaCanvas /> yourself to place and style the element.",
              ],
              ["zIndex", "number", "-1", "z-index of the canvas."],
            ]}
          />
        </div>
      </Plasma>
      <Plasma className="api" radius={30} lean={false} padding={16}>
        <div className="plate">
          <h3>
            <code>&lt;Plasma&gt;</code>
          </h3>
          <p>Any element in the material. Accepts all HTML props.</p>
          <PropTable
            rows={[
              [
                "as",
                "ElementType",
                `"div"`,
                'Element or component to render. Its own props typecheck: as="a" takes href.',
              ],
              [
                "radius",
                "number",
                "provider",
                "Corner radius (px) for this surface.",
              ],
              [
                "lean",
                "number | false",
                "10",
                "Lean toward the pointer while standalone.",
              ],
              [
                "tint · opacity · frost · elevation",
                "string · number",
                "provider",
                "Per-surface color, translucency, and shadow depth; different values blend across joins.",
              ],
              [
                "padding",
                "number",
                "",
                "Inner padding (px). Halves on joined edges, so all gutters match.",
              ],
              [
                "fuse",
                "boolean",
                "true",
                "false: never blends, bridges, or joins - for bars and fixed chrome.",
              ],
              [
                "draggable",
                "boolean",
                "false",
                "Free drag, snap on release. Arrow keys move one grid step.",
              ],
              [
                "snap",
                "boolean",
                "true",
                "Latch to neighbor edges, else the grid.",
              ],
              [
                "bounds",
                "RefObject<HTMLElement>",
                "viewport",
                "Drag area and grid origin.",
              ],
              [
                "group",
                "string",
                "",
                "Snap only against surfaces in the same group. Ungrouped surfaces form one group.",
              ],
              [
                "offset · defaultOffset",
                "{ x, y }",
                "",
                "Controlled or initial offset; changes spring into place.",
              ],
              [
                "onDragStart · onDragEnd",
                "() => void · (offset) => void",
                "",
                "Drag lifecycle; onDragEnd gets the settled offset.",
              ],
              [
                "onJoinChange",
                "(joined) => void",
                "",
                "Fires on fuse or separation.",
              ],
              [
                "onForming · onFormed",
                "() => void",
                "",
                "The form-in starts; the form-in has settled (at once under reduced motion). Reveal contents in onFormed.",
              ],
            ]}
          />
        </div>
      </Plasma>
      <Plasma className="api" radius={30} lean={false} padding={16}>
        <div className="plate">
          <h3>Hooks</h3>
          <p>
            <code>usePlasmaRuntime()</code> gives{" "}
            <code>pulse(x, y, strength)</code>, which sends a wave from a
            viewport point, <code>bump(energy)</code>, which brightens the
            material briefly, and <code>supported</code>, false when the CSS
            fallback is active. Its value is stable, so reading it does not
            re-render your component on every styling change.
          </p>
          <p>
            <code>usePlasmaDefaults()</code> gives the provider-level{" "}
            <code>tint</code>, <code>opacity</code>, <code>frost</code>,{" "}
            <code>radius</code>, <code>grid</code>, <code>magnet</code> and{" "}
            <code>spring</code>. <code>usePlasma()</code> returns both together.
          </p>
        </div>
      </Plasma>
      <Plasma className="api" radius={30} lean={false} padding={16}>
        <div className="plate">
          <h3>
            <code>&lt;PlasmaCanvas&gt;</code>
          </h3>
          <p>
            The provider renders the canvas itself. Pass{" "}
            <code>canvas={"{false}"}</code> and place a{" "}
            <code>&lt;PlasmaCanvas /&gt;</code> anywhere inside it to choose
            where the element lives and how it is styled - it takes{" "}
            <code>className</code>, <code>style</code> and <code>zIndex</code>.
            The renderer still draws the whole viewport; this places the
            element, not the field.
          </p>
        </div>
      </Plasma>
    </section>
  );
}

function Usage() {
  return (
    <section id="usage">
      <h2>Usage</h2>
      <Plasma className="code" radius={26} lean={false} padding={14}>
        <div className="plate">
          <pre>
            <code>{`import { PlasmaProvider, Plasma, usePlasma } from "@cruxgarden/plasma-ui";

export function Workspace({ panels }) {
  return (
    <PlasmaProvider mood="tidal">
      <Plasma as="header" lean={false}>…</Plasma>
      {panels.map(p => (
        <Plasma key={p.id} draggable padding={20} offset={p.offset}
          onDragEnd={o => savePosition(p.id, o)}>
          <PanelContent panel={p} />
        </Plasma>
      ))}
    </PlasmaProvider>
  );
}`}</code>
          </pre>
        </div>
      </Plasma>
      <p className="note">
        Plasma is for containers: panels, docks, cards, dialogs. Place surfaces
        flush (one piece) or further apart than the blend distance; smaller gaps
        draw as liquid bridging. Up to maxSurfaces (default 16) render at once,
        offscreen ones skipped. Small controls read better as plain HTML on top.
        A dialog above a scrim gets its own provider with ground="clear" and the
        first canvas as its background; contents can wait for the form-in with
        onFormed or the data-plasma-forming attribute.
      </p>
    </section>
  );
}

const LIMITS = [
  {
    title: "No layers in one canvas",
    body: "Overlapping surfaces fuse. A dialog above a scrim is a second provider with ground=\"clear\" sampling the first one's canvas; fixed bars over scrolling plasma stay plain CSS - this page's nav is the pattern.",
  },
  {
    title: "No scroll clipping",
    body: "Plasma inside a scrollable container draws past its edges. Scrolling inside one panel is fine.",
  },
  {
    title: "No drag or resize handles",
    body: "draggable moves the whole surface; mark interactive children data-plasma-nodrag.",
  },
  {
    title: "Draws its own background",
    body: "The plasma refracts its background layer - the mood field, or any color, image, canvas, or video you pass - not your live DOM. Custom background shaders aren't supported yet.",
  },
  {
    title: "Rounded rectangles only",
    body: "No rotation or arbitrary shapes. Up to maxSurfaces (default 16) render at once.",
  },
];

function Limitations() {
  return (
    <section id="limits">
      <h2>Limitations</h2>
      <p className="section-lede">
        What 0.1 doesn't do. All five are the roadmap, in this order.
      </p>
      <div className="limits">
        {LIMITS.map((l) => (
          <Plasma
            key={l.title}
            className="limit"
            radius={26}
            lean={false}
            padding={16}
          >
            <div className="plate">
              <h3>{l.title}</h3>
              <p>{l.body}</p>
            </div>
          </Plasma>
        ))}
      </div>
    </section>
  );
}

function PropTable({ rows }: { rows: string[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Prop</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td key={i}>{i < 3 && c ? <code>{c}</code> : c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
}) {
  const id = "s-" + label.replace(/\W/g, "");
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        <span>
          {value}
          {unit}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="field inline">
      <span className="flabel">{label}</span>
      <div className="seg small" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            aria-pressed={value === o}
            onClick={() => onChange(o)}
          >
            {cap(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="field inline">
      <span className="flabel">{label}</span>
      <button
        className="switch"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
      >
        <span />
      </button>
    </div>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
// Content plate inside each card: lighter in light mode, darker in dark mode,
// and mixed with the surface's tint - the pattern a real app would use for readable content on plasma.
function plateStyle(tint: string, opacity: number): React.CSSProperties {
  const amt = Math.round(Math.min(Math.max(opacity, 0), 1) * 40);
  return { background: `color-mix(in srgb, ${tint} ${amt}%, var(--plate))` };
}
const rimColorOf = (s: Settings) =>
  s.rimStyle === "color" ? s.rimHex : s.rimStyle;
