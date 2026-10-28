import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {prepareCollinearSegment,evaluateCollinearMotion} from '../src/direct-candidate/source-law-collinear-segment.mjs';
import {evaluateAxialAttitude,advancePreparedAxialPrefix} from '../src/direct-candidate/source-law-axial-advance.mjs';
import {evaluatePreparedSourceLawCandidate} from '../src/direct-candidate/source-law-candidate-evaluator.mjs';
const material={gravity:9.81,clothFriction:.2,rollingLength:.00045,spinLength:.00035},radius=.03075;
test('fixed-axis quaternion integrates angular acceleration in world coordinates',()=>{
 const body={id:1,position:[0,radius,0],velocity:[1,0,0],angular:[0,0,-.2/radius],radius,mass:.21,provenance:'prepared-flat-constant-load'};
 const s=prepareCollinearSegment(body,material),t=.02,q=evaluateAxialAttitude(s,[0,0,0,1],t),angle=body.angular[2]*t+s.angularAcceleration[2]*t*t/2;
 assert.ok(Math.abs(q[2]-Math.sin(angle/2))<1e-14);assert.ok(Math.abs(q[3]-Math.cos(angle/2))<1e-14);
 const t45=Math.SQRT1_2,rotated=evaluateAxialAttitude(s,[0,t45,0,t45],t),sn=Math.sin(angle/2),cs=Math.cos(angle/2);
 const independent=[-sn*t45,cs*t45,sn*t45,cs*t45];rotated.forEach((x,i)=>assert.ok(Math.abs(x-independent[i])<1e-14));
 const changing=prepareCollinearSegment({...body,angular:[0,1,body.angular[2]]},material);assert.throws(()=>evaluateAxialAttitude(changing,[0,0,0,1],.001),/Changing-axis/);
});
test('bounded opt-in axial candidates skip original steps before contacts and resume real source response',{skip:!process.env.DIRECT_CUE_RAPIER_PATH},async t=>{
 const R=createRequire(import.meta.url)(process.env.DIRECT_CUE_RAPIER_PATH);await R.init();const context=vm.createContext({console});for(const file of ['math','physics'])vm.runInContext(readFileSync(new URL('../src/'+file+'.js',import.meta.url),'utf8'),context);
 const make=mode=>{
  const lab=new context.PhysicsLab(R),near=mode==='near-rail',moving=mode==='moving-pair',draw=mode==='draw',reverse=mode==='reversal';
  lab.objects.forEach((o,i)=>{o.body.setTranslation({x:near?(i===0?1.3:i===1?0:-.6):(i===0?-.2:i===1?-.06:.5),y:Math.fround(o.radius),z:i===2?.5:0},true);o.body.setLinvel({x:i===0?(reverse?.01:1):moving&&i===1?-.5:0,y:0,z:0},true);o.body.setAngvel({x:0,y:0,z:i===0?(draw||reverse?1:-.2)/o.radius:moving&&i===1?.1/o.radius:0},true);o.lastPos={...o.body.translation()};});lab.world.propagateModifiedBodyPositionsToColliders();return lab;
 };
 const observe=lab=>lab.objects.map(o=>({p:o.body.translation(),v:o.body.linvel(),w:o.body.angvel(),q:o.body.rotation()}));
 const delta=(a,b)=>{const result={position:0,velocity:0,angular:0,orientationComponent:0};a.forEach((x,i)=>{for(const [name,key]of [['position','p'],['velocity','v'],['angular','w']])result[name]=Math.max(result[name],Math.hypot(...['x','y','z'].map(k=>x[key][k]-b[i][key][k])));result.orientationComponent=Math.max(result.orientationComponent,...['x','y','z','w'].map(k=>Math.abs(x.q[k]-b[i].q[k])));});return result;};
 const kinetic=lab=>lab.objects.reduce((sum,o)=>{const v=o.body.linvel(),w=o.body.angvel();return sum+.5*o.mass*(v.x*v.x+v.y*v.y+v.z*v.z)+.2*o.mass*o.radius*o.radius*(w.x*w.x+w.y*w.y+w.z*w.z);},0);
 const contactTrace=lab=>lab.events.filter(e=>e.kind==='contact').map(e=>({time:e.time,a:e.a?.id??null,b:e.b?.id??null,kindA:e.a?.kind,kindB:e.b?.kind}));
 const phases=lab=>lab.objects.map(o=>{const v=o.body.linvel(),w=o.body.angvel();return {id:o.id,velocity:[v.x,v.y,v.z],angular:[w.x,w.y,w.z],slip:[v.x+o.radius*w.z,v.z-o.radius*w.x]};});
 const watchPairImpulses=lab=>{const timeline=[],step=lab.world.step.bind(lab.world);lab.world.step=(...args)=>{const result=step(...args);for(let i=0;i<lab.objects.length;i++)for(let j=i+1;j<lab.objects.length;j++){let impulse=0;lab.world.contactPair(lab.objects[i].pairCollider,lab.objects[j].pairCollider,m=>{for(let k=0;k<m.numContacts();k++)impulse+=Math.max(0,m.contactImpulse(k));});if(impulse>0)timeline.push({time:lab.time+lab.world.integrationParameters.dt,i,j,normalImpulse:impulse});}return result;};return timeline;};
 const receipts=[];
 for(const mode of ['forward-slip','draw','near-rail','moving-pair','reversal']){
  const lab=make(mode),reference=make(mode);try{
   const impulseTrace=mode==='forward-slip'?watchPairImpulses(lab):null,referenceImpulseTrace=mode==='forward-slip'?watchPairImpulses(reference):null;
   const beforeEnergy=kinetic(lab),start=performance.now();reference.step(96);const referenceMs=performance.now()-start;
   const result=evaluatePreparedSourceLawCandidate(lab,{frames:96,enabled:true,preparedBoundary:true,advanceTranslation:true,diagnostics:true});
   assert.ok(result.counters.axialFrames>0,mode+JSON.stringify(result));assert.ok(result.counters.actualWorldStepCalls<96);assert.equal(result.counters.axialFrames+result.counters.originalFrames,96);assert.equal(lab.steps,96);assert.ok(Math.abs(lab.time-.1)<1e-14);assert.equal(result.pass,null);
   if(mode==='reversal'){let expected=0,previous=0;const velocity=Math.fround(.01),acceleration=-Math.fround(reference.params.gravity)*reference.objects[0].collider.friction()*reference.statics.find(o=>o.kind==='cloth').collider.friction();for(let k=1;k<=96;k++){const time=k*lab.dt,position=velocity*time+acceleration*time*time/2;expected+=Math.abs(position-previous);previous=position;}assert.ok(Math.abs(lab.objects[0].distance-expected)<1e-14);assert.ok(lab.objects[0].distance>Math.abs(previous));}
   const afterEnergy=kinetic(lab);assert.ok(afterEnergy<=beforeEnergy,mode+' total kinetic energy must dissipate');
   const records=result.records.filter(r=>r.path==='axial-analytic');assert.ok(records.every(r=>r.afterEnergy<=r.beforeEnergy&&r.pairBoundTests>=3&&r.contactResolved===false));
   assert.ok(observe(lab).every(b=>Object.values(b).every(v=>Object.values(v).every(Number.isFinite))));
   const beforeResume=delta(observe(lab),observe(reference)),windowContacts={candidate:contactTrace(lab),reference:contactTrace(reference)},windowPhases={candidate:phases(lab),reference:phases(reference)},firstPositivePairImpulses=impulseTrace?{candidate:impulseTrace.slice(0,3),reference:referenceImpulseTrace.slice(0,3)}:null;const fallback=evaluatePreparedSourceLawCandidate(lab,{frames:24});reference.step(24);assert.equal(fallback.counters.actualWorldStepCalls,24);
   receipts.push({mode,counters:result.counters,wallMs:result.wallMs,referenceMs,beforeEnergy,afterEnergy,finiteStepEndpointDelta:beforeResume,windowContacts,windowPhases,firstPositivePairImpulses,timingIncludesContactObserver:!!impulseTrace,after24OriginalFallbackSteps:delta(observe(lab),observe(reference)),prefixes:records});
  }finally{lab.world.free();lab.queue.free();}
 }
 // A genuinely changing angular axis still uses all original physics.
 const rejected=make('forward-slip');try{rejected.objects[0].body.setAngvel({x:0,y:1,z:-.2/radius},true);const r=evaluatePreparedSourceLawCandidate(rejected,{frames:24,enabled:true,preparedBoundary:true,advanceTranslation:true});assert.equal(r.counters.axialFrames,0);assert.equal(r.counters.actualWorldStepCalls,24);}finally{rejected.world.free();rejected.queue.free();}
 t.diagnostic(JSON.stringify({preparedOnly:true,fullShot:false,receipts}));
 if(process.env.SOURCE_LAW_AXIAL_RECEIPT)writeFileSync(process.env.SOURCE_LAW_AXIAL_RECEIPT,JSON.stringify({preparedOnly:true,fullShot:false,cacheIdentityClaim:false,receipts},null,2)+'\n');
});
