// PREPARATION/ASSERTION ONLY. Original-source expectations never enter a GPU
// runtime. The exact-JS option changes cue oracle authority, not source physics.
import assert from 'node:assert/strict';
import {SOURCE_EVENT_HISTORY_PROFILE,validateSeedEventHistory,packSourceEventHistory} from '../src/source-event-history.mjs';
import {RULE_LAYOUT as R} from '../src/resident-candidate/physical-rules.mjs';

export function assertRawTipImpactHistory(f){
 const h=validateSeedEventHistory(f.seed);assert.equal(h?.profile,SOURCE_EVENT_HISTORY_PROFILE);
 assert.deepEqual(h.preStrike,f.source.raw.capture.preStrikeApplication.events,'actual original prestrike application history, not contact-only seed');
 assert.deepEqual(h.created,f.nativeEvidence.initial.events,'fresh actual PhysicsLab successful-strike t0');
 assert.equal(f.nativeEvidence.initial.nativeSteps,0);assert.equal(f.nativeEvidence.initial.outerSteps,0);
 const packed=packSourceEventHistory(h.preStrike,f.seed.contactGraphSeed.colliders),plan=f.initializationPlan,at=plan.template.segments.rules.offset;
 assert.equal(plan.template.historyInitialization.profile,SOURCE_EVENT_HISTORY_PROFILE);assert.deepEqual(plan.template.historyInitialization.preStrike,packed);
 assert.equal(plan.clone[at+R.ringCount],packed.count);assert.equal(plan.clone[at+R.ringHead],packed.head);assert.deepEqual(plan.clone.slice(at+R.ring,at+R.ring+32),packed.words,'every raw candidate begins at original prestrike ring');
 return{profile:h.profile,preStrikeEvents:h.preStrike.length,createdEvents:h.created.length,ringCount:packed.count,ringHead:packed.head};
}

export async function tipImpactExpectationsWithCueProfile(f,profile,{trace=()=>{}}={}){
 assert.ok(profile===undefined||profile==='original-js-number-v1','explicit known cue-only Number reference profile');
 if(profile===undefined)return f.expected;
 const {createWholeHOracleFromSource}=await import('./resident-candidate-whole-h-fixture.mjs');
 const oracle=await createWholeHOracleFromSource({seed:f.seed,artifactSha256:f.source.artifactSha256},{rule:f.identity.rule,cueNumberProfile:profile}),sourceExpectations={};
 try{for(let h=1;h<=192;h++){const row=await oracle.step();assert.equal(row.snapshot.frame,h);assert.equal(row.snapshot.cue.referenceNumberProfile,profile);if(h===128||h===192)sourceExpectations[h]=row;}}finally{oracle.dispose();}
 trace({stage:'tip-impact-independent-cue-number-expectations',profile,checkpoints:[128,192],expectedOnly:true});
 return{...f.expected,sourceExpectations,referenceAuthority:profile,referenceAuthorityScope:'cue lateral and compliant tip only; all other reference owners unchanged'};
}
