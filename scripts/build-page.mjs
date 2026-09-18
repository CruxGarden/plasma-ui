// One builder for every standalone page we ship: the marketing site and each
// example. Each page is a single self-contained HTML file — the bundle and the
// stylesheet are inlined, so a page can be opened from disk or served from any
// static host without a second request.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=JetBrains+Mono&family=Onest:wght@400;500&display=swap";

// Share cards need absolute URLs - a scraper has no page to resolve a relative
// path against - so the published origin is part of the build.
const ORIGIN = "https://cruxgarden.github.io/plasma-ui";
const SHARE_IMAGE = `${ORIGIN}/og-image.jpg`;
const SHARE_IMAGE_ALT =
  "The Plasma UI site: the wordmark on a liquid panel over a green and violet plasma field";

/** Attribute values are quoted with ", so those and the entity starters escape. */
const attr = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * @param {object} page
 * @param {string} page.entry   TSX entry point, bundled and minified
 * @param {string} page.css     stylesheet inlined into the document
 * @param {string} page.title   document title
 * @param {string} page.description one sentence, for search results and share cards
 * @param {string} page.path    published path, which fixes the page's canonical URL
 * @param {string} page.outFile where the HTML is written
 */
export async function buildPage({
  entry,
  css,
  title,
  description,
  path = "index.html",
  outFile,
}) {
  const out = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    target: "es2020",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  // A literal </script> inside the bundle would close the tag that carries it.
  const js = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
  // index.html is served as the directory itself, so it is not part of the URL.
  const url = `${ORIGIN}/${path.replace(/(^|\/)index\.html$/, "$1")}`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${attr(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Plasma UI">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SHARE_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${attr(SHARE_IMAGE_ALT)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(description)}">
<meta name="twitter:image" content="${SHARE_IMAGE}">
<meta name="twitter:image:alt" content="${attr(SHARE_IMAGE_ALT)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<style>${readFileSync(css, "utf8")}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>`;
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html);
  console.log(outFile, (html.length / 1024).toFixed(0) + " KB");
  return outFile;
}

/** The pages that make up the published site, in the layout GitHub Pages serves. */
export const PAGES = [
  {
    entry: "site/main.tsx",
    css: "site/style.css",
    title: "Plasma UI — liquid panels for React",
    description:
      "Liquid panels for React, rendered in WebGL on canvas. Every panel is one shared plasma: they fuse on contact, refract what's behind them, and snap to a grid.",
    path: "index.html",
  },
  {
    entry: "examples/workspace/main.tsx",
    css: "examples/workspace/style.css",
    title: "Plasma UI — Workspace example",
    description:
      "A working workspace built on Plasma UI: inbox, reader, tasks and player as draggable panels that fuse when they touch.",
    path: "examples/workspace/index.html",
  },
];
