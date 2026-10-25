// Test-only importer of an existing independently captured original controller
// fork. Initial snapshot bytes are inputs; no future state or native stepping.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createSnapshotDecoder} from '../tools/rapier-snapshot-decoder/browser.mjs';
import {importLiveRegisteredFourBall} from '../src/browser-initial-import/live-registered-four-ball.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
let pending;
export function originalRegisteredFixture(){return pending??=load();}
async function load(){
 const bytes=readFileSync(process.env.RESIDENT_ORIGINAL_CAPTURE??'/tmp/browser-live-registered-capture.settled.v8');
 assert.equal(hash(bytes),'11f41cd9c11ff47911f14afc084b27f32a15fc69db1f26d7970eb864f35f2262','independent original registered capture');
 const raw=deserialize(bytes),provenance=JSON.parse(readFileSync(process.env.RAPIER_WASM_PROVENANCE??fileURLToPath(new URL('../../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json',import.meta.url)),'utf8'));
 const engineBytes=new Uint8Array(readFileSync(new URL('../vendor/rapier.cjs',import.meta.url))),wasmBytes=new Uint8Array(readFileSync(provenance.wasmPath));
 assert.equal(hash(engineBytes),provenance.engineSha256);assert.equal(hash(wasmBytes),provenance.wasmSha256);
 const decoder=await createSnapshotDecoder({engineVersion:'0.21.0',engineBytes,wasmBytes,provenance,expectedWasmSha256:provenance.wasmSha256});
 const seed=await importLiveRegisteredFourBall(decoder,raw);
 assert.equal(seed.kind,'original-live-registered-four-ball-created-world');assert.equal(seed.balls.length,4);
 return Object.freeze({seed,raw,decoder,artifactSha256:hash(bytes)});
}
