import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
const out = await build({
  entryPoints: ["examples/workspace/main.tsx"], bundle: true, minify: true, write: false, format: "iife",
  jsx: "automatic", target: "es2020", define: { "process.env.NODE_ENV": '"production"' },
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync("examples/workspace/style.css", "utf8");
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plasma UI - Workspace example</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500&family=Onest:wght@400;500&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>`;
mkdirSync("examples/workspace/dist", { recursive: true });
writeFileSync("examples/workspace/dist/index.html", html);
console.log("examples/workspace/dist/index.html", (html.length / 1024).toFixed(0) + " KB");
