import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Bundled to a file rather than a data URL so Node resolves the bare "react"
// specifier from node_modules - the library and the test must share one React.
const OUT = new URL("./.tmp/lib.mjs", import.meta.url);
await mkdir(new URL("./.tmp/", import.meta.url), { recursive: true });
await build({
  entryPoints: ["src/index.ts"],
  bundle: true, format: "esm", jsx: "automatic", target: "es2020",
  external: ["react", "react-dom"], outfile: OUT.pathname,
});
const { Plasma, PlasmaProvider, PlasmaCanvas } = await import(OUT.href);
test.after(() => rm(new URL("./.tmp/", import.meta.url), { recursive: true, force: true }));

/** Render on the server, collecting anything React complains about. */
function ssr(el) {
  const errors = [];
  const warns = [];
  const { error, warn } = console;
  console.error = (...a) => errors.push(a.join(" "));
  console.warn = (...a) => warns.push(a.join(" "));
  try {
    return { html: renderToStaticMarkup(el), errors, warns };
  } finally {
    console.error = error;
    console.warn = warn;
  }
}

test("the provider and its surfaces render on the server without warnings", () => {
  const { html, errors } = ssr(
    h(PlasmaProvider, { mood: "tidal" }, h(Plasma, { radius: 20, padding: 16 }, "hello")),
  );
  assert.match(html, /<canvas/);
  assert.match(html, /plasma-panel/);
  assert.match(html, /hello/);
  // There is no WebGL on the server, so a surface must come out as the fallback.
  assert.match(html, /plasma-fallback/);
  assert.deepEqual(errors, [], "React complained during server rendering");
});

test("useSyncExternalStore has a server snapshot, so padding renders unjoined", () => {
  const { html, errors } = ssr(
    h(PlasmaProvider, null, h(Plasma, { padding: 20 }, "p")),
  );
  // Every side unjoined: the full inset on all four.
  assert.match(html, /padding:\s*20px 20px 20px 20px/);
  assert.deepEqual(errors, []);
});

test("a Plasma outside a provider still renders, and says so once", () => {
  const { html } = ssr(h(Plasma, null, "orphan"));
  assert.match(html, /plasma-fallback/);
  assert.match(html, /orphan/);
});

test("canvas={false} renders no canvas until a PlasmaCanvas is placed", () => {
  const without = ssr(h(PlasmaProvider, { canvas: false }, h("main", null, "x")));
  assert.doesNotMatch(without.html, /<canvas/);

  const withOne = ssr(
    h(PlasmaProvider, { canvas: false }, h(PlasmaCanvas, { zIndex: -5, className: "field" })),
  );
  assert.match(withOne.html, /<canvas/);
  assert.match(withOne.html, /class="field"/);
  assert.match(withOne.html, /z-index:\s*-5/);
});

test("polymorphic `as` renders the element it was given", () => {
  const { html } = ssr(
    h(PlasmaProvider, null, h(Plasma, { as: "a", href: "https://crux.garden" }, "link")),
  );
  assert.match(html, /<a [^>]*href="https:\/\/crux.garden"/);
  assert.match(html, /plasma-panel/);
});
