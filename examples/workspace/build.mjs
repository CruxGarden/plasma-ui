import { buildPage, PAGES } from "../../scripts/build-page.mjs";
const example = PAGES[1];
await buildPage({ ...example, outFile: "examples/workspace/dist/index.html" });
