// HOST admission only; the native role is never invoked by these tests.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {deserialize} from 'node:v8';
import {assertNumberProgramNativePlan} from './resident-candidate-number-program-native.mjs';
const path=process.env.RESIDENT_NUMBER_PROGRAM_NATIVE_PLAN;
test('native role remains explicit, source-only input and fixed six calls',()=>{
 const code=readFileSync(new URL('./resident-candidate-number-program-native.mjs',import.meta.url),'utf8');
 const start=code.indexOf('export async function runNumberProgramNative'),end=code.indexOf('export function assertNumberProgramNative(',start);assert.ok(start>=0&&end>start);const native=code.slice(start,end);
 assert.doesNotMatch(native,/readFileSync\([^\n]*assertions|expected\.v8|compareCreatedTipImpactResult|createMicrocodeVmReferenceForTest/);
 assert.match(native,/RUN_RESIDENT_NUMBER_PROGRAM_NATIVE,'fixed-six-dispatches'/);assert.match(native,/passIndex<2/);assert.match(native,/pass\.dispatchWorkgroups\(1\)/);
 assert.ok(native.indexOf('getCompilationInfo')<native.indexOf('createComputePipelineAsync'));assert.ok(native.indexOf('pipeline-ready')<native.indexOf("allocate(totalWords*4"));
});
test('fixed source/count/control/span admission rejects mutations before any device request',{skip:!path},()=>{
 const p=deserialize(readFileSync(path));assert.strictEqual(assertNumberProgramNativePlan(p),p);
 for(const change of[x=>x.work.passes=3,x=>x.work.rawWorldInput=true,x=>x.cases[0].args[3]=1,x=>x.cases[1].bindings[0]=new Uint32Array(1),x=>x.cases[1].bindings[0][55745]=1,x=>x.canonicalSource+='\n',x=>x.shader+='\n',x=>x.future={},x=>x.cases[0].expected=x.cases[0].bindings]){const bad=structuredClone(p);change(bad);assert.throws(()=>assertNumberProgramNativePlan(bad));}
});
