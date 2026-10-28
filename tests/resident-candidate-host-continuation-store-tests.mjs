import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {serialize,deserialize} from 'node:v8';
import {MICROCODE_ISA as I,microcodeInstruction} from '../src/resident-candidate/microcode-isa.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {saveHostContinuation} from './resident-candidate-host-continuation-store.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),scope=fn=>{const dir=mkdtempSync(join(tmpdir(),'resident-owned-continuation-'));try{return fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}},bytes=x=>serialize({kind:'test-only-retention-fixture',vmState:Uint32Array.of(x,17,23),bindings:[Uint32Array.of(x+1)]});
test('first save and resumed replacement preserve exact immutable bytes/hash for both generations',()=>scope(dir=>{
 const first=bytes(1),next=bytes(2),a=saveHostContinuation({dir,bytes:first}),b=saveHostContinuation({dir,bytes:next,expectedPreviousSha256:a.sha256});assert.equal(a.sha256,sha(first));assert.equal(b.previousSha256,a.sha256);assert.deepEqual(readFileSync(a.archivePath),first);assert.deepEqual(readFileSync(b.archivePath),next);assert.deepEqual(readFileSync(join(dir,'continuation.v8')),next);assert.deepEqual(deserialize(readFileSync(a.archivePath)),deserialize(first));assert.equal(b.retainedCount,2);assert.equal(b.sourceEvolution,false);
}));
test('pre-retention predecessor is archived exactly before successor replacement',()=>scope(dir=>{
 const old=bytes(3),next=bytes(4);writeFileSync(join(dir,'continuation.v8'),old);const r=saveHostContinuation({dir,bytes:next,expectedPreviousSha256:sha(old)});assert.deepEqual(readFileSync(r.previousArchivePath),old);assert.deepEqual(readFileSync(r.archivePath),next);
}));
test('receipt mismatch and corrupted archive reject before pointer replacement',()=>scope(dir=>{
 const old=bytes(5),next=bytes(6),a=saveHostContinuation({dir,bytes:old});assert.throws(()=>saveHostContinuation({dir,bytes:next,expectedPreviousSha256:'0'.repeat(64)}),/exact predecessor receipt/);assert.deepEqual(readFileSync(join(dir,'continuation.v8')),old);writeFileSync(a.archivePath,bytes(99));assert.throws(()=>saveHostContinuation({dir,bytes:next,expectedPreviousSha256:a.sha256}),/archive hash mismatch/);assert.deepEqual(readFileSync(join(dir,'continuation.v8')),old);assert.equal(readdirSync(join(dir,'host-continuations')).length,1);
}));
test('bounded capacity never silently deletes predecessors or partially replaces pointer',()=>scope(dir=>{
 const old=bytes(7),a=saveHostContinuation({dir,bytes:old,capacity:1});assert.throws(()=>saveHostContinuation({dir,bytes:bytes(8),expectedPreviousSha256:a.sha256,capacity:1}),/capacity exhausted/);assert.deepEqual(readFileSync(join(dir,'continuation.v8')),old);assert.deepEqual(readFileSync(a.archivePath),old);assert.equal(readdirSync(join(dir,'host-continuations')).length,1);const unchanged=saveHostContinuation({dir,bytes:old,expectedPreviousSha256:a.sha256,capacity:1});assert.equal(unchanged.retainedCount,1);
}));
test('missing predecessor and invalid retention contract reject without creating a pointer',()=>scope(dir=>{
 assert.throws(()=>saveHostContinuation({dir,bytes:bytes(1),expectedPreviousSha256:'0'.repeat(64)}),/missing predecessor/);for(const capacity of[0,65,1.5])assert.throws(()=>saveHostContinuation({dir,bytes:bytes(1),capacity}),/bounded diagnostic retention/);assert.deepEqual(readdirSync(dir),[]);
}));

test('resuming exact archived VM bytes leaves uninterrupted transport and predecessor unchanged',()=>scope(dir=>{
 const code=Uint32Array.from([microcodeInstruction('SET',0,41),microcodeInstruction('UADD',0,0,0),microcodeInstruction('HALT')].flatMap(x=>Array.from(x))),options={testOnly:true,code,count:1,localWords:1,stackCapacity:1,entryPc:0},first=createMicrocodeVmReferenceForTest(options),plain=createMicrocodeVmReferenceForTest(options);first.begin();plain.begin();first.advance(0,1);plain.advance(0,1);const saved=serialize({vmState:first.state}),a=saveHostContinuation({dir,bytes:saved}),next=createMicrocodeVmReferenceForTest({...options,state:deserialize(readFileSync(a.archivePath)).vmState});next.advance(0,8);plain.advance(0,8);assert.equal(next.state[I.control.status],I.status.complete);assert.deepEqual(next.state,plain.state);assert.equal(next.local(0,0),82);const b=saveHostContinuation({dir,bytes:serialize({vmState:next.state}),expectedPreviousSha256:a.sha256});assert.deepEqual(readFileSync(a.archivePath),saved);assert.equal(sha(readFileSync(b.previousArchivePath)),a.sha256);
}));
