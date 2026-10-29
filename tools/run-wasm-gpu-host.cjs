'use strict';
// Explicit opt-in host qualification. Builds real WASM; never requests a GPU.
// Keep large source-capture checks sequential and cap V8 heap growth.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,env:process.env,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0){console.error('WASM GPU host check failed:',args.join(' '),r.signal||r.status);process.exit(r.status||1);}}
run(['tools/prepare-engine.cjs']);
run(['tools/wasm-gpu-runtime/build.mjs']);
const suites=[
  "canonical-page-preparation.mjs",
  "wasm-gpu-raw-artifact.mjs",
  "wasm-gpu-engine-artifact.mjs",
  "wasm-gpu-runtime.mjs",
  "wasm-gpu-webgpu-bridge.mjs",
  "wasm-gpu-engine.mjs",
  "wasm-gpu-captured-integration.mjs",
  "canonical-owned-upload-snapshots.mjs",
  "deterministic-prepared-world-inputs.mjs",
  "deterministic-cushion-resolver-v2-inputs.mjs",
  "wasm-gpu-world-inputs.mjs",
  "selected-source-readback-helpers.mjs",
  "wasm-gpu-selected-artifact.mjs",
  "wasm-gpu-selected-inputs.mjs",
  "wasm-gpu-selected-webgpu-bridge.mjs",
  "wasm-gpu-selected-engine.mjs",
  "wasm-gpu-selected-session-backend.mjs",
  "wasm-gpu-compact-search-backend.mjs",
  "wasm-gpu-device-coordinator.mjs",
  "wasm-gpu-production-runtime.mjs",
  "wasm-gpu-program-assets-builder.mjs",
  "wasm-gpu-program-library.mjs",
  "wasm-gpu-program-assets-verified.mjs",
  "wasm-gpu-controller-program-assets.mjs"
];
for(const file of suites)run(['--max-old-space-size=256','--test','--test-concurrency=1','tests/'+file]);
