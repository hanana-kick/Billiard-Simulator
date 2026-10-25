import test from 'node:test';import assert from 'node:assert/strict';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {packCreatedWorldTemplate,planResidentBanks,packWorldCloneTemplate,generateWorldCloneWGSL} from '../src/resident-candidate/world-state.mjs';
import {CCD_LAYOUT} from '../src/resident-candidate/ccd.mjs';
let pending;const fixture=()=>pending??=(async()=>{const{seed}=await originalRegisteredFixture();return packCreatedWorldTemplate(seed,{rule:{firstId:3,secondId:4,method:'none',allowKiss:true,maxOuterSteps:12000}});})();
test('common source bank preserves disjoint aligned owners and closes all absolute initial pointers',async()=>{
 const t=await fixture(),parts=Object.values(t.segments);assert.equal(t.state.length%64,0);for(let i=0;i<parts.length;i++){assert.equal(parts[i].offset%64,0);if(i)assert.ok(parts[i-1].offset+parts[i-1].words<=parts[i].offset);}
 assert.equal(t.segments.ccd.words,CCD_LAYOUT.words);assert.equal(t.segments.bodies.words,6*64);assert.equal(t.state[t.segments.bvh.offset+20],t.segments.bvhScratch.offset);
 const source=packWorldCloneTemplate(t);assert.deepEqual(source.slice(0,t.state.length),t.state);for(const pointer of t.relocations)assert.ok(t.state[pointer]<t.state.length);
 for(const base of[0,t.state.length,t.state.length*598])for(const pointer of t.relocations)assert.ok(t.state[pointer]+base>=base&&t.state[pointer]+base<base+t.state.length);
 assert.equal(t.capability.completeH,false);assert.equal(t.capability.rawCreationAdmitted,false);assert.equal(t.capability.hostForwardFallback,false);assert.equal(t.capability.defaultBackend,false);assert.ok(t.unfinishedOwners.includes('whole-h-stage-composition'));
 assert.match(generateWorldCloneWGSL(t),/candidateId/);assert.doesNotMatch(generateWorldCloneWGSL(t),/step\(|forward|mapAsync/);
});
test('1024 bank plan uses exact serialized bytes and honest device binding tiles, not a measured speed claim',async()=>{
 const t=await fixture(),p=planResidentBanks(t,1024,{maxStorageBufferBindingSize:128*1024*1024,maxBufferSize:256*1024*1024});assert.equal(p.persistentAndTransientBankBytes,t.state.byteLength*1024);assert.equal(p.stateBytesPerCandidate,t.state.byteLength);assert.equal(p.hardwareMeasured,false);assert.equal(p.estimated,true);assert.equal(p.tiles.reduce((n,t)=>n+t.count,0),1024);
 for(const tile of p.tiles){assert.ok(tile.count*t.state.byteLength<=128*1024*1024);assert.ok(tile.count*t.numericScratchWords*4<=128*1024*1024);}
 assert.throws(()=>planResidentBanks(t,4097,{maxStorageBufferBindingSize:1e9,maxBufferSize:1e9}),/batch/);assert.throws(()=>planResidentBanks(t,1,{maxStorageBufferBindingSize:64,maxBufferSize:64}),/One exact candidate/);assert.throws(()=>planResidentBanks(t,1024),/limits/);
});
test('query must name actual distinct reds and an explicit finite horizon',async()=>{
 const{seed}=await originalRegisteredFixture();await assert.rejects(packCreatedWorldTemplate(seed),/rule\/horizon/);await assert.rejects(packCreatedWorldTemplate(seed,{rule:{firstId:1,secondId:4,maxOuterSteps:1}}),/actual distinct red/);
});
