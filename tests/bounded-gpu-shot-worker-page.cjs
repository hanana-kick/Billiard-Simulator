'use strict';
// Pure LOCAL asset copying/hashing only. No engine execution, native/GPU work,
// browser launch, external upload, product build edit or implicit activation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=process.env.BOUNDED_WORKER_PAGE_DIR;
assert.ok(OUT&&path.isAbsolute(OUT),'Set BOUNDED_WORKER_PAGE_DIR to a new absolute local workspace directory');
assert.ok(!fs.existsSync(OUT),'Use a fresh output directory; do not overwrite another test page');
assert.ok(process.env.RAPIER_WASM_PROVENANCE,'Set the admitted RAPIER_WASM_PROVENANCE build manifest');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
(async()=>{
const {buildGpuWorkerAssets}=require('../tools/build-gpu-worker-assets.cjs');
const built=await buildGpuWorkerAssets({root:ROOT,out:OUT});
const p={wasmSha256:built.wasmSha256,engineSha256:built.engineSha256};
const files=[...Object.keys(built.files).filter(file=>/\.(?:js|mjs)$/.test(file)),'tests/browser-initial-import-evidence.mjs','tests/bounded-gpu-shot-worker-page.mjs'];
for(const file of files.filter(file=>file.startsWith('tests/'))){fs.mkdirSync(path.dirname(path.join(OUT,file)),{recursive:true});fs.copyFileSync(path.join(ROOT,file),path.join(OUT,file));}
const manifest={schema:'bounded-four-ball-worker-page-v1',scope:'Explicit dedicated-worker transport for the existing exact default initial-four GPU service. Null adapter is unsupported, not a GPU pass. No product integration.',
  sources:Object.fromEntries(files.map(file=>[file,hash(fs.readFileSync(path.join(ROOT,file)))])),wasmSha256:p.wasmSha256,engineSha256:p.engineSha256};
fs.writeFileSync(path.join(OUT,'worker-page-manifest.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(OUT,'index.html'),`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Experimental four-ball worker</title>
<h1>Experimental four-ball GPU worker</h1><p>No product activation. The only admitted input is the original raw default initial-four capture. No CPU fallback.</p>
<button id="connect">Check worker GPU capability</button> <input id="capture" type="file" accept="application/json">
<button id="start" disabled>Start one bounded h</button> <button id="resume" disabled>Resume one bounded h</button>
<button id="cancel" disabled>Cancel and drain</button> <button id="dispose" disabled>Dispose worker</button>
<pre id="result" role="status">Not run. Transport tests do not prove WGSL execution.</pre>
<script type="module" src="tests/bounded-gpu-shot-worker-page.mjs"></script>`);
console.log(JSON.stringify({directory:OUT,sourceCount:files.length,manifestSha256:hash(JSON.stringify(manifest,null,2)),gpuWork:false}));

})().catch(error=>{console.error(error);process.exitCode=1;});
