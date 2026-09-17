// The GitHub Pages tree: the site at the root, each example under its own path.
// `.nojekyll` stops Pages from running Jekyll over the output.
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { buildPage, PAGES } from "./build-page.mjs";

const OUT = "site/dist";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const page of PAGES) {
  await buildPage({ ...page, outFile: `${OUT}/${page.path}` });
}
writeFileSync(`${OUT}/.nojekyll`, "");
