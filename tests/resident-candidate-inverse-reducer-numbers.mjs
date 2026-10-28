import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {createInverseObservationLayout,INVERSE_REDUCER_NUMBERS} from '../src/resident-candidate/inverse-observation-layout.mjs';
import {generateInverseObservationWGSL} from '../src/resident-candidate/inverse-observation-reducer.mjs';
import {generatePinnedMathWGSL,pinnedHypot3Reference} from '../src/resident-candidate/raw-strike.mjs';
import {generateSourceNumberWGSL,numberWords} from '../src/resident-candidate/source-number.mjs';
import {parseMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {microcodeIntrinsicReference} from './resident-candidate-microcode-intrinsic-reference.mjs';
const layout=createInverseObservationLayout({topology:{events:[{kind:'object',id:2}]},objectIds:[2],rails:[]});
const source=generateInverseObservationWGSL(layout);
const sha=x=>createHash('sha256').update(x).digest('hex');
test('reachable original hypot/f64 declarations and functions retained byte-structurally, no native f32 math',()=>{
 assert.equal(INVERSE_REDUCER_NUMBERS,'v8-13.6.233-fast-hypot-binary64-v1');assert.match(process.versions.v8,/^13\.6\.233\./,'this oracle is the explicitly pinned V8 branch, not all JS engines');
 const got=parseMicrocodeWGSL(source),math=parseMicrocodeWGSL(generateSourceNumberWGSL()+generatePinnedMathWGSL());
 for(const fn of got.functions.filter(f=>f.name.startsWith('rc_f64_')||f.name.startsWith('rc_u128_'))){assert.deepEqual(fn,math.functions.find(x=>x.name===fn.name),fn.name+' exact original body/signature');}
 assert.ok(got.functions.some(f=>f.name==='rc_f64_pinned_hypot3'));assert.ok(!source.includes('f32'),'all represented Number operations integer-backed');assert.match(source,/Copyright 2014, 2016, 2019 the V8/);
 // Observation function source identity, not unrelated finalization wrappers.
 const original=fs.readFileSync(new URL('../src/inverse-events.js',import.meta.url),'utf8');assert.equal(sha(original.slice(original.indexOf('function surfaceResidual('),original.indexOf('function begin('))),'47ff56683a4a7320483c872a8b3af47684a3d668a8d19c615f022e4cb4550b77');
});
test('generated linked hypot3 matches original Math.hypot words on bounded edge/random probes',()=>{
 const c=compileMicrocodeWGSL(source,{entry:'ro_norm',intrinsics:'source-f64-v1'}),fn=c.functions.find(x=>x.name==='ro_norm');
 const cases=[[0,-0,0],[Number.MIN_VALUE,0,0],[Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE],[1,2**-27,2**-27],[1e300,1e-300,-1e300],[Number.MAX_VALUE,Number.MIN_VALUE,0],[.06,0,0],[.03,.03,.03]];
 let rng=0x21354687;const next=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return rng>>>0;};
 for(let i=0;i<128;i++)cases.push(Array.from({length:3},()=>((next()/2**32)-.5)*2**(next()%1800-900)));
 for(const values of cases){const words=values.flatMap(x=>Array.from(numberWords(x))),vm=createMicrocodeVmReferenceForTest({testOnly:true,code:c.instructions,localWords:c.localWords,stackCapacity:c.callDepth,entryPc:c.entryPc,intrinsics:'source-f64-v1',intrinsicHandler:microcodeIntrinsicReference,initialSlots:words.map((value,i)=>({slot:fn.params[0].slot+i,value}))});vm.begin();assert.equal(vm.advance(0,65536),2);const out=Uint32Array.of(vm.local(0,fn.returnSlot),vm.local(0,fn.returnSlot+1));assert.deepEqual(out,numberWords(Math.hypot(...values)),String(values));assert.ok(Object.is(pinnedHypot3Reference(...values),Math.hypot(...values)));}
});
