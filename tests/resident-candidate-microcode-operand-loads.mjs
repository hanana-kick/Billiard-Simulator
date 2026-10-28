import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {generateMicrocodeVmWGSL,createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {requiredVmLocalOperands} from './resident-candidate-microcode-memory-access-audit.mjs';
import {parseMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';
import{beforeCommittedReturnHostProjection}from'./resident-candidate-microcode-ret-pause-projection.mjs';
const evidence=JSON.parse(readFileSync(new URL('./fixtures/resident-microcode-operand-load-baseline.json',import.meta.url))),sha=x=>createHash('sha256').update(x).digest('hex');
function restoreOldLoads(shader,N){return shader.replace(/let ([abc])=rc_vm_state\[lb\+\1\1\];/g,'').replace(' // Only opcode-required local values are read, after its operand guards.\n',` // Operand loads are guarded independently: literals may exceed local bounds.\n var a=0u;var b=0u;var c=0u;if(aa<${N}u){a=rc_vm_state[lb+aa];}if(bb<${N}u){b=rc_vm_state[lb+bb];}if(cc<${N}u){c=rc_vm_state[lb+cc];}\n`);}
// Keep the ORIGINAL historical hash fixture. The later opt-in preparation
// extension appended opcode87 and two HOST-only transport guards. Remove only
// these exact reviewed additions for this historical operand-load proof, never
// arbitrary cases/guards or a regenerated expected hash. Its separate source
// tests own the new operation; all four profiles below must reject it.
function removeExact(source,addition){assert.equal(source.split(addition).length,2,'exact single reviewed preparation addition');return source.replace(addition,'');}
const phasedProjection=JSON.parse(readFileSync(new URL('./fixtures/resident-microcode-phased-host-projection.json',import.meta.url)));
// bc12586 changed the canonical function TEXT even with phased mode omitted.
// Recover only its exact seven reviewed changes, then apply the older exact
// preparation projection. Never execute projected text or relax source hashes.
function beforePhasedHostProjection(source){
 source=beforeCommittedReturnHostProjection(source);
 assert.equal(phasedProjection.kind,'resident-phased-host-legacy-projection-v1');
 assert.equal(phasedProjection.sourceBoundary,'bc1258664c2b0f13e792dd9f3cde17c67a54c238');
 assert.equal(sha(source),phasedProjection.currentHostReferenceSha256,'exact current canonical HOST text');
 assert.equal(phasedProjection.patches.length,7);
 for(const p of phasedProjection.patches){
  assert.equal(sha(p.current),p.currentSha256,p.label+' exact reviewed body');assert.equal(sha(p.historical),p.historicalSha256,p.label+' exact prior replacement');
  assert.equal(source.split(p.current).length,2,p.label+' exactly one occurrence');source=source.replace(p.current,p.historical);
 }
 assert.equal(sha(source),phasedProjection.beforePhasedHostReferenceSha256,'exact canonical HOST before phased addition');return source;
}
function historicalHostProjection(source){
 source=beforePhasedHostProjection(source);
 for(const addition of [
  "if(intrinsic.family==='preparation'){try{assertPreparationInputs(Array.from(ins.slice(2,8),slot=>state[lb+slot]),bindings,{lane});}catch{return fail(at,E.sourceDomain,S.unsupported);}}",
  "if(intrinsic.family==='preparation'&&result?.kind==='source-preparation-failure'){if(result.error!==E.storageRange||result.status!==S.invalid)throw new TypeError('Exact preparation failure transport');return fail(at,result.error,result.status);}",
 ])source=removeExact(source,addition);return source;
}
function historicalShaderProjection(source){
 assert.equal(I.opcodes.GEOMETRY_NUMERIC_PREPARE,87);assert.equal(I.names.length,88);
 const rejected='\ncase 87u:{if(rc_microcode[ip+1u]>=32u||rc_microcode[ip+2u]>=32u||rc_microcode[ip+3u]>=32u||rc_microcode[ip+4u]>=32u||rc_microcode[ip+5u]>=32u||rc_microcode[ip+6u]>=32u||rc_microcode[ip+7u]>=32u){return rc_vm_fail(base,4u,3u);}return rc_vm_fail(base,9u,4u);}';
 assert.doesNotMatch(source,/\brc_geometry_numeric_prepare\b|\brc_gp_\w*/,'legacy profiles cannot link preparation helpers');return removeExact(source,rejected);
}
function cases(shader){const at=shader.indexOf('switch op{',shader.indexOf('fn rc_vm_step'));return I.names.map((name,id)=>{const start=shader.indexOf(`case ${id}u:{`,at);assert.ok(start>=at);let end=start+`case ${id}u:{`.length,depth=1;for(;depth;end++)depth+=+(shader[end]==='{')-+(shader[end]==='}');return{name,body:shader.slice(start,end)};});}
test('legacy load-change proof retains original hashes with exact disabled preparation and phased additions projected out',()=>{
 assert.equal(sha(historicalHostProjection(createMicrocodeVmReferenceForTest.toString())),evidence.baselineHostReferenceSha256,'all prior canonical host instruction text unchanged');
 for(const[intrinsics,expected]of Object.entries(evidence.baselineProfiles)){const shader=generateMicrocodeVmWGSL({...evidence.baselineOptions,intrinsics});assert.equal(sha(restoreOldLoads(historicalShaderProjection(shader),32)),expected,intrinsics+' original source guards/control/arithmetic/source helpers unchanged');parseMicrocodeWGSL(shader);}
});
test('legacy profiles have no continuation tail and cannot invoke the projected phased helper',()=>{
 for(const intrinsics of Object.keys(evidence.baselineProfiles)){
  let originalCalls=0;const code=Uint32Array.of(I.opcodes.NUM_EVAL,0,1,2,0,0,0,0,I.opcodes.HALT,0,0,0,0,0,0,0);
  const vm=createMicrocodeVmReferenceForTest({testOnly:true,code,localWords:32,intrinsics,
   numericContinuationHandler(){assert.fail('omitted phased mode must never invoke helper');},
   intrinsicHandler(spec){assert.equal(spec.name,'rc_num_eval');originalCalls++;return Uint32Array.of(1);}});
  for(const key of ['numericContinuation','numericContinuationDescriptor','numericTailOffset','numericTailWords'])assert.equal(Object.hasOwn(vm.configuration,key),false,intrinsics+' no '+key);
  vm.begin();const allowed=['source-numeric-v1','source-continuations-v1'].includes(intrinsics);
  assert.equal(vm.advance(0,2),allowed?I.status.complete:I.status.unsupported);assert.equal(originalCalls,allowed?1:0);
 }
});
test('version projection rejects changed, duplicated or missing reviewed text; historical fixture stays independent',()=>{
 const current=createMicrocodeVmReferenceForTest.toString();
 assert.equal(sha(historicalHostProjection(current)),evidence.baselineHostReferenceSha256);
 for(const p of phasedProjection.patches){assert.throws(()=>beforePhasedHostProjection(current.replace(p.current,p.current+' ')));assert.throws(()=>beforePhasedHostProjection(current+p.current));assert.throws(()=>beforePhasedHostProjection(current.replace(p.current,'')));}
});
test('projected new opcode is actually unsupported in every historical profile, without consuming a step or calling a handler',()=>{
 for(const intrinsics of Object.keys(evidence.baselineProfiles)){
  const code=Uint32Array.of(I.opcodes.GEOMETRY_NUMERIC_PREPARE,0,1,2,3,4,5,6),vm=createMicrocodeVmReferenceForTest({testOnly:true,code,localWords:32,intrinsics,intrinsicHandler(){assert.fail('disabled preparation cannot execute');}});
  vm.begin();assert.equal(vm.advance(0,1),I.status.unsupported);assert.equal(vm.state[I.control.error],I.error.unsupportedPrimitive);assert.equal(vm.state[I.control.stepsLow],0);assert.equal(vm.state[I.control.pc],0);
 }
});
test('every scalar opcode reads exactly its used local operands after range guards, never literal fields',()=>{
 for(const{name,body}of cases(generateMicrocodeVmWGSL(evidence.baselineOptions))){const declarations=[...body.matchAll(/let ([abc])=rc_vm_state\[lb\+\1\1\];/g)],got=declarations.map(x=>x[1]);assert.deepEqual(got,requiredVmLocalOperands(name),name);const stripped=body.replace(/let ([abc])=rc_vm_state\[lb\+\1\1\];/g,'');for(const key of['a','b','c'])assert.equal(new RegExp('\\b'+key+'\\b').test(stripped),got.includes(key),name+' no undeclared/unused scalar load');for(const match of declarations){const field={a:2,b:3,c:4}[match[1]],guard=body.indexOf(`rc_microcode[ip+${field}u]>=32u`);assert.ok(guard>=0&&guard<match.index,name+' local range checked before read');}}
});
