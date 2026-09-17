# Plasma UI

Liquid panels for React, inspired by Apple's Liquid Glass design. The `<Plasma>` panel looks and behaves like liquid, with surface tension that fuses on contact with other panels. Anything visible behind the panel is refracted. And for layout convenience, the panels ultimately snap to a grid layout. The library is a work in progress, extracted from the [Crux Garden](https://github.com/cruxgarden) project, but it seemed useful enough to share in it's current form.

![Five panels in a workspace: one is dragged out of its group and travels as liquid, another is dropped against a neighbour and fuses into it, and each snaps to the 24px grid](docs/demo.gif)

[Playground and Docs](https://cruxgarden.github.io/plasma-ui/) · [Workspace example](https://cruxgarden.github.io/plasma-ui/examples/workspace/)

**Status: 0.2.0.** Core is stable and tested, but the API may change.

```bash
npm install @cruxgarden/plasma-ui
```

Zero dependencies, except for React.

```tsx
import { PlasmaProvider, Plasma } from "@cruxgarden/plasma-ui";

export function App() {
  return (
    <PlasmaProvider mood="tidal">
      <Plasma as="header" lean={false}>
        My App
      </Plasma>
      <Plasma draggable>
        <h3>Inbox</h3>
      </Plasma>
    </PlasmaProvider>
  );
}
```

## Example

[`examples/workspace`](examples/workspace) demonstrates how the library can be used for a real-world dashboard layout.

## `<PlasmaProvider>`

| Prop                       | Type                                     | Default        | Description                                                                                                                                                                          |
| -------------------------- | ---------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mood`                     | `"tidal" \| "aurora" \| "ember" \| Mood` | `"tidal"`      | Colors, blend distance, and spring feel                                                                                                                                              |
| `theme`                    | `"auto" \| "light" \| "dark"`            | `"auto"`       | Auto follows the OS and `<html data-theme>`                                                                                                                                          |
| `radius`                   | `number`                                 | `26`           | Default corner radius (px) for every surface                                                                                                                                         |
| `background`               | `BackgroundSource`                       |                | Any CSS color (luminance drift), image URL (refracted, slow swirl), or an `img`/`canvas`/`video` element - canvas and video update live. Dynamic. Omit for the procedural mood field |
| `blend`                    | `number`                                 | mood           | Distance (px) at which surfaces start to fuse                                                                                                                                        |
| `viscosity`                | `number`                                 | `0.5`          | `0` is watery and bouncy, `1` is slow like syrup; also scales drag and snap springs                                                                                                  |
| `stretch`                  | `number`                                 | `1`            | How far the plasma trails behind moving panels; `0` turns it off                                                                                                                     |
| `flow`                     | `number`                                 | `0`            | Slow ripple along the edges                                                                                                                                                          |
| `tint`                     | `string`                                 | `"#ffffff"`    | Plasma color (hex)                                                                                                                                                                   |
| `opacity`                  | `number`                                 | `0`            | Tint strength, 0 (clear) to 1 (solid color)                                                                                                                                          |
| `frost`                    | `number`                                 | `0`            | Translucency, 0 (clear) to 1 (frosted)                                                                                                                                               |
| `elevation`                | `number`                                 | `0.35`         | Shadow depth, 0 (flat) to 1 (floating); dragged surfaces raise automatically                                                                                                         |
| `smoothness`               | `number`                                 | `1`            | Outline smoothing strength                                                                                                                                                           |
| `refraction`, `dispersion` | `number`                                 | `1`            | Lens strength, color splitting                                                                                                                                                       |
| `rim`                      | `number`                                 | `1`            | Colored rim strength; `0` turns it off                                                                                                                                               |
| `rimColor`                 | `"iridescent" \| "tint" \| string`       | `"iridescent"` | Rainbow sheen, each surface's tint, or a hex color                                                                                                                                   |
| `rimWidth`                 | `number`                                 | `1`            | How far the rim reaches in from the edge                                                                                                                                             |
| `highlight`                | `number`                                 | `1`            | Pointer-facing highlight; `0` turns it off                                                                                                                                           |
| `edgeLine`                 | `number`                                 | `1`            | Thin line along the outline; `0` turns it off                                                                                                                                        |
| `pointerDrop`              | `boolean`                                | `true`         | Liquid drop that follows the pointer                                                                                                                                                 |
| `ambientDrops`             | `boolean`                                | `false`        | Decorative orbiting drops                                                                                                                                                            |
| `grid`, `magnet`           | `number`                                 | `24`, `40`     | Snap grid size and edge latch distance                                                                                                                                               |
| `quality`                  | `number`                                 | `1.25`         | Maximum canvas pixel ratio                                                                                                                                                           |
| `maxSurfaces`              | `number`                                 | `16`           | Visible surface budget, compiled into the shaders (fixed at mount); higher costs GPU time                                                                                            |
| `zIndex`                   | `number`                                 | `-1`           | Canvas stacking order                                                                                                                                                                |

## `<Plasma>`

Accepts all HTML attributes, plus the following:

| Prop                                    | Type                     | Default  | Description                                                                                                         |
| --------------------------------------- | ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `as`                                    | `ElementType`            | `"div"`  | Element to render                                                                                                   |
| `radius`                                | `number`                 | provider | Corner radius (px) for this surface                                                                                 |
| `lean`                                  | `number \| false`        | `10`     | Lean toward the pointer while standalone                                                                            |
| `tint`, `opacity`, `frost`, `elevation` | `string`, `number`       | provider | Color, translucency, and shadow depth for this surface; joined surfaces with different values blend into each other |
| `padding`                               | `number`                 |          | Inner padding (px); halves on joined edges so gutters between fused panels equal the free-edge inset                |
| `fuse`                                  | `boolean`                | `true`   | `false`: this surface never blends, bridges, or joins with others - for bars, docks, and fixed chrome               |
| `draggable`                             | `boolean`                | `false`  | Move freely, snap on release; arrow keys move one grid step                                                         |
| `snap`                                  | `boolean`                | `true`   | Latch to neighbor edges, otherwise the grid                                                                         |
| `bounds`                                | `RefObject<HTMLElement>` | viewport | Drag area and grid origin                                                                                           |
| `offset` / `defaultOffset`              | `{ x, y }`               |          | Controlled or initial offset; changes spring into place                                                             |
| `onDragStart`, `onDragEnd(offset)`      |                          |          | Drag lifecycle; `onDragEnd` gets the settled offset                                                                 |
| `onJoinChange(joined)`                  |                          |          | Fires when the surface fuses with or separates from a neighbor                                                      |

Drag ignores presses on buttons, links, inputs, and anything marked `data-plasma-nodrag`.

## `usePlasma()`

Returns `pulse(x, y, strength?)`, `bump(energy)`, `supported`, `grid`, `magnet`, `spring`, and `reducedMotion`.

## Custom moods

```ts
import type { Mood } from "@cruxgarden/plasma-ui";

const dusk: Mood = {
  colors: ["#0b0816", "#3b2a6b", "#f0a868"],
  blend: 40,
  spring: { stiffness: 150, damping: 14 },
};
```

## Motion

Each panel undulates like a Slinky when moving. Three properties control this movement: viscosity, stretch, and flow.

```tsx
<PlasmaProvider viscosity={0.1} stretch={1.3} flow={0.6} />  // water
<PlasmaProvider viscosity={0.85} stretch={1.8} />            // honey
<PlasmaProvider stretch={0} />                               // the plasma tracks panels exactly
```

NOTE: `flow` ripples the outline, so leave it at `0` whenever flush edges should stay perfectly straight.

## Styling the rim (fancy outline)

```tsx
// solid cyan rim, a bit wider, no pointer highlight
<PlasmaProvider rimColor="#5fd4ff" rimWidth={1.6} highlight={0} />

// each panel's rim follows its own tint
<PlasmaProvider rimColor="tint">
  <Plasma tint="#ff5fa2" opacity={0.3} />
</PlasmaProvider>

// plain plasma: no colored rim, just the edge line
<PlasmaProvider rim={0} />
```

## Guidelines

- Use Plasma for container components: panels, docks, cards, dialogs. Components should be nested inside.
- Place surfaces together or further apart than the Blend distance. Smaller gaps render as liquid bridging them.
- Up to `maxSurfaces` (default 16) draw at once; offscreen panels are skipped first. Two render passes loop over every slot per pixel, so set this value only as high as you need.
- Lean and Pulse use the CSS `translate` and `scale` properties, and Drag uses `transform`. Avoid setting these properties on `Plasma` elements yourself.
- `prefers-reduced-motion` disables Lean, Pulse, the pointer Drop, and Spring.

## Roadmap

Ordered by priority:

1. **Layers** - panels that will stack instead of fusing. For use with dialogs, menus, and such.
2. **Drag handles and resize** - will add a `handle` prop for dragging, so panel content can be fully interactive. Also, edge resizing with grid snapping.
3. **Scroll clipping** - plasma confined to scrollable containers.
4. **Pluggable Backgrounds** - colors, images, and live canvas/video shipped in 0.1 (`background` prop); custom shaders are next.
5. **Shapes and Orientation** - non-rectangular outlines, rotation...etc.

Contributions welcome for any of these - see [CONTRIBUTING.md](CONTRIBUTING.md).

## Browser support

Chrome, Edge, Firefox, and Safari 16.4+ (WebGL2). In non-supported browsers, `Plasma` renders as a CSS frosted panel and all layout, drag, and snap behavior still works.

## Development

```bash
npm install
npm run build          # library → dist/
npm run build:site     # docs + playground → site/dist/index.html
npm run build:example  # workspace example → examples/workspace/dist/index.html
npm run build:pages    # both, in the layout GitHub Pages serves → site/dist/
npm test               # snap-logic tests
npm run verify         # typecheck + tests + build, the gate CI runs
```

Every page is a single self-contained HTML file, so you can open one straight
from disk. `scripts/build-page.mjs` is the one builder they share.

Pushing to `main` deploys `npm run build:pages` to GitHub Pages:

- Site: https://cruxgarden.github.io/plasma-ui/
- Workspace example: https://cruxgarden.github.io/plasma-ui/examples/workspace/

Releases go to npm from a local machine, the same way the Crux Garden CLI
does — see [PUBLISH.md](PUBLISH.md).

## Used by

- [Crux Garden](https://github.com/cruxgarden) - the project Plasma UI was originally built for.

Using it in something? Add yours in a PR.

## Contributing

Contributions are welcome - bug reports, fixes, and roadmap features alike.

1. Fork the repo and create a branch from `main`.
2. `npm install`, make your change, and keep `npm test` and `npm run typecheck` green.
3. Rebuild the docs site (`npm run build:site`) and click through the five nav configurations - it's the integration test.
4. For visual changes, include before/after screenshots in the PR.
5. Open a pull request with a short description of what changed and why.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the code layout and a list of known gaps that make good first projects. By contributing, you agree that your contributions will be licensed under the MIT license.

## Acknowledgements

Plasma UI is built on well-known graphics and simulation techniques:

- **Blobby surfaces / metaballs** - the fuse-on-contact behavior descends from Jim Blinn's [_A Generalization of Algebraic Surface Drawing_](https://dl.acm.org/doi/10.1145/357306.357310) (1982).
- **Signed distance fields** - the material is drawn with 2D SDFs combined by smooth minimum, per Inigo Quilez's [2D distance functions](https://iquilezles.org/articles/distfunctions2d/) and [smooth minimum](https://iquilezles.org/articles/smin/) articles; the procedural background uses his [fBM](https://iquilezles.org/articles/fbm/) construction.
- **Spring integration** - panel motion uses semi-implicit Euler with fixed substeps, in the spirit of Glenn Fiedler's [_Integration Basics_](https://gafferongames.com/post/integration_basics/).
- **The optical treatment** (refraction, dispersion, frost) is an original WebGL take on the direction popularized by Apple's [Liquid Glass](https://developer.apple.com/design/human-interface-guidelines/materials) material.

## License

[MIT](LICENSE)
