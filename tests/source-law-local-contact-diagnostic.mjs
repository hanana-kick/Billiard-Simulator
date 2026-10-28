// One forward-slip contact handoff, observed at a bounded set of source steps.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {advancePreparedAxialPrefix} from '../src/direct-candidate/source-law-axial-advance.mjs';
const R=createRequire(import.meta.url)(process.env.DIRECT_CUE_RAPIER_PATH??fileURLToPath(new URL('../vendor/rapier.cjs',import.meta.url)));await R.init();
const context=vm.createContext({console});for(const name of ['math','physics'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),context);
const vector=v=>[v.x,v.y,v.z];
const state=lab=>lab.objects.map(o=>({id:o.id,position:vector(o.body.translation()),velocity:vector(o.body.linvel()),angular:vector(o.body.angvel()),sleeping:o.body.isSleeping()}));
function make(){const lab=new context.PhysicsLab(R);lab.objects.forEach((o,i)=>{o.body.setTranslation({x:i===0?-.2:i===1?-.06:.5,y:Math.fround(o.radius),z:i===2?.5:0},true);o.body.setLinvel({x:i===0?1:0,y:0,z:0},true);o.body.setAngvel({x:0,y:0,z:i===0?-.2/o.radius:0},true);o.lastPos={...o.body.translation()};});lab.world.propagateModifiedBodyPositionsToColliders();return lab;}
// Refinement is confined to source frames 82–88; both branches reach frame 81
// by their existing route. No state/force injection after the prepared fixture.
const h=1/960,start=performance.now(),runs=[];
for(const refinement of [1,2,4])for(const mode of ['original','hybrid']){
 const lab=make();try{
  let calls=0;const step=lab.world.step.bind(lab.world);lab.world.step=(...a)=>{calls++;return step(...a);};
  if(mode==='hybrid'){const result=advancePreparedAxialPrefix(lab,96,{preparedBoundary:true});assert.equal(result.frames,81);}else lab.step(81);
  const preparationCalls=calls,cloth=lab.statics.find(s=>s.kind==='cloth').collider,o=lab.objects[0],body=o.body;
  assert.deepEqual(vector(cloth.rotation()).slice(0,3),[0,0,0]);
  const top=cloth.translation().y+cloth.halfExtents().y,radius=o.collider.radius();
  const rows=[];let torque=[0,0,0];const apply=body.applyTorqueImpulse.bind(body);body.applyTorqueImpulse=(v,w)=>{torque=torque.map((x,k)=>x+vector(v)[k]);return apply(v,w);};
  const impulses=(a,b)=>{let n=0;lab.world.contactPair(a,b,m=>{for(let i=0;i<m.numContacts();i++)n+=Math.max(0,m.contactImpulse(i));});return n;};
  const patch=lab.angularPatchResistance.bind(lab);let pre;
  lab.angularPatchResistance=dt=>{
   const postWorld=state(lab)[0],clothImpulse=impulses(o.collider,cloth),pairImpulse=lab.objects.slice(1).reduce((s,b)=>s+impulses(o.pairCollider,b.pairCollider),0);
   patch(dt);const after=state(lab)[0],gap=after.position[1]-top-radius,vy=after.velocity[1],g=lab.params.gravity;
   // A conditional ballistic reference, never permission to skip a native step.
   // Subsequent observed impulses invalidate its flight interval below.
   const root=gap>0&&clothImpulse===0&&pairImpulse===0?(vy+Math.sqrt(vy*vy+2*g*gap))/g:null;
   rows.push({time:lab.time,dt,gap,clothImpulse,pairImpulse,state:after,worldDeltaVelocity:postWorld.velocity.map((x,k)=>x-pre.velocity[k]),worldDeltaAngular:postWorld.angular.map((x,k)=>x-pre.angular[k]),patchTorque:torque,ballisticLandingDelay:root});torque=[0,0,0];
  };
  const advance=(dt,n)=>{lab.dt=dt;for(let i=0;i<n;i++){pre=state(lab)[0];lab.step(1);}};
  advance(h/refinement,7*refinement);const contactWindowEnd=state(lab);advance(h,8);
  for(let i=0;i<rows.length;i++)if(rows[i].ballisticLandingDelay!==null){const r=rows[i],landing=rows.slice(i+1).find(x=>x.clothImpulse>0),intervening=rows.slice(i+1).find(x=>x.pairImpulse>0&&x.time<=r.time+r.ballisticLandingDelay);r.flightReference={predictedTime:r.time+r.ballisticLandingDelay,nextClothImpulseTime:landing?.time??null,invalidatedByPairImpulse:Boolean(intervening),authority:'conditional observed-flight reference; not a runtime certificate'};}
  runs.push({mode,refinement,nativeSupport:{top,radius},work:{constructorSteps:72,preparationCalls,localContactCalls:7*refinement,remainderCalls:8,totalNativeCallsExcludingConstructor:calls,totalIncludingConstructor:calls+72,analyticSkippedSteps:mode==='hybrid'?81:0},windowStart:81*h,windowEnd:88*h,contactWindowEnd,endpoint:state(lab),rows});
 }finally{lab.world.free();lab.queue.free();}
 assert.ok(performance.now()-start<55000);
}
const receipt={kind:'bounded-original-3d-local-contact-refinement',wallMs:performance.now()-start,productionEnabled:false,finestIsTruth:false,runs};
if(process.env.SOURCE_LAW_LOCAL_CONTACT_RECEIPT)writeFileSync(process.env.SOURCE_LAW_LOCAL_CONTACT_RECEIPT,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({wallMs:receipt.wallMs,runs:runs.map(r=>({mode:r.mode,refinement:r.refinement,work:r.work,endpoint:r.endpoint[0],minGap:Math.min(...r.rows.map(x=>x.gap)),pairTimes:r.rows.filter(x=>x.pairImpulse>0).map(x=>x.time),clothImpulse:r.rows.reduce((s,x)=>s+x.clothImpulse,0),patchTorqueZ:r.rows.reduce((s,x)=>s+x.patchTorque[2],0)}))},null,2));
