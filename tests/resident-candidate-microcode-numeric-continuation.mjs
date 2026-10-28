import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileGraph} from '../src/resident-candidate/numeric-program.mjs';
import {parseMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';
import {generateMicrocodeNumericContinuationWGSL,microcodeNumericContinuationDescriptor,assertMicrocodeNumericContinuationDescriptor,MICROCODE_NUMERIC_CONTINUATION as N,microcodeNumericSourcePartsForTest} from '../src/resident-candidate/microcode-numeric-continuation.mjs';
import {createMicrocodeNumericContinuationReferenceForTest as reference,executeOriginalNumericSourceForTest as original} from './resident-candidate-microcode-numeric-continuation-reference.mjs';
const L={candidateCount:2,vmStride:80,tailOffset:64},dirty=0x31415926,sha=x=>createHash('sha256').update(x).digest('hex');
const bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
const normal={inputFloats:2,nodes:[{kind:'add',args:[0,1]},{kind:'mul',args:[2,1]}],outputs:[3,0,3]};
function fixture(plan=normal,input=[bits(1),bits(2)]){
 const c=compileGraph(plan),pb=3,sb=5,program=new Uint32Array(pb+c.program.length+4).fill(dirty),scratch=new Uint32Array(sb+c.scratchWords+5).fill(dirty),vmState=new Uint32Array(L.candidateCount*L.vmStride).fill(dirty);
 program.set(c.program,pb);scratch.set(input,sb);for(let lane=0;lane<2;lane++){const t=lane*L.vmStride+L.tailOffset;vmState.fill(0,t,t+14);vmState[t+14]=0xfffffff0;vmState[t+15]=17;}
 return{c,pb,sb,program,scratch,vmState};
}
const ref=f=>reference({testOnly:true,...L,...f});
function differential(f,{budgets=[1,3,2,7],lane=0}={}){
 const initialScratch=f.scratch.slice(),expected=f.scratch.slice(),status=original({testOnly:true,program:f.program,scratch:expected,programBase:f.pb,scratchBase:f.sb}),before=f.vmState.slice(),sourceProgram=f.program.slice(),base=lane*L.vmStride,t=base+L.tailOffset;
 let model=ref(f);assert.equal(model.start(base,f.pb,f.sb,19,27),0);assert.deepEqual(f.scratch,initialScratch);
 let actual=0,calls=0,pumps=0;
 while(actual===0){const budget=budgets[pumps++%budgets.length];for(let i=0;i<budget&&actual===0;i++){actual=model.step(base);assert.ok(++calls<10000,'bounded HOST graph fixture');}
  // A fresh adapter has only original backing words; no retained hidden cursor.
  model=ref(f);
 }
 assert.equal(actual,status);assert.deepEqual(f.scratch,expected,'every dirty source scratch word');assert.deepEqual(f.program,sourceProgram,'immutable program');
 for(let i=0;i<before.length;i++)if(i<t||i>=t+14)assert.equal(f.vmState[i],before[i],'only candidate-owned helper tail writes '+i);
 const terminal=f.vmState.slice(),terminalScratch=f.scratch.slice();assert.equal(model.step(base),status);assert.deepEqual(f.vmState,terminal);assert.deepEqual(f.scratch,terminalScratch);
 assert.equal(model.clear(base),0);assert.deepEqual(f.vmState,before,'tail release restores all words and preserves counters');return{status,calls,pumps};
}
const check=differential;

test('source-derived descriptor pins exact node/header/check closures; no graph/check traversal loops',()=>{
 const source=generateMicrocodeNumericContinuationWGSL(L),p=microcodeNumericSourcePartsForTest({testOnly:true}),descriptor=microcodeNumericContinuationDescriptor(L),ast=parseMicrocodeWGSL(source);
 assert.equal(descriptor.generatedSha256,sha(source));assert.equal(descriptor.sourceApproval.name,'rc_num_eval');assert.deepEqual(assertMicrocodeNumericContinuationDescriptor(descriptor,L),descriptor);
 assert.ok(source.includes(p.node));assert.ok(source.includes(p.header));assert.ok(source.includes(p.input));assert.ok(source.includes(p.output));
 assert.doesNotMatch(source,/\brc_state\b|fn rc_num_eval\(/);for(const f of ast.functions.filter(x=>x.name.startsWith('rc_vm_num_'))){const walk=x=>{if(!x||typeof x!=='object')return;assert.ok(!['for','while','loop'].includes(x.kind),'no traversal loop '+f.name);for(const v of Object.values(x))if(Array.isArray(v))v.forEach(walk);else walk(v);};walk(f.body);}
 for(const changed of[{...descriptor,generatedSha256:'0'.repeat(64)},{...descriptor,parts:{...descriptor.parts,node:'0'.repeat(64)}},{...descriptor,layout:{...descriptor.layout,tailOffset:63}}])assert.throws(()=>assertMicrocodeNumericContinuationDescriptor(changed,L),/descriptor/);
 for(const bad of[{...L,tailOffset:63},{...L,candidateCount:0},{...L,vmStride:2**32},{...L,candidateCount:2**30}])assert.throws(()=>generateMicrocodeNumericContinuationWGSL(bad));
 assert.equal(N.capability.nativeQualified,false);
});
test('full original graph differential: zero-node, duplicate/input outputs, signed zero, subnormal, arbitrary yields',()=>{
 const plans=[normal,{inputFloats:1,nodes:[],outputs:[0,0]},{inputFloats:2,nodes:[{kind:'min',args:[0,1]},{kind:'max',args:[0,1]}],outputs:[2,3,0]}];
 for(const plan of plans)for(const input of[[bits(1),bits(2)],[0x80000000,0],[1,0],[0x007fffff,0x00800000]])for(const budgets of[[1],[2],[3,1,7]])check(fixture(plan,input.slice(0,plan.inputFloats)),{budgets});
});
test('original malformed headers preserve dirty scratch, including the prior status word',()=>{
 for(const mutate of[
  f=>{f.pb=f.program.length-11;},f=>{f.pb=0xffffffff;},f=>{f.sb=f.scratch.length;},f=>{f.sb=0xffffffff;},
  ...[0,1,2,3,4,5,6,7,8,9,10,11].map(i=>f=>{f.program[f.pb+i]=0xffffffff;}),
  f=>{f.program[f.pb+3]=0;},f=>{f.program[f.pb+4]=0;},f=>{f.program[f.pb+5]=1;},
 ]){const f=fixture();mutate(f);const before=f.scratch.slice();assert.equal(check(f).status,2);assert.deepEqual(f.scratch,before);}
});
test('nonfinite inputs, failed nodes/domains and final output failures retain exact partial writes',()=>{
 for(const v of[0x7f800000,0xff800000,0x7fc01234])for(const input of[[v,bits(2)],[bits(2),v]])assert.equal(check(fixture(normal,input)).status,3);
 for(const denominator of[0,0x80000000])assert.equal(check(fixture({inputFloats:2,nodes:[{kind:'add',args:[0,0]},{kind:'div',args:[2,1]}],outputs:[3]},[bits(1),denominator])).status,4);
 assert.equal(check(fixture({inputFloats:1,nodes:[{kind:'sqrt',args:[0]}],outputs:[1]},[bits(-1)])).status,4);
 assert.equal(check(fixture({inputFloats:2,nodes:[{kind:'mul',args:[0,1]}],outputs:[2]},[0x7f7fffff,bits(2)])).status,3);
 for(const mutate of[
  f=>{f.program[f.pb+12+5]=99;},f=>{f.program[f.pb+12+6]=99;},f=>{f.program[f.pb+12+7]=99;},
  f=>{f.program[f.pb+f.c.program[8]]=99;},f=>{f.program[f.pb+12]=0;f.program[f.pb+14]=0x7fc00001;},
 ]){const f=fixture();mutate(f);assert.ok([2,3].includes(check(f).status));}
});
test('all original opcodes, eager operand validation and initialized-register completion',()=>{
 const names=['const','add','sub','mul','div','min','max','sqrt','inv','cap','choose','lt','le','gt','signbitSign','negate'];
 for(const [op,kind]of names.entries()){
  const arity=op===0?0:[7,8,14,15].includes(op)?1:op===10?3:2,node=op===0?{kind,args:[-0]}:{kind,args:Array.from({length:arity},(_,i)=>i)};
  const f=fixture({inputFloats:3,nodes:[node],outputs:[3,0,3]},[bits(4),bits(2),0x80000000]);check(f);
 }
 const f=fixture({inputFloats:3,nodes:[{kind:'choose',args:[0,1,2]}],outputs:[3]},[0,bits(1),bits(2)]);f.program[f.pb+14]=99;assert.equal(check(f).status,2,'even eager choose condition operand checked');
 const incomplete=fixture({inputFloats:1,nodes:[{kind:'add',args:[0,0]}],outputs:[0]},[bits(1)]);incomplete.program[incomplete.pb+5]=2;incomplete.program[incomplete.pb+10]=2;incomplete.program[incomplete.pb+13]=0;assert.equal(check(incomplete).status,2,'all assigned registers required before outputs');
});
test('invalid tail/base cannot modify source scratch or another candidate; counters remain VM-owned',()=>{
 for(const base of[1,79,160,0xffffffff]){const f=fixture(),m=ref(f),before=f.vmState.slice(),scratch=f.scratch.slice();assert.equal(m.start(base,f.pb,f.sb,1,2),5);assert.equal(m.step(base),5);assert.equal(m.clear(base),5);assert.deepEqual(f.vmState,before);assert.deepEqual(f.scratch,scratch);}
 for(const field of[0,1,2,13]){const f=fixture();f.vmState[L.tailOffset+field]=7;const m=ref(f),before=f.vmState.slice();assert.equal(m.start(0,f.pb,f.sb,1,2),5);assert.deepEqual(f.vmState,before);}
 const f=fixture(),m=ref(f);assert.equal(m.start(0,f.pb,f.sb,1,2),0);const before=f.vmState.slice(),scratch=f.scratch.slice();assert.equal(m.start(0,f.pb,f.sb,1,2),5);assert.equal(m.clear(0),5);assert.deepEqual(f.vmState,before);assert.deepEqual(f.scratch,scratch);
 check(fixture(),{lane:1});
 const short=fixture();short.vmState=short.vmState.slice(0,-1);const r=ref(short),b=short.vmState.slice();assert.equal(r.start(0,short.pb,short.sb,1,2),5);assert.deepEqual(short.vmState,b);
});
test('retained phase/header/cursor corruption is transport failure before source writes',()=>{
 for(const [steps,field,value]of[
  [0,0,0],[0,1,6],[0,6,1],[0,7,1],[0,8,1],[0,9,2],[0,10,1],[0,11,1],[0,12,1],[0,13,1],
  [1,6,99],[1,7,0],[1,8,99],[1,10,99],[1,11,99],[1,12,99],[1,13,99],
  [3,6,99],[3,7,99],[3,8,1],[5,6,0],[5,8,99],
 ]){const f=fixture(),m=ref(f);assert.equal(m.start(0,f.pb,f.sb,7,8),0);for(let k=0;k<steps;k++)assert.equal(m.step(0),0);f.vmState[L.tailOffset+field]=value;
  const state=f.vmState.slice(),scratch=f.scratch.slice();assert.equal(ref(f).step(0),5,JSON.stringify([steps,field,value]));assert.deepEqual(f.vmState,state);assert.deepEqual(f.scratch,scratch);
 }
});
test('source status/header/input/node/output ordering is visible only at the exact phased boundaries',()=>{
 const f=fixture(),m=ref(f),t=L.tailOffset,status=f.sb+f.c.registerCount,initial=f.scratch.slice();
 assert.equal(m.start(0,f.pb,f.sb,17,18),0);assert.deepEqual(f.scratch,initial);assert.equal(f.vmState[t+1],1);
 assert.equal(m.step(0),0);assert.equal(f.vmState[t+1],2);const initialized=initial.slice();initialized[status]=0;assert.deepEqual(f.scratch,initialized);
 for(let input=0;input<2;input++){assert.equal(m.step(0),0);assert.deepEqual(f.scratch,initialized);}
 assert.equal(f.vmState[t+1],3);assert.equal(f.vmState[t+6],0);
 assert.equal(m.step(0),0);assert.equal(f.vmState[t+6],1);assert.equal(f.vmState[t+1],3);assert.equal(f.scratch[status],0);
 assert.equal(m.step(0),0);assert.equal(f.vmState[t+6],2);assert.equal(f.vmState[t+1],4);const beforeOutputs=f.scratch.slice();
 assert.equal(m.step(0),0);assert.equal(f.vmState[t+8],1);assert.deepEqual(f.scratch,beforeOutputs);
 assert.equal(m.step(0),0);assert.equal(f.vmState[t+8],2);assert.deepEqual(f.scratch,beforeOutputs);
 assert.equal(m.step(0),1);beforeOutputs[status]=1;assert.deepEqual(f.scratch,beforeOutputs);assert.equal(f.vmState[t+1],5);
 assert.equal(check(fixture()).calls,1+2+2+3,'header+inputs+nodes+outputs; start is a separate work unit');
});
test('two candidate-local tails resume interleaved from copied words without shared control or scratch',()=>{
 const f=fixture(),first=f.scratch.slice(),stride=first.length,combined=new Uint32Array(stride*2);combined.set(first);combined.set(first,stride);combined[stride+f.sb]=bits(-3);f.scratch=combined;
 const expected=combined.slice();assert.equal(original({testOnly:true,program:f.program,scratch:expected,programBase:f.pb,scratchBase:f.sb}),1);assert.equal(original({testOnly:true,program:f.program,scratch:expected,programBase:f.pb,scratchBase:stride+f.sb}),1);
 for(let lane=0;lane<2;lane++)assert.equal(ref(f).start(lane*L.vmStride,f.pb,lane*stride+f.sb,27+lane,41+lane),0);
 const status=[0,0];let turns=0;while(status.some(x=>x===0)){for(const lane of[1,0])if(status[lane]===0){status[lane]=ref(f).step(lane*L.vmStride);f.vmState=f.vmState.slice();f.scratch=f.scratch.slice();}assert.ok(++turns<32);}
 assert.deepEqual(status,[1,1]);assert.deepEqual(f.scratch,expected);for(let lane=0;lane<2;lane++){const t=lane*L.vmStride+L.tailOffset;assert.equal(f.vmState[t+14],0xfffffff0);assert.equal(f.vmState[t+15],17);}
});
