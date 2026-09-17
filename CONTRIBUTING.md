# Contributing

## Setup

```bash
npm install
npm run build       # library → dist/
npm run build:site  # docs + playground → site/dist/index.html (open in a browser)
npm test            # snap-logic tests
npm run typecheck
```

Read `AGENTS.md` first - it covers the render pipeline, motion systems, and invariants.

## Layout

- `src/shaders.ts` — GLSL for the render passes (background, silhouette, tint/frost, blur, composite)
- `src/renderer.ts` — WebGL pipeline, per-frame shape tracking, corner squaring, viscous surface springs
- `src/snap.ts` — pure snapping math (tested)
- `src/PlasmaProvider.tsx`, `src/Plasma.tsx` — React layer
- `site/` — docs page, built with the library itself

## Guidelines

- The docs page is the integration test: build it and click through the four nav configurations after any renderer change.
- Keep `README.md` prop tables in sync with the exported types.
- Visual changes: include before/after screenshots in the PR.

## Known gaps (good first projects)

- Layers: overlapping surfaces currently fuse; fixed bars over scrolling glass must be plain CSS.
- Clipping for glass inside scroll containers.
- Drag handles (`handle` prop) so panel content stays fully interactive.
- Resize handles with grid snapping.
