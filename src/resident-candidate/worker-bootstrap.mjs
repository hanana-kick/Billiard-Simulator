/* SPDX-License-Identifier: Apache-2.0
 * Same-origin bundled original runtime/decoder. Startup never requests a device.
 */
import {loadResidentBrowserRuntime} from './browser-runtime-entry.mjs';
import {createHash} from './source-sha256.mjs';
import {RESIDENT_WORKER_PROTOCOL,RESIDENT_WORKER_CAPABILITY,need} from './worker-protocol.mjs';
import {createResidentWorkerBackend} from './worker-retained-backend.mjs';
const get=async(name,json=false)=>{const r=await fetch(new URL(name,import.meta.url),{credentials:'same-origin'});need(r.ok,'bundled asset '+name+' HTTP '+r.status);return json?r.json():new Uint8Array(await r.arrayBuffer());};
export async function initializeResidentWorker({expectedSourceVersion}){
 const manifest=await get('../../gpu-worker-build-manifest.json',true),profile=manifest.residentRuntime;
 need(manifest.activation===false&&profile?.activation===false&&profile.protocol===RESIDENT_WORKER_PROTOCOL,'optional inactive resident package');
 const actual=createHash('sha256').update(JSON.stringify({schema:'resident-worker-package-v1',files:manifest.files})).digest('hex');
 need(profile.sourceVersion===actual&&expectedSourceVersion===actual,'source version mismatch');
 const runtime=await loadResidentBrowserRuntime(),build=await get('../bounded-gpu-shot/four-ball-worker-assets.json',true);need(build.schema==='bounded-four-ball-worker-assets-v1','bundled decoder provenance');
 const decoder=await runtime.createSnapshotDecoder({engineVersion:'0.21.0',provenance:build.provenance,expectedWasmSha256:build.expectedWasmSha256,engineBytes:await get('../bounded-gpu-shot/four-ball-worker-engine.bin'),wasmBytes:await get('../bounded-gpu-shot/four-ball-worker-decoder.wasm')});
 return createResidentWorkerBackend({runtime,decoder,sourceVersion:actual,capability:RESIDENT_WORKER_CAPABILITY});
}
