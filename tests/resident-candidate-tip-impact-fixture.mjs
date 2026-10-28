// PREPARATION/ASSERTION ONLY. CPU future snapshots never belong to a runtime
// input. The fixed diagnostic cutoff192h is NOT the original16-second horizon.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createSmallStrikeFixture,SMALL_STRIKE_CREATED_SHA256} from './resident-candidate-small-strike-fixture.mjs';
import {createWholeHOracleFromSource} from './resident-candidate-whole-h-fixture.mjs';
export const TIP_IMPACT_EXPECTED_KIND='resident-tip-impact-assertions-only-v1';
export const TIP_IMPACT_SOURCE_H=Object.freeze([128,192]);
export const TIP_IMPACT_COVERAGE=Object.freeze({roster:'explicit accepted219 plus invalid522',sourceOwnerExpectations:TIP_IMPACT_SOURCE_H,nativeOuterExpectations:[128,192],nativeTipBeforeH:165,requestedH:192,queryHorizon:16,maxOuterSteps:15360,sourceDt:1/960,sourceSubdivisions:64,mandatoryActualEmissionTape:true,cpuFuturesRuntimeInputs:false,gpuExecuted:false,sourcePhysicsModified:false,fullRest:false,rawToStrikeQualified:false,native1024:false,hardwarePerformance:false});
const hash=x=>createHash('sha256').update(x).digest('hex');
export async function createTipImpactFixture({trace=()=>{}}={}){
 const before=hash(readFileSync(new URL('../src/physics.js',import.meta.url)));
 // Admission and native snapshots are fresh independent ORIGINAL executions;
 // reusing this fixture never extends/weakens its old source8/64 gate.
 const f=await createSmallStrikeFixture({trace});assert.equal(f.seed.initialSnapshotSha256,SMALL_STRIKE_CREATED_SHA256);
 const oracle=await createWholeHOracleFromSource({seed:f.seed,artifactSha256:f.source.artifactSha256},{rule:f.identity.rule}),sourceExpectations={};
 try{assert.equal(oracle.initial.frame,0);for(let h=1;h<=192;h++){const row=await oracle.step();assert.equal(row.snapshot.frame,h);if(TIP_IMPACT_SOURCE_H.includes(h)){assert.equal(row.scoring.status,'running');assert.equal(row.scoring.accumulator.steps,h/64);sourceExpectations[h]=row;trace({stage:'tip-impact-source-assertion-only',h,outer:row.snapshot.outerStep,substep:row.snapshot.outerSubstep,time:row.snapshot.time,scorerSteps:row.scoring.accumulator.steps});}}}finally{oracle.dispose();}
 assert.equal(hash(readFileSync(new URL('../src/physics.js',import.meta.url))),before,'unchanged original physics source');
 const nativeEvidence={...f.nativeEvidence,checkpoints:f.nativeEvidence.checkpoints.filter(x=>x.name!=='first-outer'),coverage:{...TIP_IMPACT_COVERAGE,nativeProjectionIsNotAll11:true}};
 assert.deepEqual(nativeEvidence.checkpoints.map(x=>[x.name,x.state.nativeSteps,x.state.outerSteps]),[['before-tip',128,2],['after-tip',192,3]]);
 const identity={...f.identity,sourceH:TIP_IMPACT_SOURCE_H,nativePoints:[{name:'before-tip',h:128,outer:2},{name:'after-tip',h:192,outer:3}],requestedH:192};
 const expected={kind:TIP_IMPACT_EXPECTED_KIND,count:2,identity,rows:f.rows,seed:f.seed,sourceExpectations,nativeEvidence,rejection:f.expected.rejection,coverage:TIP_IMPACT_COVERAGE,assertionIdentity:hash(JSON.stringify(identity)),assertionIdentityScope:'declared-input-and-schedule-metadata; coordinator must hash complete expected file'};
 return {initializationPlan:f.initializationPlan,rows:f.rows,seed:f.seed,source:f.source,sourceExpectations,nativeEvidence,identity,expected};
}
