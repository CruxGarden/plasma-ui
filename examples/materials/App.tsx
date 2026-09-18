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
  cloud: {
    blurb: "The one volume rather than a surface.",
    technique:
      "The silhouette is a boundary, not a shape: density is noise inside it. Light is marched five steps with Beer-Lambert transmittance and a Henyey-Greenstein phase, so it reads as lit from a direction instead of painted. Soft edges are free here, which is why cloud is easier than sand.",
  },
};

const OPAQUE: MaterialName[] = ["wood", "stone", "metal"];

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
      material={material}
      lightDir={lightDir}
      roughness={roughness}
      anisotropy={anisotropy}
      frost={material === "plasma" || material === "crystal" ? frost : 0}
      blend={24}
      elevation={material === "cloud" ? 0 : 0.4}
      grain={0}
      maxSurfaces={12}
    >
      <div className="page">
        <Plasma
          className="bar"
          radius={20}
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
                onClick={() => setMaterial(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <Pulse />
        </Plasma>

        <div className="body">
          <Plasma className="card lead" radius={26} padding={22} lean={false}>
            <div className="plate">
              <h2>{material}</h2>
              <p className="blurb">{note.blurb}</p>
              <p className="technique">{note.technique}</p>
            </div>
          </Plasma>

          <div className="col">
            <Plasma className="card" radius={26} padding={18} lean={false}>
              <div className="plate">
                <h3>Legibility</h3>
                <p>
                  A plate inside the panel, which is how a busy material stays
                  usable. The material is the frame; the content sits on it.
                </p>
              </div>
            </Plasma>
            <Plasma className="card" radius={26} padding={18} lean={false}>
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
              radius={26}
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
          radius={20}
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
        </Plasma>
      </div>
    </PlasmaProvider>
  );
}
