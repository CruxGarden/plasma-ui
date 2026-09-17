# Changelog

## 0.2.0

**Breaking:** the CSS class on every surface is `.plasma-panel`, was `.plasma-glass`.
Only matters if you targeted it in your own stylesheet.

- The material is called plasma throughout: prop descriptions, docs, and the
  shader's own names. "Glass" is gone except where the readme credits Apple's
  Liquid Glass as prior art.
- `homepage` points at the site rather than the readme.

## 0.1.2

- Packaging and metadata only; no runtime change.

## 0.1.0

Initial release.

- `PlasmaProvider`: shared WebGL material with moods, theme, tint/opacity/frost, rim (color, width, highlight, edge line), viscosity/stretch/flow, blend, smoothness, refraction, dispersion, grid/magnet, quality.
- `Plasma`: any element as a plasma surface, with per-surface radius, lean, tint/opacity/frost/elevation, join-aware `padding`, drag with edge/grid snapping, controlled offsets, join events.
- `usePlasma`: pulse, bump, capability and spring info.
- CSS frosted fallback when WebGL2 is unavailable; `prefers-reduced-motion` support.
- `fuse={false}`: surfaces that never blend, bridge, or join - for bars, docks, and fixed chrome.
- `background`: any CSS color, image URL, or live img/canvas/video source; images refract with a slow swirl, colors get subtle luminance drift, canvas and video re-upload per frame. Dynamic.
- No runtime dependencies beyond React.
