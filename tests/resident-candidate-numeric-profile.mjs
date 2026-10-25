import{test}from'node:test';import assert from'node:assert/strict';
import{readFile,readdir}from'node:fs/promises';
import{NUMERIC_PROFILE as P,NUMERIC_DEPENDENCY as D,NUMERIC_DEPENDENCY_MASK,
 NUMERIC_VM_OWNERS,NON_VM_NUMERIC_DEPENDENCIES,generateProfiledNumericWGSL,
 numericAdmission,guardNumericResult,generateNumericAdmissionWGSL}from'../src/resident-candidate/numeric-profile.mjs';
import{linkResidentWGSL}from'../src/resident-candidate/wgsl-linker.mjs';
import{STATUS,REASON,UNSET}from'../src/resident-candidate/abi.mjs';
import{generateCoupledSolverWGSL,generateCoupledStagedWGSL}from'../src/resident-candidate/coupled-solver.mjs';
import{generateCueOrchestrationWGSL}from'../src/resident-candidate/cue-orchestration.mjs';
import{generateCueInactiveCcdWGSL}from'../src/resident-candidate/cue-bridge.mjs';
import{generateSceneWorldWGSL,generateSceneWorldEvaluateWGSL}from'../src/resident-candidate/scene-world.mjs';
import{generateWorldCreationWGSL}from'../src/resident-candidate/world-creation.mjs';
import{generateWorldGeometryWGSL}from'../src/resident-candidate/world-geometry.mjs';
import{generateWorldCueGeometryStageWGSL}from'../src/resident-candidate/world-cue-geometry.mjs';
import{createNarrowPrograms}from'../src/resident-candidate/narrowphase.mjs';

