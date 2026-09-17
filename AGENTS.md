# AGENTS.md - Plasma UI handoff

Working guide for agents and maintainers. Read this before changing rendering or interaction code.

## What this is

`@cruxgarden/plasma-ui` - React library. All `<Plasma>` elements on a page render as **one shared plasma** on a single WebGL2 canvas behind the DOM: surfaces fuse on contact, refract the background, stretch when moved, and snap to a grid. Zero runtime deps beyond React. MIT.

- `PlasmaProvider` - owns the canvas, renderer, and all shared settings.
- `Plasma` - marks an element as a plasma surface; optional drag/snap/offset/padding.
- `usePlasma()` - `pulse`, `bump`, `supported`, `grid`, `magnet`, `spring`, `reducedMotion`.

The DOM stays ordinary HTML (text, focus, a11y). The canvas only _draws_; it never owns content.

## File map

```
src/shaders.ts        GLSL. makeShaders(maxShapes) compiles all fragment sources.
src/renderer.ts       WebGL pipeline + per-frame shape tracking. The heart.
src/spring.ts         springValue (velocity-tracking value) + animateSpring integrator.
src/snap.ts           Pure snap math. Unit-tested.
src/moods.ts          Color/spring presets, hex utils.
src/PlasmaProvider.tsx  React shell, context, CSS fallback, reduced motion.
src/Plasma.tsx        Surface component: registration, drag, keyboard, offsets, padding.
site/                 Docs + playground, built WITH the library. site/build.mjs -> single html.
tests/                node:test suites (snap + spring, deterministic rAF shim).
docs/demo.gif         README capture.
```

## Render pipeline (per frame, renderer.ts `draw`)

0. **Background** -> full-res texture `rtBg`: procedural mood field, or the `background` image (cover-fit, slow swirl + pulse warp; loaded async in `loadBackground`). If any surface has frost > 0: two blurred copies `rtBgM`/`rtBgH` (medium/heavy).
1. **Silhouette** (`maskFrag`) -> `rtA` at half res. All shapes as one SDF; smin blending.
   1b. **Tint/frost/elevation** (`tintFrag`, MRT) -> `rtT` (rgb=tint premultiplied, a=opacity) + `rtFr` (r=frost, g=elevation). Distance-weighted per-shape mix so values blend across joins.
2. **Blurs** (`blurFrag`): light blur of silhouette -> smoothed outline (traced at 0.5 contour, bicubic-sampled in comp); same light blur applied to tint and frost/elevation layers; heavier chain -> `rtC` height field.
3. **Composite** (`compFrag`): refraction from height-field slope with chromatic dispersion, frost = fade sharp->blurred bg copies, tint mix (opacity 1 = flat color: shimmer and bg-bleed scale by `1 - talpha`), rim (iridescent | solid | per-tint), pointer highlight, elevation-driven shadow (offset+strength from elevation channel; sampled slightly above for the caster), film grain **background only** (`grain = 1 - plasmaAlpha`).

### SDF seam rules (do not regress)

- `cornerRadii()` (renderer): a corner touching a neighbor is **squared off** (radius -> 0). The neighbor must actually overlap that corner on the perpendicular axis - both conditions in each check.
- `sdBoxG` returns a `sharp` flag for squared corners; `scene()` multiplies smin strength by `(1-sharp)` for both operands AND by direction: `k *= clamp((1 - dot(n1,n2))/.8, 0, 1)`. Net effect: flush edges stay perfectly straight, gaps/steps get fillets.
- Shapes are drawn from `elementBox()` = getBoundingClientRect with the centered pulse `scale` removed (so seams stay aligned during pulses).

## Motion systems (three, independent)

