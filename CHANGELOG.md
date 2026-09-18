# Changelog

## 0.2.4

- **Fixed:** the field stopped rendering after a window resize and never came
  back. Two causes, both now addressed. A drag-resize reallocated the eight
  render targets once per distinct size — 88 allocations across a 60-step drag
  in the repro — and the driver dropped the WebGL context under it. And there
  was no `webglcontextlost` / `webglcontextrestored` handling at all, so once
  the context went, the frame loop kept running against a dead context
  forever. The resize now settles before reallocating (88 allocations became
  8, and the context survives), and a lost context is caught, restored and
  fully rebuilt. `preventDefault` on the loss event is what asks the browser
  to attempt the restore in the first place.

## 0.2.1

Fixes for the reports that came in after 0.2.0, and one new option.

- **Fixed:** the spring integrator diverged at small `stretch` with low
  `viscosity` - stiffness grows as 1/stretch², and at the fixed substep
  explicit Euler blew up, so the surface oscillated instead of settling. The
  substep now follows the spring. Reachable from the playground: `stretch`
  0.1 or 0.2 hit it.
- **Fixed:** lean rewrote `translate` on every panel every frame, forcing a
  layout each frame. It now settles and writes only on change.
- **Fixed:** every `resize` event reallocated all render targets; a mobile
  URL bar collapsing fired dozens per second. Coalesced to one per frame and
  skipped when the pixel size is unchanged.
- **New:** `freezeOnScroll` on `PlasmaProvider` (off by default). On touch
  devices, a fling pins a three-viewport frame to the page and pauses, so the
  compositor scrolls it with the content; rendering resumes when the scroll
  stops. Pinned frames match live ones to within one level.
- Passes that have nothing to do are skipped: the tint blur when no surface
  has opacity, the frost blur when nothing is frosted or elevated, a copy
  pass in the background chain. The loop pauses in a hidden tab. The
  background target is 8-bit. Together, 20-40% fewer passes on clear looks;
  pixel-identical output.
- The canvas is capped at 2.6M pixels, trading resolution rather than frame
  rate on 4K displays and dense phones.

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
