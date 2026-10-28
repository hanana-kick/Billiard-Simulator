// HOST allocation arithmetic only. No GPU, shader, or trajectory execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planResidentMicrocodeAllocation as plan,snapshotMicrocodeDeviceLimits} from '../src/resident-candidate/microcode-resources.mjs';
const {shape,limits}=JSON.parse(readFileSync(new URL('./fixtures/resident-microcode-resource-shape.json',import.meta.url)));
test('1024-row compatibility means two complete resident512-row banks, no diagnostics or hidden scratch sum',()=>{
 const p=plan(shape,1024,{limits});assert.equal(p.fits,true);assert.deepEqual(p.banks.map(b=>[b.first,b.count]),[[0,512],[512,512]]);
 assert.deepEqual(p.bytes,{commonReadonly:419348,bankReadonly:15625536,residentMutable:346226624,retainedInitialization:8232960,rawInput:65536,compactOutput:16384,compactReadback:16384,diagnostics:0,peakLive:370602772,budget:536870912});
 assert.equal(p.allocations.length,20);assert.ok(p.allocations.filter(a=>a.storage).every(a=>a.bytes<=134217728));
 for(const b of p.banks){assert.equal(b.resources.worldState.bytes,129191904);assert.equal(b.resources.vmState.bytes,16003072);assert.equal(b.resources.scratch.bytes,27918336);assert.equal(b.resources.rawState.bytes,4116480);assert.deepEqual(b.aliases,{rawScratch:'scratch',numericScratch:'scratch'});assert.equal(b.worldLayout.controlBaseWords,512*62976+1016);assert.equal(b.worldLayout.requestBaseWords,b.worldLayout.controlBaseWords+512*80);assert.equal(b.resources.worldState.words,b.worldLayout.requestBaseWords+512*24);assert.equal(b.resources.worldState.usage&4,0,'full state is not copy-source in compact mode');}
 assert.equal(p.bytes.peakLive,p.allocations.reduce((sum,a)=>sum+a.bytes,0));assert.equal(p.sourceRowsAdmitted,false);assert.equal(p.physicalProducerAvailable,false);assert.equal(p.numericallyQualified,false);assert.equal(p.hardwareMeasured,false);assert.equal(p.memoryAvailabilityChecked,false);assert.ok(Object.isFrozen(p.banks[0].resources.worldState));
});
test('last bank preserves exact total count; smaller device limits fail rather than silently reducing rows',()=>{
 const p=plan(shape,1025,{limits});assert.deepEqual(p.banks.map(b=>[b.first,b.count]),[[0,512],[512,512],[1024,1]]);assert.equal(p.count,1025);
 const small=plan(shape,1024,{limits:{...limits,maxStorageBufferBindingSize:64*1024*1024}});assert.equal(small.fits,false);assert.deepEqual(small.banks.map(b=>b.count),[512,512]);assert.ok(small.violations.some(v=>v.resource==='worldState'));
 const budget=plan(shape,1024,{limits,maxLiveBytes:370602771});assert.equal(budget.fits,false);assert.deepEqual(budget.violations.at(-1),{resource:'peakLiveBytes',required:370602772,limit:370602771});assert.equal(plan(shape,4096,{limits}).fits,false,'large totals need an explicit larger peak-live budget');
});
test('larger single bank needs an explicit device policy and sufficient declared limits; no adapter inference',()=>{
 assert.throws(()=>plan(shape,1024,{limits,bankRows:1024}),/compatibility banks/);
 assert.equal(plan(shape,1024,{limits,bankRows:1024,bindingPolicy:'queried-device'}).fits,false);
 const actual={...limits,maxStorageBufferBindingSize:268435456},p=plan(shape,1024,{limits:actual,bankRows:1024,bindingPolicy:'queried-device'});assert.equal(p.fits,true);assert.equal(p.banks.length,1);assert.equal(p.banks[0].resources.worldState.bytes,258379744);assert.equal(p.limitsSource,'caller-declared','arithmetic alone does not query a device');
 const device={limits:{...actual,extra:123}};assert.deepEqual(snapshotMicrocodeDeviceLimits(device),actual);for(const key of Object.keys(actual)){const bad={...actual};delete bad[key];assert.throws(()=>snapshotMicrocodeDeviceLimits({limits:bad}));}
 for(const bad of[{count:0},{count:4097},{bankRows:0},{bankRows:4097},{bindingPolicy:'adapter'},{maxLiveBytes:0},{maxLiveBytes:2**32}])assert.throws(()=>plan(shape,bad.count??1024,{limits,...bad}));
});
