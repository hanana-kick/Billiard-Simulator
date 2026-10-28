import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deserialize,serialize} from 'node:v8';
import {join} from 'node:path';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {createSegmentCostObserver,assertSegmentInput,profileSavedTipImpactSegment,decodeOwnedSegmentContinuation} from './resident-candidate-tip-impact-segment-cost.mjs';
const code='fn leaf(x:u32)->u32 { return x+1u; } fn middle(x:u32)->u32 { return leaf(x)+leaf(x+1u); } fn main(){let a=middle(7u); let b=middle(a);}',compiled=compileMicrocodeWGSL(code,{entry:'main'}),configuration={count:1,localWords:compiled.localWords,stackCapacity:compiled.callDepth,entryPc:compiled.entryPc},make=(options={})=>createMicrocodeVmReferenceForTest({testOnly:true,...configuration,code:compiled.instructions,...options});
function retained(){const vm=make();vm.begin();const entry=compiled.functions.find(f=>f.name==='leaf').entryPc;for(let i=0;vm.state[I.control.pc]!==entry&&i<1000;i++)vm.advance(0,1);assert.equal(vm.state[I.control.pc],entry);assert.equal(vm.state[I.control.sp],3);vm.advance(0,1);return vm;}
test('fixed segment aggregates exactly match steps; pre-existing frames are partial, new calls are complete',()=>{
 const saved=retained(),state=saved.state.slice(),plain=make({state:saved.state.slice()}),observer=createSegmentCostObserver({compiled,configuration,state}),vm=make({state,...observer});let pumps=0;
 while(vm.state[I.control.status]===I.status.ready){vm.advance(0,3);plain.advance(0,3);assert.deepEqual(vm.state,plain.state,'diagnostics never change execution');assert.deepEqual(vm.bindings,plain.bindings);assert.ok(++pumps<1000);}
 const report=observer.finish();assert.equal(report.start[0].sp,3);assert.deepEqual(report.start[0].activeFunctions,['$module','main','middle','leaf']);assert.equal(report.end[0].sp,0);assert.equal(report.end[0].status,I.status.complete);assert.equal(report.successfulInstructions,vm.state[I.control.stepsLow]-saved.state[I.control.stepsLow]);assert.equal(report.functions.reduce((n,x)=>n+x.exclusive,0),report.successfulInstructions);assert.equal(report.opcodes.reduce((n,x)=>n+x.count,0),report.successfulInstructions);assert.ok(report.functions.find(x=>x.name==='leaf').fullInvocationReturns>0);assert.equal(report.functions.find(x=>x.name==='leaf').boundaryPartialReturns,1);assert.equal(report.functions.find(x=>x.name==='middle').boundaryPartialReturns,1);assert.equal(report.functions.find(x=>x.name==='main').fullInvocationReturns,0);assert.equal(report.retention.fullTrace,false);assert.equal(report.retention.fullStatePerCall,false);assert.throws(()=>observer.finish(),/false/);
});
test('incomplete diagnostic window credits live frames only as boundary partial, not full invocation',()=>{
 const saved=retained(),state=saved.state.slice(),observer=createSegmentCostObserver({compiled,configuration,state}),vm=make({state,...observer});vm.advance(0,1);const r=observer.finish();assert.equal(r.successfulInstructions,1);assert.equal(r.end[0].status,I.status.ready);assert.equal(r.functions.reduce((n,x)=>n+x.fullInvocationReturns,0),0);for(const name of['$module','main','middle','leaf'])assert.equal(r.functions.find(x=>x.name===name).boundaryPartialInclusive,1);
});
test('malformed saved source CALL chain is rejected instead of guessing inclusive attribution',()=>{
 const saved=retained(),state=saved.state.slice();state[saved.layout.stackOffset]=0;assert.throws(()=>createSegmentCostObserver({compiled,configuration,state}));const wrong=saved.state.slice();wrong[saved.layout.stackOffset]=compiled.functions.find(f=>f.name==='leaf').entryPc+1;assert.throws(()=>createSegmentCostObserver({compiled,configuration,state:wrong}),/exact source CALL/);
});
test('already completed lane contributes no invented segment work',()=>{
 const saved=make();saved.begin();while(saved.advance(0,3)===I.status.ready){}const observer=createSegmentCostObserver({compiled,configuration,state:saved.state});const r=observer.finish();assert.equal(r.successfulInstructions,0);assert.deepEqual(r.functions,[]);assert.deepEqual(r.start[0].activeFunctions,[]);
});
const dir=process.env.RESIDENT_SEGMENT_ARTIFACT_DIR;
test('immutable final192 bank cannot satisfy the actual saved191 receipt',{skip:!dir},()=>{
 const initialBytes=readFileSync(join(dir,'initial.v8')),continuationBytes=readFileSync(join(dir,'continuation.v8')),receipt=JSON.parse(readFileSync(join(dir,'bounded191-result.json'),'utf8'));
 assert.throws(()=>assertSegmentInput({initial:deserialize(initialBytes),continuation:deserialize(continuationBytes),receipt,initialBytes,continuationBytes}),/exact saved HOST continuation receipt/);
});

test('CLI path normalization reaches missing-file admission without Array.map callback arguments',()=>{const p='/tmp/no-such-owned-resident-segment-file';assert.throws(()=>profileSavedTipImpactSegment({initialPath:p+'1',continuationPath:p+'2',receiptPath:p+'3',expectedPath:p+'4',finalPath:p+'5',outPath:p+'6'}),{code:'ENOENT'});});

test('evolving decoded VM/source arrays cannot change immutable serialized checkpoint bytes',()=>{const input=serialize({vmState:Uint32Array.of(17,23),bindings:[Uint32Array.of(31,41)]}),frozen=Buffer.from(input),owned=decodeOwnedSegmentContinuation(input);owned.vmState[0]=99;owned.bindings[0][1]=101;assert.deepEqual(input,frozen);assert.equal(deserialize(input).vmState[0],17);assert.equal(deserialize(input).bindings[0][1],41);});
