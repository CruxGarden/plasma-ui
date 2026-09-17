// One builder for every standalone page we ship: the marketing site and each
// example. Each page is a single self-contained HTML file — the bundle and the
// stylesheet are inlined, so a page can be opened from disk or served from any
// static host without a second request.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500&family=Cormorant+Garamond:wght@500;600&family=JetBrains+Mono&family=Onest:wght@400;500&display=swap";

/**
 * @param {object} page
 * @param {string} page.entry   TSX entry point, bundled and minified
 * @param {string} page.css     stylesheet inlined into the document
 * @param {string} page.title   document title
 * @param {string} page.outFile where the HTML is written
 */
export async function buildPage({ entry, css, title, outFile }) {
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
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
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
    title: "Plasma UI",
    path: "index.html",
  },
  {
    entry: "examples/workspace/main.tsx",
    css: "examples/workspace/style.css",
    title: "Plasma UI — Workspace example",
    path: "examples/workspace/index.html",
  },
];
