import React, { useEffect, useMemo, useRef, useState } from "react";
import { PlasmaProvider, Plasma, usePlasma, MoodName, Offset } from "../../src";

/*
 * Workspace - a real-world example app built on Plasma UI.
 * Everything on screen is a <Plasma> surface: the top bar, the dock, and four
 * working panels. The app fills the viewport (no page scroll), which is the
 * layout where an all-panel shell works today.
 *
 * Shown here:
 *  - draggable panels with edge/grid snapping and join-aware padding
 *  - a focused panel raised via per-surface elevation
 *  - layout persisted to localStorage
 *  - interactive content (list selection, checkboxes) with data-plasma-nodrag
 *  - mood / frost switching at runtime
 */

interface Mail {
  id: number;
  from: string;
  subject: string;
  body: string;
}
const MAIL: Mail[] = [
  {
    id: 1,
    from: "Ana",
    subject: "Launch checklist",
    body: "Docs page is live. npm publish is the last step - want to pair at 4?",
  },
  {
    id: 2,
    from: "Sam",
    subject: "Panel resize",
    body: "Filed the resize-handle issue with a sketch of the edge hit areas.",
  },
  {
    id: 3,
    from: "Priya",
    subject: "Demo feedback",
    body: "The drag-and-fuse moment lands. Lead with it in the video.",
  },
  {
    id: 4,
    from: "Theo",
    subject: "Perf numbers",
    body: "Sixteen panels holds 60fps on the M1 Air. Notes attached.",
  },
];
const TASKS = [
  "Tag v0.1.0",
  "Write announcement",
  "Record demo clip",
  "Publish to npm",
];

