import React, { useState } from "react";
import {
  Plasma,
  PlasmaProvider,
  MATERIALS,
  usePlasmaRuntime,
  type MaterialName,
} from "../../src";

/*
 * Materials - a proof of concept.
 *
 * Every material here shares one engine. The SDF scene, the springs, the
 * fusing, the joins and the height field are the same code the plasma theme
 * has always run; only the composite pass differs. That is the whole claim
 * this page exists to test: that the library is a field renderer which happens
 * to ship glass, rather than a glass renderer.
 *
 * One material is shown at a time, because they are a uniform branch rather
 * than separate passes - two at once would mean two composites.
 */

const NOTES: Record<MaterialName, { blurb: string; technique: string }> = {
  plasma: {
    blurb: "The original. A lens with a coloured rim.",
    technique:
      "Refraction from the height-field slope with chromatic dispersion, a frosted backdrop, an iridescent fresnel rim.",
  },
  crystal: {
    blurb: "Glass with its bevel cut into facets.",
    technique:
      "The normal is snapped to seven directions, so the lens jumps between flats. Refracted twice — in the front face and out the back — and dispersed on both legs. The bright edge is total internal reflection, not a drawn outline.",
  },
  metal: {
    blurb: "A conductor: no diffuse, all reflection.",
    technique:
      "GGX specular with a Smith geometry term and Schlick fresnel. The environment is sampled along the reflected vector and blurred by roughness — the frost chain doubles as a prefiltered environment mip, which is why this costs almost nothing.",
  },
  wood: {
    blurb: "Rings, pores and a streaked highlight.",
    technique:
      "Domain-warped fbm for the rings, differenced into a normal so the grain catches light rather than being painted on. The highlight is anisotropic along the grain, which is the tell that separates a board from brown plastic. Grain sits in page coordinates, so resizing a panel does not stretch it.",
  },
  stone: {
    blurb: "Rough, matte, flecked, veined.",
    technique:
      "Three octaves of warped noise plus per-pixel flecks, differenced into a detail normal. Roughness 0.72, so the specular is a broad sheen rather than a point. A dusty fresnel at the edge.",
  },
  mercury: {
    blurb: "The same conductor, with the surface tension left in.",
    technique:
      "Metal's BRDF at a mirror finish, but the bevel rolls all the way across the face instead of stopping at the edge, and the micro-relief is gone. Fusing does the rest: two panels meeting run together into one bead. Metal is milled; mercury is poured.",
  },
  cloud: {
    blurb: "The one volume rather than a surface.",
    technique:
      "The silhouette is a boundary, not a shape: density is noise inside it. Light is marched five steps with Beer-Lambert transmittance and a Henyey-Greenstein phase, so it reads as lit from a direction instead of painted. Soft edges are free here, which is why cloud is easier than sand.",
  },
};

const OPAQUE: MaterialName[] = ["wood", "stone", "metal"];

/**
 * Plain grounds, because the mood field is a moving, coloured thing and every
 * material picks it up — the refractive ones bend it, the reflective ones show
 * it back, and it becomes impossible to say whether what you are looking at is
 * the material or the wallpaper. Judge against a flat colour first; the field
 * is still here to check they survive it.
 */
/**
 * A material is not a skin, so it brings its own physics as well as its own
 * shading: how thick it is as a solid, how hard it pulls its shape toward a
 * bead, how eagerly two of them merge, and how it moves when dragged.
 */
const PHYSICS: Record<
  MaterialName,
  {
    thickness: number;
    tension: number;
    blend: number;
    viscosity: number;
    stretch: number;
  }
> = {
  plasma: { thickness: 18, tension: 0, blend: 24, viscosity: 0.5, stretch: 1 },
  crystal: {
    thickness: 26,
    tension: 0,
    blend: 14,
    viscosity: 0.9,
    stretch: 0.15,
  },
  metal: { thickness: 10, tension: 0, blend: 8, viscosity: 0.85, stretch: 0.2 },
  // Mercury's surface tension is seven times water's: it wants to be a
  // sphere, and two beads within reach pull into one body.
  mercury: {
    thickness: 30,
    tension: 0.9,
    blend: 54,
    viscosity: 0.2,
    stretch: 1.6,
  },
  wood: { thickness: 16, tension: 0, blend: 6, viscosity: 1, stretch: 0 },
  stone: { thickness: 22, tension: 0, blend: 4, viscosity: 1, stretch: 0 },
  cloud: {
    thickness: 40,
    tension: 0.35,
    blend: 60,
    viscosity: 0.15,
    stretch: 2.2,
  },
};

const GROUNDS: { name: string; value: string | undefined }[] = [
  { name: "Slate", value: "#16191d" },
  { name: "Paper", value: "#d9d4cb" },
  { name: "Mid", value: "#6c6f74" },
  { name: "Ink", value: "#08090b" },
  { name: "Field", value: undefined },
];

/**
 * How each material wants its outline. A rounded rectangle is right for a
 * liquid and wrong for most of the rest: metal is cut, stone chips, cloud
 * billows. `radius` is the corner, `edge` how far the outline wanders from it,
 * `edgeScale` how big those wanders are, `sharp` whether they roll or break.
 */
const SHAPE: Record<
  MaterialName,
  { radius: number; edge: number; edgeScale: number; sharp: number }
> = {
  plasma: { radius: 26, edge: 0, edgeScale: 0.01, sharp: 0 },
  crystal: { radius: 10, edge: 3, edgeScale: 0.05, sharp: 1 },
  metal: { radius: 3, edge: 0, edgeScale: 0.01, sharp: 0 },
  mercury: { radius: 44, edge: 2, edgeScale: 0.004, sharp: 0 },
  wood: { radius: 5, edge: 1.5, edgeScale: 0.02, sharp: 0.3 },
  stone: { radius: 8, edge: 7, edgeScale: 0.03, sharp: 0.85 },
  cloud: { radius: 40, edge: 26, edgeScale: 0.005, sharp: 0 },
};

