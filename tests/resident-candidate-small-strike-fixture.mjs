// PREPARATION/ASSERTION ONLY. New explicit two-row diagnostic roster, not a
// replacement for the accepted six-row/eight-h gate or a shorter shot horizon.
// Only initializationPlan + rows may feed a runtime serializer. Everything in
// sourceExpectations/nativeEvidence/seed is assertion-only and never uploaded.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRawFirstHFixture,RAW_FIRST_H_CASES} from './resident-candidate-raw-whole-h-fixture.mjs';
import {createWholeHOracleFromSource,DEFAULT_WHOLE_H_RULE} from './resident-candidate-whole-h-fixture.mjs';
import {createNativeRestOracle,DEFAULT_NATIVE_REST_RULE} from './resident-candidate-native-rest-fixture.mjs';
import {STATUS,REASON} from '../src/resident-candidate/abi.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex'),clone=structuredClone;
export const SMALL_STRIKE_CASES=Object.freeze([219,522].map(id=>{const row=RAW_FIRST_H_CASES.find(x=>x.id===id);assert.ok(row);return row;}));
export const SMALL_STRIKE_SOURCE_H=Object.freeze([8,64]);
export const SMALL_STRIKE_NATIVE_POINTS=Object.freeze([
 {name:'first-outer',h:64,outer:1},{name:'before-tip',h:128,outer:2},{name:'after-tip',h:192,outer:3}
].map(Object.freeze));
export const SMALL_STRIKE_EXPECTED_KIND='resident-small-strike-assertions-only-v1';
export const SMALL_STRIKE_CREATED_SHA256='feb6b6eea9a0d29236df73680e79d3cbedf84dee702f3dae0c1e80a33ef9c2ef';
export const SMALL_STRIKE_COVERAGE=Object.freeze({roster:'explicit accepted219 plus invalid522',sourceOwnerExpectations:[8,64],nativeOuterExpectations:[64,128,192],nativeTipBeforeH:165,queryHorizon:16,maxOuterSteps:15360,sourceDt:1/960,sourceSubdivisions:64,cpuFuturesRuntimeInputs:false,gpuExecuted:false,sourcePhysicsModified:false,fullRest:false,rawToStrikeQualified:false,native1024:false,hardwarePerformance:false});
/** Independent ORIGINAL source-owner recurrence from its own admitted variant
 * seed. This new fixed64h helper leaves createRawFirstHFixture's <=8 bound and
 * all older acceptance gates unchanged. */
async function sourceBoundaries(seed,source,rule){
 const oracle=await createWholeHOracleFromSource({seed,artifactSha256:source.artifactSha256},{rule});
 try{const out={};assert.equal(oracle.initial.frame,0);for(let h=1;h<=64;h++){const step=await oracle.step();assert.equal(step.snapshot.frame,h);if(SMALL_STRIKE_SOURCE_H.includes(h))out[h]=step;}return out;}
 finally{oracle.dispose();}
}
/** Fresh unchanged PhysicsLab.step(1) oracle, complete latched outer calls only.
 * Expected h192 is prepared now, but does not authorize/runtime-request h192. */
