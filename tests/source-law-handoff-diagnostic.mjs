// One forward-slip contact handoff, observed at a bounded set of source steps.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {precomputeSourceCandidateEvent} from '../src/direct-candidate/source-law-candidate-evaluator.mjs';
import {advancePreparedAxialPrefix} from '../src/direct-candidate/source-law-axial-advance.mjs';
const R=createRequire(import.meta.url)(process.env.DIRECT_CUE_RAPIER_PATH??fileURLToPath(new URL('../vendor/rapier.cjs',import.meta.url)));await R.init();
const context=vm.createContext({console});for(const name of ['math','physics'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),context);
const vector=v=>[v.x,v.y,v.z];
const state=lab=>lab.objects.map(o=>({id:o.id,position:vector(o.body.translation()),velocity:vector(o.body.linvel()),angular:vector(o.body.angvel()),sleeping:o.body.isSleeping()}));
function make(){const lab=new context.PhysicsLab(R);lab.objects.forEach((o,i)=>{o.body.setTranslation({x:i===0?-.2:i===1?-.06:.5,y:Math.fround(o.radius),z:i===2?.5:0},true);o.body.setLinvel({x:i===0?1:0,y:0,z:0},true);o.body.setAngvel({x:0,y:0,z:i===0?-.2/o.radius:0},true);o.lastPos={...o.body.translation()};});lab.world.propagateModifiedBodyPositionsToColliders();return lab;}
function contacts(lab,c1,c2){const manifolds=[];lab.world.contactPair(c1,c2,(m,flipped)=>{const points=[];for(let k=0;k<m.numContacts();k++)points.push({distance:m.contactDist(k),normalImpulse:m.contactImpulse(k),tangentImpulseX:m.contactTangentImpulseX(k),tangentImpulseY:m.contactTangentImpulseY(k),local1:vector(m.localContactPoint1(k)),local2:vector(m.localContactPoint2(k))});const solverPoints=[];for(let k=0;k<m.numSolverContacts();k++)solverPoints.push(vector(m.solverContactPoint(k)));manifolds.push({flipped,normal:vector(m.normal()),friction:m.friction(),points,solverPoints});});return manifolds;}
function observeSteps(lab,jumpFrames,frames,anchorFrames=jumpFrames){
 const rows=[],cloth=lab.statics.find(o=>o.kind==='cloth'),worldStep=lab.world.step.bind(lab.world),patch=lab.angularPatchResistance.bind(lab);let pending=null,firstImpactRecorded=false;
 const torques=lab.objects.map(()=>[0,0,0]);
 lab.objects.forEach((o,i)=>{const apply=o.body.applyTorqueImpulse.bind(o.body);o.body.applyTorqueImpulse=(v,wake)=>{torques[i]=torques[i].map((x,k)=>x+[v.x,v.y,v.z][k]);return apply(v,wake);};});
 lab.world.step=(...args)=>{
  const frame=lab.steps+1,pre=state(lab),result=worldStep(...args),post=state(lab),pair=contacts(lab,lab.objects[0].pairCollider,lab.objects[1].pairCollider),impact=pair.some(m=>m.points.some(p=>p.normalImpulse>0));
  const selected=frame===jumpFrames||(frame>jumpFrames&&frame<=jumpFrames+2)||(frame>=anchorFrames&&frame<=anchorFrames+4)||(impact&&!firstImpactRecorded);
  if(impact&&!firstImpactRecorded)firstImpactRecorded=true;
  pending=selected?{frame,time:lab.time+lab.world.integrationParameters.dt,preWorld:pre,postWorld:post,pair,cloth:lab.objects.slice(0,2).map(o=>contacts(lab,o.collider,cloth.collider)),firstPositivePairImpact:impact&&rows.every(r=>!r.firstPositivePairImpact)}:null;
  return result;
 };
 lab.angularPatchResistance=h=>{patch(h);if(pending){pending.postPatch=state(lab);pending.patchTorques=torques.map(t=>[...t]);pending.worldDeltas=pending.postWorld.map((b,i)=>({id:b.id,linear:b.velocity.map((x,k)=>x-pending.preWorld[i].velocity[k]),angular:b.angular.map((x,k)=>x-pending.preWorld[i].angular[k])}));pending.patchDeltas=pending.postPatch.map((b,i)=>({id:b.id,angular:b.angular.map((x,k)=>x-pending.postWorld[i].angular[k])}));rows.push(pending);}torques.forEach((_,i)=>torques[i]=[0,0,0]);pending=null;};
 lab.step(frames);return rows;
}
const start=performance.now(),hybrid=make(),reference=make();
try{
 const earlierFrames=Number(process.env.SOURCE_LAW_HANDOFF_EARLY_FRAMES??0);assert.ok([0,4,8,16].includes(earlierFrames),'Bounded earlier-handoff study only');
 const predicted=precomputeSourceCandidateEvent(hybrid,{duration:.1,preparedBoundary:true});assert.equal(predicted.eligible,true);const baselinePrefixFrames=Math.floor(predicted.event.time/hybrid.dt)-1;
 const prefix=advancePreparedAxialPrefix(hybrid,earlierFrames?baselinePrefixFrames-earlierFrames:96,{preparedBoundary:true});assert.equal(prefix.advanced,true);assert.equal(prefix.frames,baselinePrefixFrames-earlierFrames);
 const hybridAtJump=state(hybrid),hybridRows=observeSteps(hybrid,prefix.frames,96-prefix.frames,baselinePrefixFrames),referenceRows=observeSteps(reference,prefix.frames,96,baselinePrefixFrames);
 const receipt={kind:'bounded-original-contact-handoff-observation',wallMs:performance.now()-start,earlierFrames,baselinePrefixFrames,originalSteps:96-prefix.frames,prefixFrames:prefix.frames,prefixDuration:prefix.duration,hybridAtJump,hybridRows,referenceRows,hybridEndpoint:state(hybrid),referenceEndpoint:state(reference),productionEnabled:false,acceptanceClaim:false};
 if(process.env.SOURCE_LAW_HANDOFF_RECEIPT)writeFileSync(process.env.SOURCE_LAW_HANDOFF_RECEIPT,JSON.stringify(receipt,null,2)+'\n');
 const summarize=rows=>rows.map(r=>({frame:r.frame,time:r.time,preSleep:r.preWorld.slice(0,2).map(b=>b.sleeping),preOmega:r.preWorld[0].angular[2],postOmega:r.postPatch[0].angular[2],worldDelta:r.worldDeltas.slice(0,2),cloth:r.cloth.map(ms=>({contacts:ms.reduce((s,m)=>s+m.points.length,0),normal:ms.flatMap(m=>m.points).reduce((s,p)=>s+p.normalImpulse,0),tangentX:ms.flatMap(m=>m.points).reduce((s,p)=>s+p.tangentImpulseX,0),tangentY:ms.flatMap(m=>m.points).reduce((s,p)=>s+p.tangentImpulseY,0)})),pair:r.pair.flatMap(m=>m.points).map(p=>({n:p.normalImpulse,tx:p.tangentImpulseX,ty:p.tangentImpulseY})),patch:r.patchDeltas.slice(0,2)}));
 console.log(JSON.stringify({wallMs:receipt.wallMs,earlierFrames,prefixFrames:prefix.frames,originalSteps:96-prefix.frames,hybridEndpoint:state(hybrid),referenceEndpoint:state(reference),hybridAtJump:hybridAtJump[0],hybrid:summarize(hybridRows),reference:summarize(referenceRows)},null,2));
}finally{hybrid.world.free();hybrid.queue.free();reference.world.free();reference.queue.free();}
