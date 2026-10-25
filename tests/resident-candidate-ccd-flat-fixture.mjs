// TEST ONLY: the same genuine registered four-ball/current-active-body
// component fixture as resident-candidate-ccd.mjs. Expected source endpoints
// never enter a device buffer. This is not a physical full-h solver fixture.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CCD_LAYOUT,createCcdPrograms} from '../src/resident-candidate/ccd.mjs';
const require=createRequire(import.meta.url),M=require('../src/experimental-ccd-sweep-math.js'),S=require('../src/experimental-ccd-substep.js');
const floatsToWords=a=>new Uint32Array(Float32Array.from(a).buffer);
export async function registeredCcdFlatFixture(){
 const {originalRegisteredFixture}=await import('./resident-candidate-original-fixture.mjs');
 const {packRegisteredCcdSeed,packWorldCcdBody,packCcdBody}=await import('../src/resident-candidate/ccd.mjs');
 const {BVH_LAYOUT,BVH_SCRATCH_WORDS,packBvhState,unpackBvhState}=await import('../src/resident-candidate/bvh.mjs');
 const B=require('../src/experimental-ccd-bvh-state.js'),Broad=require('../src/experimental-cue-broad-phase.js'),Graph=require('../src/experimental-arithmetic-graph.js'),F=require('../src/experimental-ccd-fixed-sphere.js');
 const {seed}=await originalRegisteredFixture(),packed=packRegisteredCcdSeed(seed),raw=seed.cueInitial.sourceCreation.created;
 assert.deepEqual(packed.pointCounts,[8,22]);assert.deepEqual(packed.bodyKeys,seed.balls.map(b=>b.body.index+':'+b.body.generation));
 const bvh=await B.createReferenceStage({...seed.cueBroadSeed,sourcePipelineCompleted:true}),fixed=F.createReferenceStage(packed.source);
 const ownership={generations:Array.from({length:27},(_,i)=>seed.cueBroadSeed.colliders.find(c=>c.handle.index===i)?.handle.generation??null),removableLeaves:[24,25,26],freshOrder:seed.cueBroadSeed.modifiedColliders.map(h=>h.index),firstUpdate:true,initialLeaves:24,minimumLeaves:24,maximumLeaves:27};
 const initialBvh=packBvhState(bvh.snapshot(),ownership),same=(a,b)=>a.index===b.index&&a.generation===b.generation;
 const fresh=seed.cueBroadSeed.modifiedColliders.map(h=>{const c=seed.cueBroadSeed.colliders.find(c=>same(c.handle,h)),body=same(c.parent.handle,seed.cueBroadSeed.roles.shaft)?seed.cueInitial.cue.shaft:seed.cueInitial.cue.head,input=new Float32Array(24);input.set(body.translation);input.set(body.rotation,3);input.set(c.parent.pos_wrt_parent.translation,7);input[10]=c.shape.value.radius;input[11]=c.shape.value.half_height??0;input[12]=Number(c.shape.variant==='Cylinder');input[20]=seed.cueBroadSeed.lengthUnit;input[21]=seed.cueBroadSeed.normalizedPredictionDistance;const out=Graph.execute(input,Broad.PLANS.bounds);return{leaf:h.index,box:{min:Array.from(out.slice(0,3)),max:Array.from(out.slice(3,6))},skin:Math.fround(Math.fround(.04)*seed.cueBroadSeed.lengthUnit)};});
 const removed=[24,25,26],live=Array.from({length:27},(_,i)=>i),remaining=live.filter(i=>!removed.includes(i));
 // This is an independently captured CURRENT active-body predicate input, not
 // its native predicted endpoint. Other bodies and the full static roster are
 // the authenticated registered four-ball seed. It is a component probe only.
 const q=require('./fixtures/active-ccd/original-e35-prediction.json'),m=q.massProperties,ii=m.effective_world_inv_inertia;
 const active={kind:'dynamic-body-ccd-check',bodyType:'dynamic',sleeping:false,softFrame:false,ccdEnabled:true,maxCcdSubsteps:4,softCcdPrediction:0,linear:q.velocities.linvel,angular:q.velocities.angvel,translation:q.position.translation,rotation:q.position.rotation,force:q.forces.force,torque:q.forces.torque,invMass:m.effective_inv_mass,invInertia:[ii.m11,ii.m12,ii.m13,ii.m12,ii.m22,ii.m23,ii.m13,ii.m23,ii.m33],localCom:m.local_mprops.local_com,dt:q.nativeDt,maxExtent:m.max_extent,ccdThickness:q.ccd.ccd_thickness};
 const programs=createCcdPrograms({pointCounts:packed.pointCounts}),state=Array(CCD_LAYOUT.words).fill(0),put=a=>{const at=state.length;state.push(...a);return at;};
 seed.balls.forEach((ball,i)=>{const data=i===0?packCcdBody(active,{principalFrame:m.local_mprops.principal_inertia_local_frame,invPrincipalInertia:m.local_mprops.inv_principal_inertia,sleeping:false}):packWorldCcdBody(ball.state);for(let j=0;j<data.length;j++)state[CCD_LAYOUT.body+i*CCD_LAYOUT.bodyWords+j]=data[j];});
 const bvhAt=put(initialBvh),scratchAt=put(Array(BVH_SCRATCH_WORDS).fill(0)),seedAt=put(packed.words),freshAt=put(fresh.flatMap(r=>[r.leaf,...floatsToWords([...r.box.min,...r.box.max,r.skin])])),removedAt=put(removed),liveAt=put(live),remainingAt=put(remaining),statusesAt=put(Array(27).fill(0)),activeAt=put([0]);
 const initCommandsAt=put([freshAt,3,0,0,0,0,liveAt,27,statusesAt,0,0,removedAt,3,0,0,remainingAt,24,statusesAt]);
 try{
  bvh.begin();await bvh.prepareUpdate({updates:fresh,liveLeaves:live});await bvh.joinDeferredOptimize();bvh.commit();bvh.begin();await bvh.prepareUpdate({updates:[],removedLeaves:removed,liveLeaves:remaining});await bvh.joinDeferredOptimize();bvh.commit();const expectedBvh=bvh.snapshot();
  bvh.begin();const pre=await fixed.pre(active,seed.balls[0].body,{cuePresent:false,allDynamicBodiesAreOriginalBullets:true,bvhStage:bvh});assert.equal(pre.admitted,true);assert.equal(pre.activation.active,true);assert.ok(pre.fraction>0&&pre.fraction<1);
  const impact=M.reference('multiply',{a:pre.fraction,b:active.dt}).value,schedule=S.reference({remainingTime:active.dt,remainingSubsteps:4,minCcdDt:raw.integration.min_ccd_dt,firstImpact:impact});
  const prediction=M.reference('predictSphereCenter',{dt:Math.fround(active.dt*2),localCenter:active.localCom,translation:active.translation,linear:active.linear,force:active.force,invMass:active.invMass});
  const post=await fixed.post({...active,dt:schedule.dt,nextTranslation:prediction.c2,nextRotation:active.rotation},seed.balls[0].body,{cuePresent:false,allDynamicBodiesAreOriginalBullets:true,bvhStage:bvh});assert.equal(post.admitted,true);assert.ok(post.clampedPose,'original source endpoint probe must exercise an actual clamp');const inertia=M.reference('worldInvInertia',{rotation:post.clampedPose.rotation,principalFrame:m.local_mprops.principal_inertia_local_frame,invPrincipalInertia:m.local_mprops.inv_principal_inertia}).invInertia;
  const controlAt=put(Array(16).fill(0)),budgetAt=put([32768]);
  return {state:Uint32Array.from(state),programs,bvhAt,scratchAt,seedAt,initCommandsAt,activeAt,controlAt,budgetAt,
   dtWord:floatsToWords([active.dt])[0],minDtWord:floatsToWords([raw.integration.min_ccd_dt])[0],predictionDtWord:floatsToWords([Math.fround(active.dt*2)])[0],
   expected:{bvh:expectedBvh,pre,post,inertia,impact,schedule,dt:active.dt},sourceIdentity:raw.snapshotSha256};
 }finally{bvh.abort();bvh.dispose();fixed.dispose();}
}
