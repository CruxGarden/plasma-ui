# Changelog

## Unreleased

### The highlight has a sharpness

- **Added:** `highlightSharpness` (0-1, default 0). The pointer highlight on
  the plasma material was one broad, matte glow; at 1 it is a small, hard
  glint as on water, with the gain raised so a tight lobe stays visible. The
  other materials light themselves from `roughness` and ignore it.

### A clear ground, so a second provider can sit above a scrim

The material was one canvas behind everything, so anything drawn above a
scrim - a dialog, a menu - could never be plasma. Two props make a second
provider possible on top of the first.

- **Added:** `ground` - `"field"` (the default, the old behaviour) paints the
  background everywhere; `"clear"` leaves the canvas transparent outside the
  surfaces, draws only the surfaces, their shadows and rims, and refracts the
  `background` source sampled exactly (no swirl), so it lines up with what is
  beneath. Alpha is the surface's coverage, the shadow's darkness outside it.
- **Added:** `preserveDrawingBuffer` - keep each frame after it is shown so
  another provider can pass this canvas as its `background`. Fixed at
  creation; off by default.
- **Added:** the form-in is observable. A surface's element carries
  `data-plasma-forming` (`FORMING_ATTR`) from `register` until its form-in
  has settled, and dispatches `plasmaforming` / `plasmaformed`
  (`FORMING_EVENT` / `FORMED_EVENT`, bubbling); `<Plasma>` exposes them as
  `onForming` / `onFormed`. Hold the contents back and reveal them in
  `onFormed`, or style them off the attribute.
- The pair: the first provider with `preserveDrawingBuffer` and a
  `<PlasmaCanvas className="ground" />`; the second, inside the dialog's own
  stacking context, with `ground="clear"` and `background={groundCanvas}`,
  its `<PlasmaCanvas>` between the scrim and the panel, and the panel
  registered on it.

### Every look the material adds is now a control

Six things gave the plasma a look of its own and only two could be turned off,
so "plain glass, nothing but the lens" was not reachable. Each is a prop now,
every one defaulting to exactly the old behaviour.

- **Added:** `shimmer` - the slow iridescent sheen drifting across the body of
  each surface. This is the rainbow that stayed no matter how far `rim` came
  down; it had no uniform at all.
- **Added:** `glow` - the halo of color the plasma casts on the background
  around it. Keyed to the height field, not to elevation, which is why it was
  still there at `elevation={0}` where the drop shadow genuinely is off.
- **Added:** `wash` - how much of its own cast the material puts on what you
  see through it. `0` passes the background straight through.
- **Added:** `grain` - the film grain over the background.
- **Added:** `backgroundBlur` (0-40 px) - blurs the background itself, where
  `frost` blurs only what a frosted surface sees. Eight extra passes above 0,
  and none at 0. Contributed as a patch by Tigrana.
- **Added:** an **Aqua** tab in the playground: all six off, refraction up. The
  README carries the same recipe under "Clear as water".

### Composability

- **Added:** `<PlasmaCanvas>` and `canvas={false}` on the provider, so the
  canvas element can be placed and styled by the consumer. The renderer still
  draws the whole viewport - this moves the element, not the field.
- **Added:** `group` on `<Plasma>`. Two independent sets of panels on one page
  no longer snap onto each other. Snapping only; surfaces still fuse wherever
  they overlap.
- **Added:** `usePlasmaRuntime()` and `usePlasmaDefaults()`. The context is two
  contexts now, and the runtime half is stable, so a component that only wants
  `pulse` is no longer re-rendered by every styling change. `usePlasma()`
  returns both together and is unchanged.
- **Changed:** `as` is properly polymorphic. `<Plasma as="a" href>` and
  `<Plasma as={Link} to>` typecheck; `PlasmaProps` on its own still means the
  div form.
- **Changed:** `maxSurfaces` is live. It recompiles the shaders rather than
  being fixed at mount, and the renderer warns once when it has to drop
  surfaces instead of silently not drawing them.
