// Read-only source/expected-oracle utilities for integration. Never exports seeds.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {unpack} from './browser-initial-import-evidence.mjs';
import {createSnapshotDecoder} from '../tools/rapier-snapshot-decoder/browser.mjs';
const require=createRequire(import.meta.url),ROOT=path.resolve(import.meta.dirname,'..');
export const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export async function loadLiveInput() {
  assert.ok(process.env.LIVE_FOUR_BALL_INPUT,'Set LIVE_FOUR_BALL_INPUT to the fresh collector download');
  const bytes=fs.readFileSync(process.env.LIVE_FOUR_BALL_INPUT),live=unpack(JSON.parse(bytes));
  assert.equal(live.schema,'live-original-four-ball-initial-capture-v1');
  assert.equal(live.observed.status,'PASS');assert.equal(live.observed.noArchivedSnapshotOrSeedInput,true);
  assert.equal(live.observed.nativeStepsPerLiveInstance,72);assert.equal(live.observed.applicationPhysicsSteps,0);
  assert.equal(hash(live.snapshot),live.observed.snapshotSha256);
  for(const [file,want]of Object.entries(live.observed.sources))assert.equal(hash(fs.readFileSync(path.join(ROOT,file))),want,'Live source identity '+file);
  const p=live.decoderProvenance;
  const decoder=await createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(ROOT,'vendor/rapier.cjs'))),
    wasmBytes:new Uint8Array(fs.readFileSync(process.env.RAPIER_DECODER_WASM??p.wasmPath)),provenance:p,expectedWasmSha256:p.wasmSha256});
  return {input:{snapshot:live.snapshot,capture:live.capture},decoder,source:live.observed,
    liveArtifactSha256:hash(bytes)};
}
export function loadExpectedOracle() {
  // The unchanged loader verifies complete manifest identity and bytes. Its
  // original simulation capture function is NEVER called by this harness.
  const O=require('./four-ball-world-oracle.cjs');
  return O.loadArtifact(process.env.FOUR_BALL_FULL_REPLAY,
    process.env.FOUR_BALL_CREATION_V8??'/tmp/billiard-original-four-ball-created-canonical-v1.v8');
}
export function forbidNativeContinuation() {
  const F=require('./four-ball-created-fixture.cjs'),restore=[];
  const fail=()=>{throw new Error('Native init/step/restore prohibited after live initial capture');};
  for(const [owner,key]of [[F.R,'init'],[F.R.World,'restoreSnapshot'],[F.R.World.prototype,'step'],
    [globalThis.PhysicsLab.prototype,'step'],[globalThis.PhysicsLab.prototype,'restore']]) {
    if(typeof owner?.[key] !== 'function')continue;
    restore.push([owner,key,owner[key]]);owner[key]=fail;
  }
  return ()=>{for(const [owner,key,fn]of restore)owner[key]=fn;};
}