function Pulse() {
  const { pulse } = usePlasmaRuntime();
  return (
    <button className="ghost" onClick={(e) => pulse(e.clientX, e.clientY, 1)}>
      Send a pulse
    </button>
  );
}

export function App() {
  const [material, setMaterial] = useState<MaterialName>("plasma");
  const [roughness, setRoughness] = useState(0.28);
  const [anisotropy, setAnisotropy] = useState(0);
  const [angle, setAngle] = useState(235);
  const [frost, setFrost] = useState(0.3);
  const [shape, setShape] = useState(SHAPE.plasma);
  const [ground, setGround] = useState(GROUNDS[0]);
  const phys = PHYSICS[material];

  const pick = (m: MaterialName) => {
    setMaterial(m);
    setShape(SHAPE[m]);
  };

  const rad = (angle * Math.PI) / 180;
  const lightDir: [number, number, number] = [
    Math.cos(rad),
    Math.sin(rad),
    0.66,
  ];
  const note = NOTES[material];
  const opaque = OPAQUE.includes(material);

  return (
    <PlasmaProvider
      mood="tidal"
      theme="dark"
      background={ground.value}
      material={material}
      lightDir={lightDir}
      roughness={roughness}
      anisotropy={anisotropy}
      thickness={phys.thickness}
      tension={phys.tension}
      viscosity={phys.viscosity}
      stretch={phys.stretch}
      edge={shape.edge}
      edgeScale={shape.edgeScale}
      edgeSharpness={shape.sharp}
      radius={shape.radius}
      frost={material === "plasma" || material === "crystal" ? frost : 0}
      blend={phys.blend}
      elevation={material === "cloud" ? 0 : 0.4}
      grain={0}
      maxSurfaces={12}
    >
      <div className="page">
        <Plasma
          className="bar"
          radius={shape.radius}
          padding={14}
          fuse={false}
          lean={false}
        >
          <span className="wordmark">Materials</span>
          <div className="seg">
            {MATERIALS.map((m) => (
              <button
                key={m}
                aria-pressed={m === material}
                onClick={() => pick(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="seg grounds">
            {GROUNDS.map((g) => (
              <button
                key={g.name}
                aria-pressed={g.name === ground.name}
                onClick={() => setGround(g)}
              >
                {g.name}
              </button>
            ))}
          </div>
          <Pulse />
        </Plasma>

        <div className="body">
          <Plasma
            className="card lead"
            radius={shape.radius}
            padding={22}
            lean={false}
          >
            <div className="plate">
              <h2>{material}</h2>
              <p className="blurb">{note.blurb}</p>
              <p className="technique">{note.technique}</p>
            </div>
          </Plasma>

          <div className="col">
            <Plasma
              className="card"
              radius={shape.radius}
              padding={18}
              lean={false}
            >
              <div className="plate">
                <h3>Legibility</h3>
                <p>
                  A plate inside the panel, which is how a busy material stays
                  usable. The material is the frame; the content sits on it.
                </p>
              </div>
            </Plasma>
            <Plasma
              className="card"
              radius={shape.radius}
              padding={18}
              lean={false}
            >
              <div className="plate thin">
                <h3>Bare</h3>
                <p>
                  The same text with no plate, so you can judge for yourself
                  where each material stops being readable.
                </p>
              </div>
            </Plasma>
          </div>

          <div className="col">
            <Plasma
              className="card tall"
              radius={shape.radius}
              padding={18}
              draggable
              lean={false}
            >
              <div className="plate">
                <h3>Drag me</h3>
                <p>
                  Springs, snapping and joins are the same code for every
                  material — only the shading changed.
                </p>
              </div>
            </Plasma>
          </div>
        </div>

        <Plasma
          className="bar controls"
          radius={shape.radius}
          padding={14}
          fuse={false}
          lean={false}
        >
          <label>
            Light <span>{angle}°</span>
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={angle}
              onChange={(e) => setAngle(+e.target.value)}
            />
          </label>
          <label className={opaque ? "" : "off"}>
            Roughness <span>{roughness.toFixed(2)}</span>
            <input
              type="range"
              min={0.04}
              max={0.95}
              step={0.01}
              value={roughness}
              onChange={(e) => setRoughness(+e.target.value)}
            />
          </label>
          <label
            className={material === "metal" || material === "wood" ? "" : "off"}
          >
            Anisotropy <span>{anisotropy.toFixed(2)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={anisotropy}
              onChange={(e) => setAnisotropy(+e.target.value)}
            />
          </label>
          <label
            className={
              material === "plasma" || material === "crystal" ? "" : "off"
            }
          >
            Frost <span>{frost.toFixed(2)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={frost}
              onChange={(e) => setFrost(+e.target.value)}
            />
          </label>
          <label>
            Corner <span>{shape.radius}</span>
            <input
              type="range"
              min={0}
              max={52}
              step={1}
              value={shape.radius}
              onChange={(e) => setShape({ ...shape, radius: +e.target.value })}
            />
          </label>
          <label>
            Edge <span>{shape.edge}</span>
            <input
              type="range"
              min={0}
              max={36}
              step={1}
              value={shape.edge}
              onChange={(e) => setShape({ ...shape, edge: +e.target.value })}
            />
          </label>
          <label className={shape.edge > 0 ? "" : "off"}>
            Ragged <span>{shape.sharp.toFixed(2)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={shape.sharp}
              onChange={(e) => setShape({ ...shape, sharp: +e.target.value })}
            />
          </label>
        </Plasma>
      </div>
    </PlasmaProvider>
  );
}