- **Changed:** `bounds` takes `RefObject<HTMLElement | null>`, which is what
  `useRef<T>(null)` produces under @types/react 19, where it did not compile.
- **Changed:** `PlasmaRenderer`, `makeShaders` and the renderer types are
  marked `@internal` - still exported as an escape hatch, but outside semver.

### React

- **Fixed:** refs were written during render (`settingsRef`, `joinCb`,
  `plasmaRef`). They update in a layout effect now.
- **Fixed:** a surface's options reached the renderer one paint late, because
  the update ran in a passive effect while the CSS it accompanies commits with
  layout. Registration also read those options through a closure its own dep
  list could leave stale for a frame; it reads a ref instead.
- **Fixed:** `useLayoutEffect` warned during server rendering. Both components
  use an isomorphic variant, and join state reads through
  `useSyncExternalStore` with a server snapshot - SSR is clean, and tested.
- **Fixed:** interaction handlers were new identities on every render, which
  broke memoization for `as={MemoizedComponent}`.
- **Added:** development-only warnings for a `<Plasma>` outside a provider, a
  provider with no canvas, and a `style` setting `transform`, `translate` or
  `scale` on a positioned surface - the three failures that were silent. They
  drop out of a production build.

### Gate

- `npm run verify` also runs `typecheck:app` (the site, the examples and a
  compile-only API suite, none of which were typechecked before) and
  `format:check`. CI adds `typecheck:react19`, since the peer range is
  `react >=18` while the dev types pin 18.
- Prettier no longer claims `src`, `tests` or CSS, whose dense style is
  deliberate; `npm run format` used to hand a 690-line diff to anyone who ran it.


Follow-ups to the context-loss work in 0.2.4, which fixed the frame loop but
left the paths around it holding objects from the dead context.

- **Fixed:** a `background` image was gone for good after a context restore.
  `initGL()` re-ran `configure()`, but `loadBackground()` early-returns on an
  unchanged source, so `imgTex` kept its handle from the dead context while
  `uHasImg` still said 1 — every frame then threw INVALID_OPERATION on
  `bindTexture`. The background state is reset before the reconfigure, so the
  source is genuinely reloaded.
- **Fixed:** a restore that landed during a `freezeOnScroll` fling left the
  canvas blank. `applyResize()` refuses to allocate while frozen, so the eight
  targets got no storage and the multi-target framebuffer no attachments, and
  the loop restarted into a freeze that was meant to hold it. A restore now
  ends the freeze and reallocates.
- **Fixed:** `destroy()` leaked the background texture — created in
  `loadBackground()`, so never in the owned set — and a full-size texture went
  with every teardown, including each StrictMode remount.
- **Fixed:** a background image whose load landed after `destroy()` allocated
  an orphan texture on the still-live shared context.
- **Fixed:** compiled shaders were never deleted. `deleteProgram()` does not
  free a shader that was not flagged, so ten shader objects stranded per
  `initGL()` — once per remount and once per context restore.
- **Changed:** the provider's `configure()` effect derives its dependencies
  from the settings object rather than a hand-written list, so a new setting is
  live the moment it is added instead of silently freezing at its mount value.
- **Added:** a fake WebGL2 + DOM harness (`tests/webgl-harness.mjs`) and seven
  renderer lifecycle tests. It accounts for every GL object created and fails
  on any use of one from a dead context or already deleted — the two mistakes
  that are invisible in a browser until the field goes black.

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
- **Fixed:** the field never rendered at all under React StrictMode. `destroy()`
  called `WEBGL_lose_context.loseContext()`, but the `<canvas>` belongs to the
  host component and outlives the renderer, so the remount StrictMode performs
  in development got a context that could never draw again. Cleanup now
  deletes its own textures, framebuffers, programs and buffer and leaves the
  canvas usable. A renderer replacing another on the same canvas also zeroes
  the canvas size, so the next allocation is never skipped as a no-op — that
  skip left the multi-target framebuffer with no attachments and drew
  "Framebuffer is incomplete".

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