async function nativeBoundaries(seed,preStrikeIdentity,settings){
 const oracle=await createNativeRestOracle({settings,rule:DEFAULT_NATIVE_REST_RULE});
 try{
  assert.equal(oracle.sourceIdentity,seed.initialSnapshotSha256,'independent native and original admitted CREATED bytes');assert.equal(hash(oracle.initial.nativeSnapshot),seed.initialSnapshotSha256);assert.equal(oracle.initial.origin.preStrikeSnapshotSha256,preStrikeIdentity);assert.equal(oracle.maxOuterSteps,15360);
  const checkpoints=[],outerReceipts=[];for(const point of SMALL_STRIKE_NATIVE_POINTS){const state=oracle.stepOuter();assert.equal(state.nativeSteps,point.h);assert.equal(state.outerSteps,point.outer);assert.equal(state.boundary.subdivisions,64);assert.equal(state.boundary.nativeCalls.length,64);assert.equal(state.dt,1/960);assert.equal(state.scoring.status,'running');assert.equal(state.scoring.accumulator.steps,point.outer);assert.equal(state.fullRest,false);checkpoints.push({name:point.name,state});outerReceipts.push(clone(state.boundary));}
  const before=checkpoints[1].state,after=checkpoints[2].state,prefix=oracle.initial.emittedEvents.length;assert.equal(before.cue.contacted,false);assert.equal(before.objects.find(o=>o.id===before.selectedId).body.sleeping,true);assert.equal(after.cue.contacted,true);assert.equal(after.cue.stats.contactEpisodes,1);assert.ok(after.cue.stats.normalImpulse>0);assert.equal(after.objects.find(o=>o.id===after.selectedId).body.sleeping,false);
  assert.equal(after.emittedEvents.length-prefix,1);const event=after.emittedEvents[prefix],receipt=after.emissionBoundaries[prefix];assert.equal(event.kind,'contact');assert.equal(event.key,undefined);assert.equal(receipt.nativeStepsCompleted,164);assert.equal(receipt.outerStep,3);assert.equal(receipt.time,5.631835937499722);assert.equal(receipt.time,after.cue.stats.firstContact);
  // Reuse the existing assertion schema/projections with explicit new names;
  // never relabel the baseline320/384 evidence or weaken its loader guards.
  return {kind:'resident-native-strike-assertions-only-v1',initial:oracle.initial,checkpoints,outerReceipts,sourceIdentity:oracle.sourceIdentity,rule:clone(oracle.request.options),seed,coverage:{...SMALL_STRIKE_COVERAGE,nativeProjectionIsNotAll11:true}};
 }finally{oracle.dispose();}
}
export async function createSmallStrikeFixture({trace=()=>{}}={}){
 assert.equal(typeof trace,'function');const physicsBefore=hash(readFileSync(new URL('../src/physics.js',import.meta.url)));
 const f=await createRawFirstHFixture({cases:SMALL_STRIKE_CASES,rule:DEFAULT_WHOLE_H_RULE,frames:1});
 assert.deepEqual(f.rows,SMALL_STRIKE_CASES.map(({id,settings})=>({id,settings})));assert.equal(f.rule.maxOuterSteps,15360);
 const [accepted,rejected]=f.results;assert.deepEqual([accepted.row.id,accepted.kind,accepted.status,accepted.reason],[219,'clear',STATUS.RUNNING,REASON.NONE]);assert.deepEqual([rejected.row.id,rejected.kind,rejected.status,rejected.reason],[522,'invalid',STATUS.REJECTED,REASON.SOURCE_INPUT_RANGE]);
 const seed=accepted.seed;assert.equal(seed.initialSnapshotSha256,SMALL_STRIKE_CREATED_SHA256);assert.equal(seed.sourceOrigin.preStrikeSnapshotSha256,f.plan.preStrikeIdentity);assert.deepEqual(seed.sourceOrigin.settings,accepted.row.settings);assert.equal(accepted.admission.settings.speed,4.5);
 trace({stage:'small-roster-original-admission',rows:f.rows,createdIdentity:seed.initialSnapshotSha256,preStrikeIdentity:f.plan.preStrikeIdentity});
 const sourceExpectations=await sourceBoundaries(seed,f.source,f.rule);for(const h of SMALL_STRIKE_SOURCE_H){assert.equal(sourceExpectations[h].snapshot.frame,h);assert.equal(sourceExpectations[h].scoring.status,'running');assert.equal(sourceExpectations[h].scoring.accumulator.steps,h===64?1:0);}
 trace({stage:'small-roster-source-expectations-only',frames:SMALL_STRIKE_SOURCE_H,groups:11,clocks:SMALL_STRIKE_SOURCE_H.map(h=>({h,time:sourceExpectations[h].snapshot.time,outer:sourceExpectations[h].snapshot.outerStep,substep:sourceExpectations[h].snapshot.outerSubstep,scorerSteps:sourceExpectations[h].scoring.accumulator.steps}))});
 const nativeEvidence=await nativeBoundaries(seed,f.plan.preStrikeIdentity,accepted.row.settings);
 let rejectedNative;await assert.rejects(async()=>{const unexpected=await createNativeRestOracle({settings:rejected.row.settings,rule:DEFAULT_NATIVE_REST_RULE});unexpected.dispose();},error=>{assert.equal(error.code,'ORIGINAL_STRIKE_REJECTED');assert.equal(error.pass,null);rejectedNative={code:error.code,pass:error.pass,message:error.message};return true;});
 assert.equal(hash(readFileSync(new URL('../src/physics.js',import.meta.url))),physicsBefore,'original native source unchanged');
 const identity={preStrikeIdentity:f.plan.preStrikeIdentity,createdIdentity:seed.initialSnapshotSha256,commonTemplateIdentity:f.plan.sourceIdentity,sourceArtifactSha256:f.source.artifactSha256,sourcePhysicsSha256:physicsBefore,rows:clone(f.rows),rule:clone(f.rule),sourceH:SMALL_STRIKE_SOURCE_H,nativePoints:SMALL_STRIKE_NATIVE_POINTS};
 const expected={kind:SMALL_STRIKE_EXPECTED_KIND,count:2,identity,rows:clone(f.rows),seed,sourceExpectations,nativeEvidence,rejection:{id:522,status:STATUS.REJECTED,reason:REASON.SOURCE_INPUT_RANGE,h:0,native:rejectedNative},coverage:SMALL_STRIKE_COVERAGE};
 // This identity binds the declared inputs/schedule only. The coordinator
 // separately hashes exact serialized expected-file bytes, including futures.
 // Do not reserialize a spread/reconstructed V8 graph as a byte-identity check.
 expected.assertionIdentity=hash(JSON.stringify(identity));expected.assertionIdentityScope='declared-input-and-schedule-metadata; coordinator must hash complete expected file';trace({stage:'small-roster-native-expectations-only',points:SMALL_STRIKE_NATIVE_POINTS,firstTipBeforeH:165,assertionIdentity:expected.assertionIdentity});
 return {initializationPlan:f.plan,rows:f.rows,seed,source:f.source,sourceExpectations,nativeEvidence,identity,expected};
}
