import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Bundled to files (not data URLs) so Node resolves one shared "react".
const DIR = new URL("./.tmp-components/", import.meta.url);
await mkdir(DIR, { recursive: true });
const bundle = async (entry, name) => {
  const out = new URL(name, DIR);
  await build({
    entryPoints: [entry], bundle: true, format: "esm", jsx: "automatic", target: "es2020",
    external: ["react", "react-dom"], outfile: out.pathname,
  });
  return import(out.href);
};
const lib = await bundle("src/index.ts", "lib.mjs");
const { rovingIndex, inkOn, idPart } = await bundle("src/components/shared.ts", "shared.mjs");
test.after(() => rm(DIR, { recursive: true, force: true }));

function ssr(el) {
  const errors = [];
  const { error, warn } = console;
  console.error = (...a) => errors.push(a.join(" "));
  console.warn = (...a) => errors.push(a.join(" "));
  try {
    return { html: renderToStaticMarkup(h(lib.PlasmaProvider, null, el)), errors };
  } finally {
    console.error = error;
    console.warn = warn;
  }
}

test("rovingIndex wraps, jumps to the ends, and ignores other keys", () => {
  assert.equal(rovingIndex("ArrowRight", 0, 3), 1);
  assert.equal(rovingIndex("ArrowRight", 2, 3), 0);
  assert.equal(rovingIndex("ArrowLeft", 0, 3), 2);
  assert.equal(rovingIndex("Home", 2, 3), 0);
  assert.equal(rovingIndex("End", 0, 3), 2);
  assert.equal(rovingIndex("ArrowDown", 0, 3), -1, "vertical keys do nothing in a horizontal list");
  assert.equal(rovingIndex("ArrowDown", 0, 3, "vertical"), 1);
  assert.equal(rovingIndex("ArrowRight", 0, 3, "vertical"), -1);
  assert.equal(rovingIndex("a", 0, 3), -1);
  assert.equal(rovingIndex("ArrowRight", 0, 0), -1);
});

test("inkOn picks a readable color and declines a non-hex tint", () => {
  assert.equal(inkOn("#ffffff", 0.9), "#0b1115");
  assert.equal(inkOn("#102030", 0.9), "#ffffff");
  assert.equal(inkOn("#fff", 1), "#0b1115");
  assert.equal(inkOn("tomato"), undefined);
});

test("idPart preserves distinct values without whitespace in aria IDs", () => {
  const parts = ["a b", "a_b", "a  b", "a%20b", "😀"].map(idPart);
  assert.equal(new Set(parts).size, parts.length);
  assert.ok(parts.every(part => !/\s/.test(part)));
});

