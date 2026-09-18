/**
 * AGENTS.md says the README prop tables mirror dist/*.d.ts and the playground
 * defaults mirror the library defaults. That was a promise nothing checked,
 * and `freezeOnScroll` had been public and undocumented on both surfaces for
 * several releases. This turns the promise into part of `npm run verify`.
 *
 * It is deliberately shallow: it asks whether every public prop is *mentioned*
 * in the README and on the docs site, not whether what is written is any good.
 */
import fs from "node:fs";

const read = (p) =>
  fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const fail = [];

if (!fs.existsSync(new URL("../dist/PlasmaProvider.d.ts", import.meta.url))) {
  console.error("check-docs: dist/ is missing - run `npm run build` first.");
  process.exit(2);
}

const dts = ["PlasmaProvider", "Plasma"]
  .map((f) => read(`dist/${f}.d.ts`))
  .join("\n");
const readme = read("README.md");
const site = read("site/App.tsx");

const propsOf = (iface) => {
  const m = dts.match(new RegExp(`interface ${iface} \\{([\\s\\S]*?)\\n\\}`));
  if (!m) {
    fail.push(`interface ${iface} not found in dist/*.d.ts`);
    return [];
  }
  return [...m[1].matchAll(/^\s{4}(\w+)\??:/gm)]
    .map((x) => x[1])
    .filter((p) => p !== "children");
};

const mentions = (text, name) => new RegExp(`\\b${name}\\b`).test(text);

for (const iface of [
  "PlasmaProviderProps",
  "PlasmaOwnProps",
  "PlasmaCanvasProps",
]) {
  for (const prop of propsOf(iface)) {
    if (!mentions(readme, prop))
      fail.push(`${iface}.${prop} is public but not mentioned in README.md`);
    if (!mentions(site, prop))
      fail.push(`${iface}.${prop} is public but not mentioned in site/App.tsx`);
  }
}

// Playground defaults must be the library's, or the copied snippet lies.
const libSrc = read("src/PlasmaProvider.tsx");
const libDefaults = Object.fromEntries(
  [
    ...libSrc.matchAll(/\b(\w+) = ((?:[\d.]+|true|false|"[^"]*"))(?=[,\s\n])/g),
  ].map((m) => [m[1], m[2]]),
);
// Deliberate divergences, each with the reason the site gives for it.
const INTENDED = {
  theme:
    "the docs page starts dark on purpose - the light theme washes out the mood field",
};
const siteBlock = site.match(/const DEFAULTS: Settings = \{([\s\S]*?)\n\};/);
if (!siteBlock) fail.push("site/App.tsx: DEFAULTS block not found");
else
  for (const [, k, v] of siteBlock[1].matchAll(
    /^\s*(\w+): ((?:[\d.]+|true|false|"[^"]*")),/gm,
  ))
    if (libDefaults[k] !== undefined && libDefaults[k] !== v && !INTENDED[k])
      fail.push(
        `playground default ${k}=${v} does not match the library default ${libDefaults[k]}`,
      );

if (fail.length) {
  console.error(
    "Documentation is out of step with the public API:\n" +
      fail.map((f) => "  - " + f).join("\n"),
  );
  process.exit(1);
}
console.log(
  "check-docs: every public prop is documented, and the playground defaults match.",
);
