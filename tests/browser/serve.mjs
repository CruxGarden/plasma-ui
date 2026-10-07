import { build } from 'esbuild';
import { createServer } from 'node:http';
const result = await build({entryPoints:['tests/browser/fixture.tsx'],bundle:true,write:false,format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
const script = result.outputFiles[0].text;
createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?script:'<!doctype html><html><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');}).listen(4175,'127.0.0.1');
