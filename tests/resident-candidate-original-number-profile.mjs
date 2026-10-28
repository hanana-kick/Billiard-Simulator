// HOST assertion authority gate. Fresh original source inputs only; the retained
// actual banks are immutable assertion targets, NEVER source-oracle inputs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {deserialize,serialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import World from '../src/experimental-four-ball-world.js';
import '../src/experimental-cue-created-stroke-stage.js';
import {createRawFirstHFixture,RAW_FIRST_H_CASES} from './resident-candidate-raw-whole-h-fixture.mjs';
import {createWholeHOracleFromSource} from './resident-candidate-whole-h-fixture.mjs';
import {createTipImpactSourcePlan,composeTipImpactSourcePlan} from './resident-candidate-tip-impact-source-plan.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {compareCreatedTipImpactResult} from './resident-candidate-tip-impact-created-host.mjs';
const Cue=globalThis.LabCueCreatedStrokeStageExperimental,PROFILE='original-js-number-v1',LEGACY='legacy-double-single-v1',sha=x=>createHash('sha256').update(x).digest('hex'),dir=process.env.RESIDENT_ORIGINAL_NUMBER_ACTUAL_DIR;
const HASHES={initial:'c500a622817129cfa240aa6ac2a49582dd2391398a6e391b1692563cf34d7b53',expected:'eefa6069514ae4ae0c7cf4ae593fa1591a8551c4b0d172d0b51691b85f329226',continuation:'c1013531a239adb273544bbf39e2840821131c89fb555f059416c67c2a0f051c'};
test('CPU original-Number profile is explicit and unknown/GPU overrides reject before any world creation',async()=>{
 assert.deepEqual(Cue.REFERENCE_NUMBER_PROFILE,{legacy:LEGACY,original:PROFILE});
 for(const value of['unknown',null,0]){assert.throws(()=>Cue.createReferencePreWorldStage({}, {numberProfile:value}),/Unknown CPU cue number profile/);await assert.rejects(()=>World.createReferenceStepper({}, {cueNumberProfile:value}),/Unknown CPU cue number profile/);}
 assert.throws(()=>Cue.createReferencePreWorldStage({}, {unrelated:true}),/Only explicit CPU numberProfile/);
 for(const value of[PROFILE,LEGACY,undefined]){await assert.rejects(()=>World.createGpuStepper({}, {}, {cueNumberProfile:value}),/CPU number profile cannot override the GPU world factory/);await assert.rejects(()=>Cue.createGpuPreWorldStage({}, {}, {numberProfile:value}),/CPU number profile cannot override the GPU cue factory/);}
});
test('fresh independent original-Number192 oracle compares immutable actual128/192; old approximate oracle remains FAIL',{skip:!dir},async t=>{
 const loaded={};for(const[name,digest]of Object.entries(HASHES)){const bytes=readFileSync(join(dir,name+'.v8'));assert.equal(sha(bytes),digest,'pinned unchanged '+name+' file');loaded[name]=deserialize(bytes);}
 const initial=loaded.initial,old=loaded.expected,actual=loaded.continuation,physicsBefore=sha(readFileSync(new URL('../src/physics.js',import.meta.url))),worldBytesBefore=sha(actual.bindings[0]),vmBytesBefore=sha(actual.vmState),auditBefore=sha(actual.bindings[5]),allBindingHashes=actual.bindings.map(sha);
 const fresh=await createRawFirstHFixture({cases:[219,522].map(id=>RAW_FIRST_H_CASES.find(x=>x.id===id)),rule:old.identity.rule,frames:1}),seed=fresh.results[0].seed;
 assert.equal(seed.initialSnapshotSha256,old.seed.initialSnapshotSha256);assert.deepEqual(seed.initialEventHistory,old.nativeEvidence.initial.events);assert.deepEqual(seed.sourceOrigin.settings,old.rows[0].settings);assert.equal(fresh.source.artifactSha256,old.identity.sourceArtifactSha256);
 const ordinary=Cue.createReferencePreWorldStage(seed.cueInitial),legacy=Cue.createReferencePreWorldStage(seed.cueInitial,{numberProfile:LEGACY}),exact=Cue.createReferencePreWorldStage(seed.cueInitial,{numberProfile:PROFILE});try{assert.deepEqual(ordinary.snapshot(),legacy.snapshot(),'omitted legacy surface unchanged');assert.equal('referenceNumberProfile'in ordinary.snapshot(),false);assert.equal(exact.snapshot().referenceNumberProfile,PROFILE);const x=exact.snapshot();delete x.referenceNumberProfile;assert.deepEqual(x,ordinary.snapshot(),'only explicit authority tag differs at t0');}finally{ordinary.dispose();legacy.dispose();exact.dispose();}
 // All source lowering and macro signatures remain identical. The reference
 // precision option is never an input to production WGSL or bytecode.
 const g=createTipImpactSourcePlan({initializationPlan:fresh.plan,rows:fresh.rows}),composed=composeTipImpactSourcePlan(g,{limits:{maxStorageBufferBindingSize:134217728,maxBufferSize:268435456}}),compiled=allocateMicrocodeLocals(compileMicrocodeWGSL(composed.code,{entry:composed.entry,storageBindings:{...I.bindings,rc_event_audit:5},externalFunctions:initial.compiled.externalFunctions.map(x=>x.name),intrinsics:'none',allocationMetadata:true}),{mode:'call-frames-v1'});
 assert.equal(sha(composed.code),initial.identity.sourceSha256);assert.deepEqual(compiled.instructions,initial.compiled.instructions);assert.deepEqual(compiled.functions,initial.compiled.functions);assert.deepEqual(compiled.externalFunctions,initial.compiled.externalFunctions);assert.equal(compiled.localWords,initial.compiled.localWords);assert.equal(compiled.callDepth,initial.compiled.callDepth);
 const oracle=await createWholeHOracleFromSource({seed,artifactSha256:fresh.source.artifactSha256},{rule:old.identity.rule,cueNumberProfile:PROFILE}),sourceExpectations={};try{assert.equal(oracle.cueNumberProfile,PROFILE);assert.equal(oracle.initial.cue.referenceNumberProfile,PROFILE);for(let h=1;h<=192;h++){const row=await oracle.step();assert.equal(row.snapshot.cue.referenceNumberProfile,PROFILE);if(h===128||h===192)sourceExpectations[h]=row;}}finally{oracle.dispose();}
 assert.equal(sha(readFileSync(new URL('../src/physics.js',import.meta.url))),physicsBefore);
 const expected={...old,seed,sourceExpectations,referenceAuthority:PROFILE,referenceAuthorityScope:'independent C.sourceReference and T.sourceReference; original Math.hypot/Number then native f32 API boundaries'},expectedBytes=serialize(expected),expectedSha256=sha(expectedBytes);writeFileSync(join(dir,'source-number-expected.v8'),expectedBytes);
 const vm=createMicrocodeVmReferenceForTest({testOnly:true,...initial.configuration,code:initial.compiled.instructions,bindings:actual.bindings,state:actual.vmState});
 assert.throws(()=>compareCreatedTipImpactResult({initial,expected:old,bindings:actual.bindings,vm}),/cue.tangent\[0\]/,'historical all11 source gate remains negative; no reclassification');
 const comparison=compareCreatedTipImpactResult({initial,expected,bindings:actual.bindings,vm});assert.equal(comparison.all11SourceGroups,true);assert.equal(comparison.fullAcceptedEmissionTapeQualified,true);assert.equal(comparison.events,1);
 assert.deepEqual(actual.bindings.map(sha),allBindingHashes,'all retained source bindings stay byte-identical');assert.equal(sha(actual.bindings[0]),worldBytesBefore);assert.equal(sha(actual.vmState),vmBytesBefore);assert.equal(sha(actual.bindings[5]),auditBefore);for(const[name,digest]of Object.entries(HASHES))assert.equal(sha(readFileSync(join(dir,name+'.v8'))),digest);
 const evidence={kind:'resident-created-original-number-profile-h192-v1',status:'pass-under-explicit-original-number-reference',referenceAuthority:PROFILE,referenceAuthorityScope:'cue lateral and compliant tip only; other CPU owners unchanged, including legacy double-single angular patch',cueNumberProfileOnly:true,legacyReferenceDefaultUnchanged:true,historicalApproximateReferenceStillFails:true,immutableArtifacts:HASHES,newExpectedSha256:expectedSha256,sourceSha256:initial.identity.sourceSha256,bytecodeSha256:initial.identity.bytecodeSha256,compiledInstructionsAndSignaturesUnchanged:true,originalPhysicsSha256:physicsBefore,actualBanksUnchanged:true,expectedFutureRuntimeInputs:false,newVmEvolution:false,newGpuExecution:false,newNativeH192Execution:false,comparison,fullRest:false,native1024:false,hardwarePerformance:false};writeFileSync(join(dir,'source-number-profile-result.json'),JSON.stringify(evidence,null,2));t.diagnostic(JSON.stringify(evidence));
});
