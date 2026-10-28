import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {sweptSphereBounds3D,predictSourcePreparedCollinearEvent} from '../src/direct-candidate/source-geometry-horizon.mjs';
test('3D swept bound includes intermediate reversal, not merely endpoints',()=>{
 const bound=sweptSphereBounds3D({position:[0,1,0],velocity:[4,0,0],radius:.1},[-8,0,0],1);
 assert.ok(bound[0][1]>=1.1);assert.ok(bound[1][0]<.9&&bound[1][1]>1.1);
 assert.equal(sweptSphereBounds3D({position:[0,1,0],velocity:[1e308,0,0],radius:.1},[1e308,0,0],1e308),null);
});
test('actual source hulls certify a prefix, then pair/regime events compete without scene mutation',{skip:!process.env.DIRECT_CUE_RAPIER_PATH},async t=>{
 const require=createRequire(import.meta.url),R=require(process.env.DIRECT_CUE_RAPIER_PATH);await R.init();
 const context=vm.createContext({console});for(const name of ['math','physics'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),context);
 const lab=new context.PhysicsLab(R);
 const prepare=(nearRail=false)=>{
  for(const [i,o] of lab.objects.entries()){
   const p=nearRail?[i===0?1.30:i===1?0:-.6,Math.fround(o.radius),i===2?.4:0]:[i===0?-.2:i===1?-.06:.5,Math.fround(o.radius),i===2?.5:0];
   o.body.setTranslation({x:p[0],y:p[1],z:p[2]},true);o.body.setLinvel({x:i===0?1:0,y:0,z:0},true);o.body.setAngvel({x:0,y:0,z:i===0?-.2/o.radius:0},true);
  }lab.world.propagateModifiedBodyPositionsToColliders();
  return lab.objects.map(o=>{const p=o.body.translation(),v=o.body.linvel(),w=o.body.angvel();return {id:o.id,position:[p.x,p.y,p.z],velocity:[v.x,v.y,v.z],angular:[w.x,w.y,w.z],radius:o.radius,mass:o.mass,provenance:'prepared-flat-constant-load'};});
 };
 try{
  let bodies=prepare(),before=JSON.stringify(bodies);
  const result=predictSourcePreparedCollinearEvent(lab,bodies,{duration:.2,preparedBoundary:true});assert.equal(result.eligible,true,JSON.stringify(result));assert.equal(result.event.kind,'pair');assert.equal(result.geometry.certified,true);assert.equal(result.geometry.actualStaticBounds.filter(x=>x.shape==='convex').length,8);assert.equal(result.geometry.actualStaticBounds.length,lab.statics.length-1);assert.equal(result.geometry.halvings,0);
  assert.equal(JSON.stringify(bodies),before);assert.equal(lab.time,0);
  const stats={pairEventTime:result.event.time,staticBounds:result.geometry.actualStaticBounds.length,boundEvaluations:result.geometry.boundEvaluations,staticTests:result.geometry.staticTests};
  // Far from all obstacles, a certified prefix ending exactly at slip-zero
  // must not become a fabricated simultaneous geometry collision.
  const isolated=prepare();isolated[1].position[0]=.4;lab.objects[1].body.setTranslation({x:.4,y:Math.fround(lab.objects[1].radius),z:0},true);lab.world.propagateModifiedBodyPositionsToColliders();isolated[1].position[0]=lab.objects[1].body.translation().x;
  const boundary=predictSourcePreparedCollinearEvent(lab,isolated,{duration:.2,preparedBoundary:true});assert.equal(boundary.eligible,true,JSON.stringify(boundary));assert.equal(boundary.event.kind,'regime-boundary');
  bodies=prepare(true);const near=predictSourcePreparedCollinearEvent(lab,bodies,{duration:.2,preparedBoundary:true});assert.equal(near.eligible,true,JSON.stringify(near));assert.equal(near.event.kind,'geometry-horizon');assert.ok(near.geometry.halvings>0);assert.ok(near.states[0].position[0]+bodies[0].radius<1.42);
  const rail=lab.statics.find(o=>o.kind==='cushion');rail.body.setRotation({x:0,y:Math.sin(.1),z:0,w:Math.cos(.1)},true);
  const rotated=predictSourcePreparedCollinearEvent(lab,bodies,{duration:.2,preparedBoundary:true});assert.equal(rotated.eligible,false);rail.body.setRotation({x:0,y:0,z:0,w:1},true);
  const stale=structuredClone(bodies);stale[0].position[0]-=.01;assert.equal(predictSourcePreparedCollinearEvent(lab,stale,{duration:.2,preparedBoundary:true}).reason,'stale-or-incomplete-motion-state');
  const primary=lab.objects[0].collider;primary.setFrictionCombineRule(R.CoefficientCombineRule.Max);assert.equal(predictSourcePreparedCollinearEvent(lab,bodies,{duration:.2,preparedBoundary:true}).reason,'non-source-friction-combine-rule');primary.setFrictionCombineRule(R.CoefficientCombineRule.Multiply);
  primary.setContactSkin(.001);assert.equal(predictSourcePreparedCollinearEvent(lab,bodies,{duration:.2,preparedBoundary:true}).eligible,false);primary.setContactSkin(0);
  lab.objects[0].body.addForce({x:1,y:0,z:0},true);assert.equal(predictSourcePreparedCollinearEvent(lab,bodies,{duration:.2,preparedBoundary:true}).reason,'unsupported-actual-motion-conditions');
  t.diagnostic(JSON.stringify({...stats,nearRailSafePrefix:near.geometry.duration,nearRailHalvings:near.geometry.halvings,hitTimeClaim:false,motionLawPreparedOnly:true,productionEnabled:false}));
 }finally{lab.world.free();lab.queue.free();}
});
