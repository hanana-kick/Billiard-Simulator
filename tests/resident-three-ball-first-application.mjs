import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import v8 from 'node:v8';import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import * as D from '../tools/rapier-snapshot-decoder/browser.mjs';
import {plain} from '../src/browser-initial-import/exact-data.mjs';
import {admitThreeBallHost,createThreeBallCreatedOwnerSeed} from '../src/resident-candidate/three-ball-host-admission.mjs';
import {packThreeBallCreatedOwnerTemplate} from '../src/resident-candidate/three-ball-created-owner.mjs';
import {createThreeBallFirstScenePlan} from '../src/resident-candidate/three-ball-scene-first-collision.mjs';
import {createThreeBallFirstNumericalPlan} from '../src/resident-candidate/three-ball-first-numerical.mjs';
import {createThreeBallFirstCuePlan,THREE_BALL_FIRST_CUE_HEADER as CH} from '../src/resident-candidate/three-ball-first-cue.mjs';
import {createThreeBallFirstSpherePlan} from '../src/resident-candidate/three-ball-first-sphere.mjs';
import {createThreeBallFirstPostPlan} from '../src/resident-candidate/three-ball-first-post.mjs';
import {createThreeBallFirstPhysicalBroadPostPlan,createThreeBallFirstFinalMassBroadPostPlan} from '../src/resident-candidate/three-ball-first-broad-post.mjs';
import {createThreeBallFirstApplicationPlan,createThreeBallFirstFinalMassApplicationPlan,executeThreeBallFirstApplicationForTest,assertThreeBallFirstApplicationPlan,assertThreeBallFirstApplicationResult,threeBallFirstApplicationTestKernels,THREE_BALL_FIRST_APPLICATION_HEADER as A} from '../src/resident-candidate/three-ball-first-application.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from '../src/resident-candidate/contact-journal.mjs';
import {CUE_LAYOUT as C} from '../src/resident-candidate/cue.mjs';
const root=path.resolve(import.meta.dirname,'..'),copy=structuredClone,require=createRequire(import.meta.url);
const finalMass=process.env.THREE_BALL_APPLICATION_PROFILE==='final-mass',broadFactory=finalMass?createThreeBallFirstFinalMassBroadPostPlan:createThreeBallFirstPhysicalBroadPostPlan,appFactory=finalMass?createThreeBallFirstFinalMassApplicationPlan:createThreeBallFirstApplicationPlan;
require('../src/math.js');require('../src/physics.js');
let tmp,decoder;const fixtures=[];
before(async()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'three-created-owner-'));const file=path.join(tmp,'original.v8');
 const child=spawnSync(process.execPath,['tests/resident-three-ball-initialization-source-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);
 const data=v8.deserialize(fs.readFileSync(file));assert.equal(data.temporaryRoot,os.tmpdir());
 const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 for(const row of data.rows){const admission=await admitThreeBallHost(decoder,row.raw),seed=await createThreeBallCreatedOwnerSeed(admission),native=plain((await decoder.decodeSnapshot(row.raw.snapshot)).state);const owner=await packThreeBallCreatedOwnerTemplate(seed),plan=createThreeBallFirstScenePlan(owner),numerical=createThreeBallFirstNumericalPlan(plan),cue=createThreeBallFirstCuePlan(numerical),sphere=createThreeBallFirstSpherePlan(cue),postPlan=createThreeBallFirstPostPlan(sphere),physical=broadFactory(postPlan),app=appFactory(physical),out=await executeThreeBallFirstApplicationForTest(app,{testOnly:true});fixtures.push({row,admission,seed,native,owner,plan,numerical,cue,sphere,postPlan,physical,app,out});}
});
after(()=>{if(tmp)fs.rmSync(tmp,{recursive:true});});