1. **Viscous surface** (renderer, per shape): each plasma box is a 4-edge spring chasing its element in **page** coordinates (scroll excluded on purpose). Drawn box = union(element, spring) so content never exits the plasma. `viscosity` maps to stiffness/zeta; `stretch` divides stiffness. Springs reset when a shape leaves the viewport.
2. **Offset springs** (Plasma.tsx + spring.ts): drag/keyboard/controlled `offset` animate `transform: translate3d`. `springValue` keeps a 6-sample ring; `getVelocity()` reads across samples because Chrome batches pointermoves per rAF (same-ms sets update the last sample in place - this fixed a real throw-velocity bug, keep the ring).
3. **Lean + pulse** (renderer): written to CSS `translate` / `scale` properties so they compose with the drag `transform`. **Nothing else may write transform/translate/scale on a Plasma element.**

`viscosity` also scales the context spring (see PlasmaProvider `stiffK/dampK`), pulse speed/decay, and flow amplitude. Elevation eases per-frame toward base, +0.35 while dragging.

## Layout systems

- **Snap** (snap.ts): edge-latch to neighbors within `magnet` (alignment beats grid), else grid relative to `bounds`; overlap push-out; bounds clamp. Pure + tested.
- **Join detection** (renderer frame loop): per-side (`JoinedSides`), gap < blend*0.5. Drives `onJoinChange` and the `padding` prop: a `Plasma` with `padding` halves it on joined edges so gutters equal free-edge insets (250ms CSS transition).
- Positioned surfaces (`draggable`/`offset`) register a `layoutBox` reporting their **destination** (dest ref), so snapping against a mid-flight panel targets where it will land.

## Invariants / gotchas

- `maxSurfaces` is compiled into the shaders at mount (`makeShaders`). Changing it live is not supported.
- `renderer.configure()` handles every other provider prop live; the provider effect's dep list must include any new prop.
- Adding a per-surface field = follow tint's path end to end: ShapeOptions -> Rec -> uniform array -> `tintFrag` accumulation -> comp un-premultiply by the blurred silhouette (`msk`). Un-premultiplying is what keeps edges clean.
- Uniform names live in the `UNIFORMS` list (renderer). A shader uniform not listed there silently reads 0.
- Overlapping surfaces fuse (no z-order). `fuse={false}` marks solo surfaces: hard-union in the SDF (separate accumulator in `scene()`), skipped by corner squaring, join detection, and snap neighbors - use it for bars/docks inside a no-scroll app (the Workspace example). Fixed chrome over _scrolling_ plasma must still be plain CSS - the docs nav is the reference pattern.
- The CSS fallback (`.plasma-fallback`) must keep working: check `supported === false` paths when touching Plasma.tsx.
- `prefers-reduced-motion`: springs jump, lean/pulse/drop/surface-spring off. Preserve on any new motion.
- Config precedence for docs: the five nav configs are complete patches; every patch must set any field another patch sets (see `ambientDrops`), or switching tabs leaks state.

## Workflows

```bash
npm install
npm run build        # dist/ (esbuild ESM + tsc declarations)
npm run build:site   # site/dist/index.html - THE integration test; open and click all 5 tabs
npm test             # 13 tests (snap + spring)
npm run typecheck
```

Visual verification is screenshot-driven (headless Chromium works; use SwiftShader flags if no GPU). Caveat from development: under SwiftShader this scene can run <1 fps - sample per-rAF inside the page (record positions in a rAF loop) rather than timing screenshots, or motion looks "frozen" when it isn't.

Docs discipline: README prop tables mirror `dist/*.d.ts`; playground defaults mirror library defaults. Update both with any API change.

## Known gaps -> roadmap (README has the user-facing version)

layers (overlaps fuse) -> drag handles + resize -> scroll clipping -> pluggable background -> shapes/rotation. CONTRIBUTING.md frames these as first projects.

## Publish checklist

1. GitHub: create `cruxgarden/plasma-ui`, push `main` + tags (repo is committed and tagged v0.1.0).
2. npm: create `cruxgarden` org, `npm publish --access public` (prepublishOnly runs typecheck+test+build).
3. Docs page: `npm run build:site` output is a single self-contained html - host anywhere (GitHub Pages: commit `site/dist` or an action).
4. Announce with the workspace framing ("liquid panels for React"), the GIF, and the Not yet section up front.
