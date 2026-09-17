# Changelog

## 0.1.0

Initial release.

- `PlasmaProvider`: shared WebGL material with moods, theme, tint/opacity/frost, rim (color, width, highlight, edge line), viscosity/stretch/flow, blend, smoothness, refraction, dispersion, grid/magnet, quality.
- `Plasma`: any element as a glass surface, with per-surface radius, lean, tint/opacity/frost/elevation, join-aware `padding`, drag with edge/grid snapping, controlled offsets, join events.
- `usePlasma`: pulse, bump, capability and spring info.
- CSS frosted fallback when WebGL2 is unavailable; `prefers-reduced-motion` support.
- `fuse={false}`: surfaces that never blend, bridge, or join - for bars, docks, and fixed chrome.
- `background`: any CSS color, image URL, or live img/canvas/video source; images refract with a slow swirl, colors get subtle luminance drift, canvas and video re-upload per frame. Dynamic.
- No runtime dependencies beyond React.
