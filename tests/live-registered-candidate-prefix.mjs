// Original engine runs only in a producer subprocess. Numerical candidate sees
// strict imported initial bytes only; reference frames are assertion-only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import v8 from 'node:v8';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {prepareValidation,compareFrame,compareCheckpoint,noNative} from './live-registered-performance-support.mjs';
import {createSnapshotDecoder} from '../tools/rapier-snapshot-decoder/browser.mjs';
import {importLiveRegisteredFourBall} from '../src/browser-initial-import/live-registered-four-ball.mjs';
const require=createRequire(import.meta.url),ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const World=require('../src/experimental-four-ball-world.js');
test('two exact proposed settings from one live settled source import and continue on numerical CPU owner',async t=>{
 noNative();const dir=fs.mkdtempSync(path.join(os.tmpdir(),'candidate-prefix-'));
 try{
  const file=path.join(dir,'original.v8');execFileSync(process.execPath,[path.join(ROOT,'tests/live-registered-candidate-prefix-producer.cjs'),file],{timeout:30000});
  const records=v8.deserialize(fs.readFileSync(file));assert.equal(records.length,2);assert.deepEqual(records[0].raw.preStrikeSnapshot,records[1].raw.preStrikeSnapshot);
  await prepareValidation(ROOT,dir);
  const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(ROOT,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
  const decoder=await createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(ROOT,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
  for(const {raw,candidate,record,provenance:receipt}of records){
   let owner;try{
    const seed=await importLiveRegisteredFourBall(decoder,raw);
    assert.deepEqual(seed.sourceOrigin.settings,candidate.settings);assert.notEqual(seed.sourceOrigin.settings.speed,receipt.sourceApplication.controller.settings.speed);
    owner=await World.createReferenceStepper(seed);assert.equal(owner.capability.liveRegisteredFourBall,true);
    const stats={internalPasses:0,maxAbsolute:0,maxCueInertiaAbsolute:0,maxCueInertiaNormalized:0,checkpoints:[]};
    for(const frame of record.frames.slice(0,record.prefixH)){
     const out=await owner.step();stats.internalPasses+=out.lastStep.ccd?.sourceInternalPasses.length??1;
     assert.equal(out.contactGraph.sequence,stats.internalPasses);
     compareFrame(out,frame,seed,record,stats);
     for(const point of record.checkpoints.filter(p=>p.hCount===out.frame))await compareCheckpoint(out,point,frame,seed,record,stats);
    }
    assert.equal(stats.checkpoints.length,3);assert.equal(owner.snapshot().frame,record.prefixH);assert.equal(owner.snapshot().outerStep,Math.floor(record.prefixH/64));assert.equal(owner.snapshot().outerSubstep,record.prefixH%64);
    assert.ok(owner.snapshot().balls.some(b=>b.state.linear.some(v=>v!==0)),'Prefix crosses actual cue impact and sphere wake/motion');
    t.diagnostic(JSON.stringify({speed:candidate.settings.speed,threeCushion:candidate.rules.fourBallThreeCushion,scope:'first-sphere-motion-plus-8-h-not-full-shot',firstMovingH:record.firstMovingH,prefixH:record.prefixH,...stats}));
   }finally{owner?.dispose();}
  }
  noNative();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
