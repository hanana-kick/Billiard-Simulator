// Bounded original CPU prefix only. No GPU or scalar-microcode replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {captureOriginalPostImpactH193,loadPostImpactComparisonArtifacts,compareOriginalPostImpactH193,POST_IMPACT_NATIVE_SETTINGS} from './resident-candidate-post-impact-native-projection.mjs';
import {COUPLED_BODY_OFFSETS as B} from '../src/resident-candidate/coupled-solver.mjs';
import {APPLICATION_LAYOUT as A} from '../src/resident-candidate/application.mjs';
import {WORLD_APPLICATION_LAYOUT as W} from '../src/resident-candidate/world-application.mjs';
import {CUE_LAYOUT as Q} from '../src/resident-candidate/cue.mjs';
import {RULE_LAYOUT as R} from '../src/resident-candidate/physical-rules.mjs';
const root=process.env.RESIDENT_POST_IMPACT_ARTIFACT_ROOT??fileURLToPath(new URL('../../resident-native-artifacts',import.meta.url));
let promise,comparisonArtifacts;
const capture=()=>promise??=captureOriginalPostImpactH193();
async function artifacts(t){if(!existsSync(join(root,'post-impact-profile-v1/four-final.v8'))){t.skip('Immutable comparison-only HOST h193 artifact is unavailable');return null;}const c=await capture();return comparisonArtifacts??=loadPostImpactComparisonArtifacts(c,root);}
test('fresh actual original CPU prefix stops after complete h193 without completing outer4',async()=>{
 const proto=globalThis.PhysicsLab.prototype,tip=proto.compliantTipContact,angular=proto.angularPatchResistance,step=proto.step;
 const c=await capture(),s=c.state,b=c.boundary;
 assert.equal(proto.tip,undefined);assert.equal(proto.compliantTipContact,tip);assert.equal(proto.angularPatchResistance,angular);assert.equal(proto.step,step);
 assert.deepEqual(s.settings,POST_IMPACT_NATIVE_SETTINGS);assert.equal(c.initial.nativeSteps,0);assert.equal(s.nativeSteps,193);assert.equal(s.outerSteps,3);assert.equal(s.applicationSteps,c.initial.applicationSteps+3);assert.equal(s.scoring.accumulator.steps,3);
 assert.deepEqual([b.outerOrdinal,b.substepCompleted,b.subdivisions,b.nextHNotEntered],[4,1,64,194]);assert.equal(b.h,1/61440);assert.equal(s.nativeDtWord,931694729);assert.equal(b.currentNativeDtWord,s.nativeDtWord);
 assert.equal(s.boundary.outer,3);assert.equal(s.boundary.nativeCalls.length,64);assert.equal(s.time,c.completeOuterStates[2].time+b.h);
 assert.equal(s.cue.stats.contactEpisodes,1);assert.equal(s.cue.stats.normalImpulse,0.5958041510074077);assert.equal(s.fullRest,false);assert.equal(s.scoring.status,'running');
 assert.equal(s.emittedEvents.length,2);assert.equal(s.events.length,10);assert.equal(s.emissionBoundaries.length,s.emittedEvents.length);assert.equal(s.game.pending.cueId,2);
 assert.ok(s.nativeSnapshot.byteLength>0);assert.equal(c.coverage.completeNativeMemoryCompared,false);
});
test('independent partial-outer projection matches all8 full represented groups of frozen HOST h193',async t=>{
 const a=await artifacts(t);if(!a)return;const c=await capture(),r=compareOriginalPostImpactH193(c,a);
 assert.equal(r.status,'pass');assert.deepEqual(r.groups.map(x=>x.group),['balls','cue','clock','rules','history','game','partialOuter','emissions']);assert.ok(r.groups.every(x=>x.mismatch===null));
 assert.deepEqual(r.projection.coverage.existingOuterProjectionFieldsDropped,[]);assert.equal(r.projection.actual.partialOuter.phase,W.phases.outerReady);assert.equal(r.projection.actual.partialOuter.substepCompleted,1);
 assert.equal(r.projection.actual.emissions.length,c.state.emittedEvents.length-c.initial.emittedEvents.length);assert.equal(r.gpuExecuted,false);assert.equal(r.rawToH193NativeQualified,false);
});
test('every represented root rejects altered bits or emissions; partial outer cannot be relabeled complete',async t=>{
 const a=await artifacts(t);if(!a)return;const c=await capture(),seg=a.template.segments;
 const changes=[['balls',seg.bodies.offset+a.previous.seed.selectedIndex*64+B.linear],['cue',seg.cue.offset+54],['clock',seg.application.offset+A.header.time],
  ['rules',seg.rules.offset+R.steps],['history',seg.rules.offset+R.ring+1],['game',seg.rules.offset+R.gameCushions],['partialOuter',seg.worldApplication.offset+W.header.substep]];
 for(const[group,at]of changes){const words=a.final.bindings[0].slice();words[at]^=1;const altered={...a,final:{...a.final,bindings:[words,...a.final.bindings.slice(1)]}},r=compareOriginalPostImpactH193(c,altered);assert.equal(r.status,'mismatch',group);assert.ok(r.groups.find(x=>x.group===group).mismatch,group);}
 const altered={...a,audit:a.audit.map(x=>({...x,timeLo:x.timeLo^1}))};assert.ok(compareOriginalPostImpactH193(c,altered).groups.find(x=>x.group==='emissions').mismatch);
 for(const[at,value]of[[seg.worldApplication.offset+W.header.phase,W.phases.idle],[seg.worldApplication.offset+W.header.outer,4],[10,new Uint32Array(Float32Array.of(c.state.dt).buffer)[0]],[seg.cue.offset+Q.header.needsSolve,1]]){
  const words=a.final.bindings[0].slice();words[at]=value;const r=compareOriginalPostImpactH193(c,{...a,final:{...a.final,bindings:[words,...a.final.bindings.slice(1)]}});assert.equal(r.status,'mismatch');assert.ok(r.groups.find(x=>x.group==='partialOuter').mismatch);
 }
});
test('capture has no future-artifact input and comparison loader requires completed independent witness',()=>{
 const source=captureOriginalPostImpactH193.toString();assert.doesNotMatch(source,/deserialize|loadPostImpactComparisonArtifacts|post-impact-profile-v1|four-final|sourceExpectations|stepWhole/);
 assert.match(source,/createNativeRestOracle/);assert.match(source,/tip\.apply\(this,args\)/);assert.match(source,/angular\.apply\(this,args\)/);assert.match(source,/throw stop/);
 assert.throws(()=>loadPostImpactComparisonArtifacts({kind:'wrong'},root));
 const physics=readFileSync(new URL('../src/physics.js',import.meta.url),'utf8');assert.match(physics,/this\.angularPatchResistance\(h\);\s*if\(this\.cue&&this\.time-this\.cue\.started>\.22\)this\.removeCue\(\);\s*}\s*this\.world\.integrationParameters\.dt=this\.dt;this\.steps\+\+/);
});