test("PlasmaButton renders a button surface and passes DOM props through", () => {
  const { html, errors } = ssr(h(lib.PlasmaButton, { solid: true, size: "lg", "aria-label": "go", id: "b" }, "Go"));
  assert.match(html, /<button[^>]*type="button"/);
  assert.match(html, /plasma-button/);
  assert.match(html, /data-size="lg"/);
  assert.match(html, /aria-label="go"/);
  assert.match(html, /color:#0b1115/, "a solid white button gets dark text");
  assert.deepEqual(errors, []);
});

test("PlasmaSwitch is a role=switch whose state follows checked", () => {
  const off = ssr(h(lib.PlasmaSwitch, { "aria-label": "Wi-Fi" }));
  assert.match(off.html, /role="switch"/);
  assert.match(off.html, /aria-checked="false"/);
  const on = ssr(h(lib.PlasmaSwitch, { defaultChecked: true, label: "Wi-Fi" }));
  assert.match(on.html, /aria-checked="true"/);
  assert.match(on.html, /<label[^>]*plasma-switch-field/, "a label wraps the switch so its text names it");
  assert.deepEqual([...off.errors, ...on.errors], []);
});

test("PlasmaSlider puts the accessible name on the range input and sets the fraction", () => {
  const { html, errors } = ssr(h(lib.PlasmaSlider, { defaultValue: 25, min: 0, max: 100, "aria-label": "Volume", name: "vol", id: "v" }));
  assert.match(html, /<input[^>]*type="range"/);
  const input = html.match(/<input[^>]*>/)[0];
  assert.match(input, /aria-label="Volume"/);
  assert.match(input, /name="vol"/);
  assert.match(input, /id="v"/);
  assert.match(input, /value="25"/);
  assert.match(html, /--plasma-slider-frac:0\.25/);
  assert.deepEqual(errors, []);
});

test("PlasmaSlider clamps a value outside its range and survives min === max", () => {
  assert.match(ssr(h(lib.PlasmaSlider, { value: 500, "aria-label": "x" })).html, /--plasma-slider-frac:1/);
  assert.match(ssr(h(lib.PlasmaSlider, { value: 5, min: 5, max: 5, "aria-label": "x" })).html, /--plasma-slider-frac:0/);
});

const tabs = (value) =>
  h(lib.PlasmaTabs, { defaultValue: value },
    h(lib.PlasmaTabList, { "aria-label": "Sections" },
      h(lib.PlasmaTab, { value: "one" }, "One"),
      h(lib.PlasmaTab, { value: "two words" }, "Two")),
    h(lib.PlasmaTabPanel, { value: "one" }, "first body"),
    h(lib.PlasmaTabPanel, { value: "two words" }, "second body"));

test("PlasmaTabs wires roles, selection, roving tabindex, and only mounts the selected panel", () => {
  const { html, errors } = ssr(tabs("one"));
  assert.match(html, /role="tablist"/);
  const tabEls = html.match(/<button[^>]*role="tab"[^>]*>/g);
  assert.equal(tabEls.length, 2);
  assert.match(tabEls[0], /aria-selected="true"/);
  assert.match(tabEls[0], /tabindex="0"/);
  assert.match(tabEls[1], /aria-selected="false"/);
  assert.match(tabEls[1], /tabindex="-1"/);
  assert.match(html, /first body/);
  assert.doesNotMatch(html, /second body/);
  // each tab's aria-controls names a panel id that exists, spaces and all
  const controls = tabEls[1].match(/aria-controls="([^"]+)"/)[1];
  assert.ok(!/\s/.test(controls));
  assert.ok(html.includes(`id="${controls}"`));
  assert.deepEqual(errors, []);
});

test("a tab outside <PlasmaTabs> says so", () => {
  assert.throws(() => ssr(h(lib.PlasmaTab, { value: "x" }, "x")), /inside <PlasmaTabs>/);
});

const accordion = (props) =>
  h(lib.PlasmaAccordion, props,
    h(lib.PlasmaAccordionItem, { value: "a", title: "Alpha" }, "alpha body"),
    h(lib.PlasmaAccordionItem, { value: "b", title: "Beta", headingLevel: 2 }, "beta body"));

test("PlasmaAccordion opens the items it is given and links trigger to region", () => {
  const { html, errors } = ssr(accordion({ defaultValue: ["b"] }));
  const triggers = html.match(/<button[^>]*plasma-accordion-trigger[^>]*>/g);
  assert.equal(triggers.length, 2);
  assert.match(triggers[0], /aria-expanded="false"/);
  assert.match(triggers[1], /aria-expanded="true"/);
  assert.match(html, /<h2[^>]*plasma-accordion-heading/, "headingLevel picks the element");
  assert.match(html, /<h3[^>]*plasma-accordion-heading/);
  const controls = triggers[1].match(/aria-controls="([^"]+)"/)[1];
  assert.ok(html.includes(`id="${controls}"`));
  assert.match(html, /role="region"/);
  assert.match(html, /data-state="open"/);
  assert.deepEqual(errors, []);
});

test("an accordion item outside <PlasmaAccordion> says so", () => {
  assert.throws(() => ssr(h(lib.PlasmaAccordionItem, { value: "a", title: "A" }, "x")), /inside <PlasmaAccordion>/);
});

test("every component renders as the CSS fallback on the server", () => {
  const { html } = ssr(h("div", null, h(lib.PlasmaButton, null, "b"), h(lib.PlasmaSwitch, { "aria-label": "s" }), tabs("one"), accordion({})));
  assert.ok((html.match(/plasma-fallback/g) ?? []).length >= 7);
});