test('every VM-injecting world generator propagates explicit preserved profile, component defaults remain distinct',()=>{
 const opts={numericProfile:P.PRESERVED_F32},integer={numericProfile:P.INTEGER_F32},legacy={numericProfile:P.DEVICE_F32};
 const names=['bodies','caches','journal','geometryFacts','manifoldViews','geometryRefreshed','projectionOutput','cue','rawPose','rawCreation'];
 const template={segments:Object.fromEntries(names.map((name,i)=>[name,{offset:i*10000}])),bundles:{narrow:createNarrowPrograms()},programOffsets:{cue:0,narrow:0},geometryOffsets:{catalog:0,hulls:0}};
 const generators=[
  x=>generateCoupledSolverWGSL(x),x=>generateCoupledStagedWGSL('evaluate',x),
  x=>generateCueOrchestrationWGSL('numeric',x),x=>generateCueInactiveCcdWGSL(x),
  x=>generateSceneWorldWGSL(x),x=>generateSceneWorldEvaluateWGSL(x),
  x=>generateWorldCreationWGSL(template,'evaluate',x),x=>generateWorldGeometryWGSL(template,'floor',x),
  x=>generateWorldCueGeometryStageWGSL('pose',x),
 ];
 for(const generate of generators){const preserved=generate(opts),device=generate(legacy);assert.match(preserved,/RC_NUMERIC_IMPLEMENTATION_PROFILE:u32=2u/);assert.match(preserved,/fn rc_num_soft_arithmetic/);assert.match(device,/RC_NUMERIC_IMPLEMENTATION_PROFILE:u32=1u/);assert.doesNotMatch(device,/fn rc_num_soft_arithmetic/);const exact=generate(integer);assert.match(exact,/PROFILE:u32=3u/);assert.match(exact,/fn rc_num_soft_arithmetic/);}
 assert.match(generateCoupledStagedWGSL('evaluate'),/PROFILE:u32=1u/);
 assert.match(generateCueOrchestrationWGSL('numeric'),/PROFILE:u32=2u/);
});
test('linker rejects a mixed numeric implementation even when no numeric function is reachable',()=>{
 const main='@compute @workgroup_size(1) fn main(){}',a=generateProfiledNumericWGSL(P.DEVICE_F32),b=generateProfiledNumericWGSL(P.PRESERVED_F32);
 assert.throws(()=>linkResidentWGSL([a,b,main]),/Conflicting WGSL declaration const:RC_NUMERIC_IMPLEMENTATION_PROFILE/);
 assert.doesNotThrow(()=>linkResidentWGSL([b,b,generateNumericAdmissionWGSL({numericProfile:P.PRESERVED_F32}),main]));
 assert.throws(()=>linkResidentWGSL([a,generateNumericAdmissionWGSL({numericProfile:P.PRESERVED_F32}),main]),/Conflicting WGSL declaration/);
 assert.throws(()=>generateProfiledNumericWGSL('automatic'),/known numeric/);
});
test('publication requires the actual selected path capabilities, never raw-input-only qualification',()=>{
 const opts={numericProfile:P.PRESERVED_F32,qualifiedMask:D.F32_VM|D.SOURCE_NUMBER},pass=Uint32Array.of(71,STATUS.PASS,1,0),miss=Uint32Array.of(72,STATUS.MISS,0,0);
 for(const row of[pass,miss]){
  assert.deepEqual(guardNumericResult(row),Uint32Array.of(row[0],STATUS.UNSUPPORTED,UNSET,REASON.NUMERIC));
  assert.deepEqual(guardNumericResult(row,{...opts,requiredMask:D.F32_VM|D.SOURCE_NUMBER}),row);
  assert.deepEqual(guardNumericResult(row,{...opts,requiredMask:D.F32_VM|D.SOURCE_NUMBER|D.RAW_CLEARANCE}),Uint32Array.of(row[0],STATUS.UNSUPPORTED,UNSET,REASON.NUMERIC));
 }
 assert.equal(numericAdmission({...opts,requiredMask:0}).allowed,true,'VM still mandatory');
 assert.equal(numericAdmission({...opts,numericProfile:P.INTEGER_F32,requiredMask:0}).allowed,true);
 assert.equal(numericAdmission({numericProfile:P.INTEGER_F32}).allowed,false,'integer selection alone is not qualification');
 assert.equal(numericAdmission({...opts,qualifiedMask:D.SOURCE_NUMBER,requiredMask:0}).allowed,false);
 assert.equal(numericAdmission({...opts,numericProfile:P.DEVICE_F32,qualifiedMask:NUMERIC_DEPENDENCY_MASK}).allowed,false);
 for(const status of[STATUS.CANCELLED,STATUS.INCOMPLETE,STATUS.FAILED,STATUS.REJECTED,STATUS.UNSUPPORTED]){const row=Uint32Array.of(4,status,UNSET,7);assert.deepEqual(guardNumericResult(row),row);}
 for(const value of[-1,512,2**32,NaN,1.5])assert.throws(()=>numericAdmission({...opts,requiredMask:value}),/dependency mask/);
 assert.match(generateNumericAdmissionWGSL(opts),/fn rc_numeric_guard_result/);
 assert.match(generateNumericAdmissionWGSL(opts),/result\.y==2u\|\|result\.y==3u/);
});
test('resident VM call sites are inventoried and no wrapper silently bypasses profile selection',async()=>{
 const dir=new URL('../src/resident-candidate/',import.meta.url),files=(await readdir(dir)).filter(x=>x.endsWith('.mjs'));
 for(const file of files){const text=await readFile(new URL(file,dir),'utf8');if(!['numeric-program.mjs','numeric-profile.mjs','integer-f32.mjs'].includes(file))assert.doesNotMatch(text,/generateNumericLibraryWGSL\s*\(/,file+' must select a profile');if(/rc_num_eval\s*\(/.test(text)&&file!=='numeric-program.mjs')assert.ok(Object.hasOwn(NUMERIC_VM_OWNERS,file),file+' needs an explicit VM ownership entry');}
 assert.deepEqual(NON_VM_NUMERIC_DEPENDENCIES.map(x=>x.bit),[D.CONVEX_POINT,D.BVH,D.NARROW_SCALARS,D.CCD_SCALARS,D.RAW_CLEARANCE,D.CUE_QUERY,D.APPLICATION_SCALARS]);
});