interface Layout {
  [id: string]: Offset;
}
const KEY = "plasma-workspace-layout";
// Everything sits flush - the bar, dock, and panels fuse into one container
// that fills the viewport. Panel sizes are derived from the stage so the grid
// fills it exactly. Drag a panel to tear it out; it fuses back where you drop it.
const snap24 = (v: number) => Math.max(24, Math.round(v / 24) * 24);
const load = (): Layout | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export function App() {
  const [mood, setMood] = useState<MoodName>("tidal");
  const [frost, setFrost] = useState(0.35);
  const [layout, setLayout] = useState<Layout>(() => load() ?? {});
  const [focused, setFocused] = useState("inbox");
  const [mailId, setMailId] = useState(1);
  const [done, setDone] = useState<boolean[]>(() =>
    TASKS.map((_, i) => i === 0),
  );
  const stage = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 984, h: 552 });
  useEffect(() => {
    const measure = () => {
      const r = stage.current?.getBoundingClientRect();
      if (r) setDims({ w: Math.floor(r.width), h: Math.floor(r.height) });
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, []);
  // 2x2 grid that fills the stage: fixed-ish left column, the rest flexes
  const col = snap24(Math.min(336, dims.w * 0.38));
  const row = snap24(dims.h * 0.52);
  const home: Layout = {
    inbox: { x: 0, y: 0 },
    reader: { x: col, y: 0 },
    tasks: { x: 0, y: row },
    player: { x: col, y: row },
  };
  const size = {
    inbox: { width: col, height: row },
    reader: { width: dims.w - col, height: row },
    tasks: { width: col, height: dims.h - row },
    player: { width: dims.w - col, height: dims.h - row },
  } as const;

  useEffect(() => {
    if (Object.keys(layout).length)
      try {
        localStorage.setItem(KEY, JSON.stringify(layout));
      } catch {}
  }, [layout]);
  const place = (id: string) => ({
    offset: layout[id] ?? home[id],
    onDragEnd: (o: Offset) => setLayout((l) => ({ ...l, [id]: o })),
    onDragStart: () => setFocused(id),
    elevation: focused === id ? 0.75 : 0.3,
    onPointerDownCapture: () => setFocused(id),
    bounds: stage,
    draggable: true,
    padding: 18,
    style: size[id as keyof typeof size],
  });
  const mail = MAIL.find((m) => m.id === mailId)!;

  return (
    <PlasmaProvider mood={mood} theme="dark" frost={frost} blend={20} grid={24}>
      <div className="app">
        <Plasma
          as="header"
          className="bar"
          radius={22}
          lean={false}
          padding={18}
          elevation={0.5}
          fuse={false}
        >
          <div className="plate row">
            <strong className="wordmark">Workspace</strong>
            <span className="hint">
              an example app built with Plasma UI - drag any panel
            </span>
            <div className="seg" role="group" aria-label="Mood">
              {(["tidal", "aurora", "ember"] as MoodName[]).map((m) => (
                <button
                  key={m}
                  aria-pressed={mood === m}
                  onClick={() => setMood(m)}
                >
                  {m[0].toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            <label className="frost">
              Frost
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={frost}
                onChange={(e) => setFrost(+e.target.value)}
                data-plasma-nodrag
              />
            </label>
            <button
              className="ghost"
              data-plasma-nodrag
              onClick={() => setLayout({ ...home })}
            >
              Reset layout
            </button>
          </div>
        </Plasma>

        <div className="body">
          <Plasma
            as="nav"
            className="dock"
            radius={22}
            lean={false}
            padding={18}
            fuse={false}
            aria-label="Dock"
          >
            <div className="plate col">
              {["📥", "✓", "▶", "⚙"].map((g) => (
                <button key={g} className="dockbtn" aria-label="Dock item">
                  {g}
                </button>
              ))}
            </div>
          </Plasma>

          <div ref={stage} className="stage">
            <Plasma
              className="panel inbox"
              {...place("inbox")}
              aria-label="Inbox panel"
            >
              <div className="plate col">
                <h2>Inbox</h2>
                <ul data-plasma-nodrag>
                  {MAIL.map((m) => (
                    <li key={m.id}>
                      <button
                        aria-pressed={m.id === mailId}
                        onClick={() => {
                          setMailId(m.id);
                          setFocused("reader");
                        }}
                      >
                        <strong>{m.from}</strong> {m.subject}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </Plasma>

            <Plasma
              className="panel reader"
              {...place("reader")}
              aria-label="Reader panel"
            >
              <div className="plate col">
                <h2>{mail.subject}</h2>
                <span className="from">{mail.from}</span>
                <p>{mail.body}</p>
              </div>
            </Plasma>

            <Plasma
              className="panel tasks"
              {...place("tasks")}
              aria-label="Tasks panel"
            >
              <div className="plate col">
                <h2>Tasks</h2>
                <ul data-plasma-nodrag>
                  {TASKS.map((t, i) => (
                    <li key={t}>
                      <label className={done[i] ? "done" : ""}>
                        <input
                          type="checkbox"
                          checked={done[i]}
                          onChange={() =>
                            setDone((d) => d.map((v, j) => (j === i ? !v : v)))
                          }
                        />
                        {t}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </Plasma>

            <Plasma
              className="panel player"
              {...place("player")}
              aria-label="Player panel"
            >
              <PlayerContent />
            </Plasma>
          </div>
        </div>
      </div>
    </PlasmaProvider>
  );
}

function PlayerContent() {
  const { bump } = usePlasma();
  const [on, setOn] = useState(false);
  const [t, setT] = useState(41);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setT((v) => (v + 1) % 224), 1000);
    return () => clearInterval(id);
  }, [on]);
  const mmss = (v: number) =>
    `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
  return (
    <div className="plate col">
      <h2>Now playing</h2>
      <span className="from">Sea of Tranquility - Side B</span>
      <div className="progress">
        <span style={{ width: `${(t / 224) * 100}%` }} />
      </div>
      <div className="row">
        <span className="time">{mmss(t)} / 3:44</span>
        <button
          className="ghost"
          data-plasma-nodrag
          onClick={() => {
            setOn((o) => !o);
            bump(0.6);
          }}
        >
          {on ? "Pause" : "Play"}
        </button>
      </div>
    </div>
  );
}
