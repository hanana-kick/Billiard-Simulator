import test from 'node:test';
import assert from 'node:assert/strict';
import {assertRawTipImpactHistory,tipImpactExpectationsWithCueProfile} from './resident-candidate-tip-impact-reference-profile.mjs';
import {RULE_LAYOUT as R} from '../src/resident-candidate/physical-rules.mjs';

test('cue authority is never silently changed or accepted from an unknown profile',async()=>{
 const f={expected:{marker:'same untouched legacy record'}};assert.equal(await tipImpactExpectationsWithCueProfile(f),f.expected);
 for(const name of ['legacy-double-single-v1','unknown',null])await assert.rejects(()=>tipImpactExpectationsWithCueProfile(f,name),/known cue-only/);
 assert.throws(()=>assertRawTipImpactHistory({seed:{}}),/strictly equal/);
});

test('actual original accepted/prestrike histories and independently regenerated exact cue expectations',{skip:process.env.RUN_RESIDENT_TIP_REFERENCE_PROFILE!=='1'},async()=>{
 const {createTipImpactFixture}=await import('./resident-candidate-tip-impact-fixture.mjs'),f=await createTipImpactFixture();
 const receipt=assertRawTipImpactHistory(f);assert.deepEqual([receipt.preStrikeEvents,receipt.createdEvents,receipt.ringCount],[8,9,8]);
 const before=f.expected,exact=await tipImpactExpectationsWithCueProfile(f,'original-js-number-v1');
 assert.equal(f.expected,before);assert.equal(exact.referenceAuthority,'original-js-number-v1');assert.equal(exact.nativeEvidence,f.nativeEvidence,'actual PhysicsLab evidence is not replaced');
 for(const h of[128,192]){assert.equal(exact.sourceExpectations[h].snapshot.frame,h);assert.equal(exact.sourceExpectations[h].snapshot.cue.referenceNumberProfile,'original-js-number-v1');}
 const at=f.initializationPlan.template.segments.rules.offset+R.ringCount,word=f.initializationPlan.clone[at];f.initializationPlan.clone[at]=7;
 try{assert.throws(()=>assertRawTipImpactHistory(f));}finally{f.initializationPlan.clone[at]=word;}
 const native=f.nativeEvidence.initial.events;f.nativeEvidence.initial.events=native.filter(x=>x.kind==='contact');
 try{assert.throws(()=>assertRawTipImpactHistory(f),/successful-strike/);}finally{f.nativeEvidence.initial.events=native;}
 assertRawTipImpactHistory(f);
});
