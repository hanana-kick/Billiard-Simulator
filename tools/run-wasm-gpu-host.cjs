'use strict';
// Explicit opt-in host qualification. Builds real WASM; never requests a GPU.
// Keep large source-capture checks sequential and cap V8 heap growth.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,env:process.env,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0){console.error('WASM GPU host check failed:',args.join(' '),r.signal||r.status);process.exit(r.status||1);}}
run(['tools/prepare-engine.cjs']);
run(['tools/wasm-gpu-runtime/build.mjs']);
for(const file of ['wasm-gpu-raw-artifact.mjs','wasm-gpu-engine-artifact.mjs','wasm-gpu-runtime.mjs','wasm-gpu-webgpu-bridge.mjs','wasm-gpu-engine.mjs','wasm-gpu-captured-integration.mjs'])run(['--max-old-space-size=256','--test','--test-concurrency=1','tests/'+file]);
