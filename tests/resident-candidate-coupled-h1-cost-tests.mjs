import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {WORLD_DEVICE_PC as PC} from '../src/resident-candidate/world-device-pc.mjs';
import {assertCoupledH1Initial,originalOwnerReturnPCs,assertFirstCommittedBoundary,COUPLED_H1_INITIAL_SHA256} from './resident-candidate-coupled-h1-cost.mjs';

test('fresh authenticated t0 is required, not any claimed initial envelope',()=>{
 for(const bytes of [Buffer.alloc(0),Buffer.from('resident-tip-impact-created-t0-host-initial-v1')])assert.throws(()=>assertCoupledH1Initial(bytes),/exact authenticated fresh CREATED t0/);
});
test('owner RET attribution never admits another function or a CALL',()=>{
 const instructions=new Uint32Array(5*8);instructions[0]=I.opcodes.RET;instructions[8]=I.opcodes.CALL;instructions[16]=I.opcodes.RET;instructions[24]=I.opcodes.RET;instructions[32]=I.opcodes.RET;
 const compiled={instructions,functions:[{name:'not_an_owner',entryPc:0},{name:'rc_micro_original_owner_13',entryPc:1},{name:'rc_micro_original_owner_13_suffix',entryPc:4}]};
 assert.deepEqual([...originalOwnerReturnPCs(compiled)],[[2,'rc_micro_original_owner_13'],[3,'rc_micro_original_owner_13']]);
 assert.throws(()=>originalOwnerReturnPCs({...compiled,functions:[{name:'other',entryPc:0}]}),/original owner RET/);
});
test('source h counter alone is never a committed first-h boundary',()=>{
 const initial={pc:{controlTailBase:20}},words=new Uint32Array(100),ownerReturns=new Map([[37,'rc_micro_original_owner_13']]);words[5]=1;
 const args={initial,words,lane:0,returnPc:37,ownerReturns};assert.equal(assertFirstCommittedBoundary(args),false);
 words[20+PC.header.completedH]=1;assert.equal(assertFirstCommittedBoundary({...args,lane:1}),false);assert.equal(assertFirstCommittedBoundary({...args,returnPc:38}),false);
 assert.throws(()=>assertFirstCommittedBoundary(args),/192/,'a matching header still must preserve born192 horizon before whole-h idle assertion');
});
const inputPath=process.env.RESIDENT_COUPLED_H1_INITIAL;
test('owned initial decoding cannot mutate the authenticated serialized input',{skip:!inputPath},()=>{
 const bytes=readFileSync(inputPath),frozen=Buffer.from(bytes),initial=assertCoupledH1Initial(bytes);initial.bindings[0][5]=99;initial.compiled.instructions[0]^=1;assert.deepEqual(bytes,frozen);assert.deepEqual(readFileSync(inputPath),frozen);
});
const reportPath=process.env.RESIDENT_COUPLED_H1_REPORT;
test('bounded actual receipt has exact successful step sum and original owner-return boundary',{skip:!reportPath},()=>{
 const r=JSON.parse(readFileSync(reportPath,'utf8'));assert.equal(r.status,'first-h-committed');assert.equal(r.initialSha256,COUPLED_H1_INITIAL_SHA256);assert.equal(r.requestedHUnchanged,192);assert.equal(r.boundary.sourceH,1);assert.equal(r.costs.end[0].pc,r.boundary.targetPc);assert.equal(r.costs.end[1].steps,0);assert.equal(r.costs.successfulInstructions,r.costs.end[0].steps-r.costs.start[0].steps);
 assert.equal(r.costs.functions.reduce((s,x)=>s+x.exclusive,0),r.costs.successfulInstructions);assert.equal(r.costs.opcodes.reduce((s,x)=>s+x.count,0),r.costs.successfulInstructions);
 for(const op of ['LOAD','STORE','LENGTH'])assert.equal(Object.entries(r.costs.sourceMemoryInstructions).filter(([k])=>k.startsWith(op+':')).reduce((s,[,n])=>s+n,0),r.costs.opcodes.find(x=>x.name===op)?.count??0);
 assert.equal(r.costs.functions.find(x=>x.name===r.boundary.owner).fullInvocationReturns,9,'owner13 services nine original phases; only its last return has committedH1');assert.equal(r.queryComplete,false);assert.equal(r.rawInput,false);assert.equal(r.gpuExecuted,false);assert.equal(r.wallSpeedCalibration,false);assert.equal(r.retention.fullStateSnapshots,0);assert.equal(r.nativeBodyWorkExcluded,true);
});
