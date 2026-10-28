import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {nextDown} from '../src/direct-candidate/conservative-pair-cull.mjs';
import {descendingLandingTime,predictPreparedLandingEvent} from '../src/direct-candidate/source-law-landing-event.mjs';
test('descending ballistic root handles upward apex, downward motion, and invalid arithmetic',()=>{
 assert.equal(descendingLandingTime(1,0,2),1);
 assert.equal(descendingLandingTime(3,2,2),3);
 assert.equal(descendingLandingTime(3,-2,2),1);
 for(const args of [[0,1,9.81],[-1,0,9.81],[1,0,0],[1,Infinity,9.81],[1,1e308,9.81],[Number.MIN_VALUE,0,Number.MIN_VALUE]])assert.equal(descendingLandingTime(...args),null);
});
test('native scene landing prediction excludes hulls and moving pairs without mutating source',{skip:!process.env.DIRECT_CUE_RAPIER_PATH},async()=>{
 const R=createRequire(import.meta.url)(process.env.DIRECT_CUE_RAPIER_PATH);await R.init();
 const context=vm.createContext({console});for(const f of ['math','physics'])vm.runInContext(readFileSync(new URL('../src/'+f+'.js',import.meta.url),'utf8'),context);
 const make=()=>{const lab=new context.PhysicsLab(R);for(const [i,o]of lab.objects.entries()){o.body.setTranslation({x:(i-1)*.4,y:.15+i*.03,z:0},true);o.body.setLinvel({x:0,y:0,z:0},true);o.body.setAngvel({x:0,y:0,z:0},true);}lab.world.propagateModifiedBodyPositionsToColliders();lab.step(1);return lab;};
 const lab=make();try{
  assert.equal(predictPreparedLandingEvent(lab).eligible,false);
  const before=lab.world.takeSnapshot(),result=predictPreparedLandingEvent(lab,{preparedBoundary:true});assert.equal(result.eligible,true,JSON.stringify(result));assert.equal(result.event.kind,'cloth-landing-candidate');assert.equal(result.event.bodyIds[0],lab.objects[0].id);assert.ok(result.boundTests>0);assert.deepEqual(lab.world.takeSnapshot(),before);
  const short=predictPreparedLandingEvent(lab,{preparedBoundary:true,maxDuration:.001});assert.equal(short.event.kind,'geometry-or-observation-horizon');assert.equal(short.event.time,.001);
  lab.objects[0].body.setLinvel({x:8,y:0,z:0},true);lab.objects[1].body.setLinvel({x:-8,y:0,z:0},true);
  const pair=predictPreparedLandingEvent(lab,{preparedBoundary:true});assert.equal(pair.eligible,true);assert.equal(pair.event.kind,'geometry-or-observation-horizon');assert.ok(pair.halvings>0);
  lab.objects[0].body.addForce({x:1,y:0,z:0},true);assert.equal(predictPreparedLandingEvent(lab,{preparedBoundary:true}).eligible,false);
 }finally{lab.world.free();lab.queue.free();}
 const rail=make();try{
  rail.objects[2].body.setLinvel({x:20,y:0,z:0},true);const r=predictPreparedLandingEvent(rail,{preparedBoundary:true});assert.equal(r.eligible,true);assert.equal(r.event.kind,'geometry-or-observation-horizon');assert.ok(r.halvings>0);
  rail.objects[2].collider.setContactSkin(.001);assert.equal(predictPreparedLandingEvent(rail,{preparedBoundary:true}).eligible,false);
 }finally{rail.world.free();rail.queue.free();}
 const edge=make();try{
  for(const [i,o]of edge.objects.entries()){const p=o.body.translation();o.body.setTranslation({x:p.x,y:i===0?.26400265097618103:.7,z:p.z},true);o.body.setLinvel({x:0,y:i===0?-.3007453978061676:0,z:0},true);}edge.world.propagateModifiedBodyPositionsToColliders();
  const duration=nextDown(descendingLandingTime(edge.objects[0].body.translation().y-edge.objects[0].collider.radius(),edge.objects[0].body.linvel().y,Math.fround(edge.params.gravity))),r=predictPreparedLandingEvent(edge,{preparedBoundary:true,maxDuration:duration});assert.equal(r.eligible,true);assert.equal(r.prefixExcludesClothContact,true);assert.ok(r.event.time<duration,'Rounded numerical landing time must not certify penetration as a safe prefix');
 }finally{edge.world.free();edge.queue.free();}
 const tied=make();try{
  for(const o of tied.objects){const p=o.body.translation();o.body.setTranslation({x:p.x,y:.2,z:p.z},true);o.body.setLinvel({x:0,y:0,z:0},true);}tied.world.propagateModifiedBodyPositionsToColliders();
  const r=predictPreparedLandingEvent(tied,{preparedBoundary:true});assert.equal(r.eligible,true);assert.equal(r.simultaneousLandingCandidates,true);assert.equal(r.event.bodyIds.length,3);
 }finally{tied.world.free();tied.queue.free();}
 const active=new context.PhysicsLab(R);try{assert.equal(predictPreparedLandingEvent(active,{preparedBoundary:true}).eligible,false);for(const o of active.objects){const p=o.body.translation();o.body.setTranslation({x:p.x,y:.2,z:p.z},true);}active.world.propagateModifiedBodyPositionsToColliders();assert.equal(predictPreparedLandingEvent(active,{preparedBoundary:true}).reason,'active-native-contact');}finally{active.world.free();active.queue.free();}
});
