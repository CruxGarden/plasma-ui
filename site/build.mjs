import { buildPage, PAGES } from "../scripts/build-page.mjs";
const site = PAGES[0];
await buildPage({ ...site, outFile: "site/dist/index.html" });