test('physical bank → one existing joint adoption → original clock/observer/drain/patch/withdrawal boundary',t=>{
 for(const {row,seed,app:p,out}of fixtures){assertThreeBallFirstApplicationPlan(p);assert.equal(out.capability.completedOuterSteps,0);assert.equal(out.capability.nativeWholeHVerified,false);assert.equal(out.capability.wholeH,false);
  if(row.name==='selected-1'){assert.equal(out.available,false);assert.equal(out.reason,'current-cue-empty-manifold-owner-unavailable');continue;}
  assertThreeBallFirstApplicationResult(out,{plan:p});const d=p.layout;assert.equal(out.words[d.applicationControl+A.completed],1);assert.equal(out.words[d.cue+C.header.needsSolve],0);assert.equal(out.application.outerSubstep,1);assert.equal(out.application.latchedSubdivisions,64);assert.equal(out.application.steps,seed.application.steps);assert.deepEqual(out.history,seed.history);assert.deepEqual(out.application.events,seed.history.createdEvents);assert.deepEqual(out.application.game,seed.game);assert.equal(out.application.time,seed.application.time+seed.application.dt/64);assert.equal(out.cue.time,out.application.time);
  assert.deepEqual(out.words.slice(d.bodies+192,d.bodies+320),out.physical.words.slice(d.bodies+192,d.bodies+320),'cue adoption does not rerun/rewrite physical joint result');
  assert.equal(p.finalMass,finalMass);if(finalMass){assert.equal(out.words[d.applicationControl+A.finalMassAdopted],1);assert.equal(Object.isFrozen(out.sourceComponentCue),true);for(const [role,i]of [['shaft',0],['head',1]]){const at=d.bodies+(3+i)*64+59;assert.deepEqual(out.cue.cue[role].worldCom,Array.from(new Float32Array(out.words.buffer,(at+out.words.byteOffset/4)*4,3)));}}else{assert.equal(p.code.includes('rc_scene_three_app_final_mass'),false);assert.equal(Object.hasOwn(out,'sourceComponentCue'),false);}
  t.diagnostic(JSON.stringify({fixture:row.name,time:out.application.time,steps:out.application.steps,eventCount:out.application.events.length,cueFrame:out.cue.frame,innerSubstep:1,outerSteps:0,scope:'initial-source-application-boundary-not-native-whole-h'}));
 }
});
test('joint adoption and no-emission branch reject repeat, unknown events/cue contacts and missing physical predicates',()=>{
 const {app:p,out}=fixtures.find(x=>x.out.available),d=p.layout;
 for(const change of[a=>a[d.cue+C.header.needsSolve]=0,a=>a[d.input]++,a=>a[d.cueControl+CH.completed]=0]){const a=out.before.slice();change(a);assert.equal(threeBallFirstApplicationTestKernels(p,a).rc_scene_three_app_adopt(d.applicationControl,d.cue,d.cueControl,d.input,d.output),false);}
 for(const change of[a=>a[d.journal+J.header.events]=1,a=>a[d.journal+J.header.edges]=4,a=>a[d.journal+J.edgeOffset+1]++,a=>a[d.cue+43]=1,a=>a[d.caches+130]=0,a=>a[d.journal+J.colliderOffset+J.collider.cue]=1]){const a=out.afterPhysicalAdmission.slice();a[d.applicationControl+A.phase]=2;a[d.applicationControl+A.eventAdmission]=0;change(a);assert.equal(threeBallFirstApplicationTestKernels(p,a).rc_scene_three_app_observe_and_drain(d.applicationControl,d.cue,d.journal,d.caches),false);}
 const replay=out.words.slice();assert.equal(threeBallFirstApplicationTestKernels(p,replay).rc_scene_three_app_adopt(d.applicationControl,d.cue,d.cueControl,d.input,d.output),false);
});
test('copied/future history/clock/joint inputs and mutable output cannot enter source application authority',async()=>{
 const {app:p,out}=fixtures.find(x=>x.out.available);assert.throws(()=>createThreeBallFirstApplicationPlan(copy(p.physical)));assert.throws(()=>createThreeBallFirstApplicationPlan(p.physical,{}));await assert.rejects(executeThreeBallFirstApplicationForTest(p,{testOnly:true,history:[]}));assert.throws(()=>assertThreeBallFirstApplicationResult({...out},{plan:p}));const at=p.layout.applicationControl+20,old=out.words[at];out.words[at]^=1;assert.throws(()=>assertThreeBallFirstApplicationResult(out,{plan:p}),/mutated/);out.words[at]=old;assertThreeBallFirstApplicationResult(out,{plan:p});
 for(const value of [out.application,out.application.events,out.history,out.cue,out.cue.cue.shaft])assert.equal(Object.isFrozen(value),true);
 for(const field of ['program','prefixProgram']){const old=p[field][0];p[field][0]^=1;assert.throws(()=>assertThreeBallFirstApplicationPlan(p),/mutated/);p[field][0]=old;}assertThreeBallFirstApplicationPlan(p);
});
test('direct original PhysicsLab.step application-order witness stops after first inner h without completing outer step',()=>{
 const start=6.1197916666664,h=1/960/64,trace=[],stop=new Error('component boundary reached'),queue={drainCollisionEvents(callback){trace.push(['drain',lab.time]);}},lab={cue:{started:start},strokeSubsteps:64,dt:1/960,time:start,steps:5875,objects:[],events:[],queue,world:{integrationParameters:{dt:1/960},step(q){assert.equal(q,queue);trace.push(['world',lab.time]);}},compliantTipContact(dt){if(trace.length)throw stop;assert.equal(dt,h);trace.push(['tip',lab.time]);},observeCueObstructions(){trace.push(['observe',this.time]);},angularPatchResistance(dt){assert.equal(dt,h);trace.push(['patch',this.time]);},removeCue(){assert.fail('Initial source withdrawal must remain false');}};
 assert.throws(()=>globalThis.PhysicsLab.prototype.step.call(lab,1),e=>e===stop);assert.deepEqual(trace.map(r=>r[0]),['tip','world','observe','drain','patch']);assert.equal(trace[0][1],start);assert.equal(trace[1][1],start);for(const [,time]of trace.slice(2))assert.equal(time,start+h);assert.equal(lab.time,start+h);assert.equal(lab.steps,5875);assert.equal(lab.world.integrationParameters.dt,h);
 // This is a literal method call-order/Number witness with a no-physics world
 // stub. It is intentionally NOT a physically reachable or native-h trajectory.
});
