import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {certifySourceGeneralSlidingDomain,evaluateGeneralSlidingSegment} from '../src/direct-candidate/source-law-general-segment.mjs';
import {sourceLawNonaxialRHS} from '../src/direct-candidate/source-law-nonaxial-rhs.mjs';
import {sourceGravityRepresentation,capturePreparedSpinWorld,inspectSupportedSpinState} from '../src/direct-candidate/source-law-normal-spin.mjs';
import {prepareCollinearSegment,evaluateCollinearMotion} from '../src/direct-candidate/source-law-collinear-segment.mjs';
const budget=e=>({position:e,velocity:e,angular:e,attitude:e});
const flat=r=>[...r.position,...r.velocity,...r.angular];
const error=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
function rk4(body,material,duration,n){let y=[...body.position,...body.velocity,...body.angular],h=duration/n;const rhs=y=>{const r=sourceLawNonaxialRHS({...body,velocity:y.slice(3,6),angular:y.slice(6)},material);assert.equal(r.eligible,true);return [...r.positionDerivative,...r.velocityDerivative,...r.angularDerivative];};for(let i=0;i<n;i++){const a=rhs(y),b=rhs(y.map((x,j)=>x+h*a[j]/2)),c=rhs(y.map((x,j)=>x+h*b[j]/2)),d=rhs(y.map((x,j)=>x+h*c[j]));y=y.map((x,j)=>x+h*(a[j]+2*b[j]+2*c[j]+d[j])/6);}return y;}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const product=(a,b)=>{const c=cross(a,b);return [0,1,2].map(i=>a[3]*b[i]+b[3]*a[i]+c[i]).concat(a[3]*b[3]-a.slice(0,3).reduce((v,x,i)=>v+x*b[i],0));};
function rk4Attitude(body,material,duration,n){let y=[...body.velocity,...body.angular,...body.rotation],h=duration/n;const rhs=y=>{const w=y.slice(3,6),q=y.slice(6),r=sourceLawNonaxialRHS({...body,velocity:y.slice(0,3),angular:w},material);assert.equal(r.eligible,true);const dq=product([...w,0],q).map(x=>x/2);return [...r.velocityDerivative,...r.angularDerivative,...dq];};for(let i=0;i<n;i++){const a=rhs(y),b=rhs(y.map((x,j)=>x+h*a[j]/2)),c=rhs(y.map((x,j)=>x+h*b[j]/2)),d=rhs(y.map((x,j)=>x+h*c[j]));y=y.map((x,j)=>x+h*(a[j]+2*b[j]+2*c[j]+d[j])/6);}return y.slice(6);}
test('adaptive numerical segment requires native domain and reports exact work/estimated error only',{skip:!process.env.DIRECT_CUE_RAPIER_PATH},async t=>{
 const R=createRequire(import.meta.url)(process.env.DIRECT_CUE_RAPIER_PATH);await R.init();const context=vm.createContext({console});for(const name of ['math','physics'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),context);
 const make=(axial=false,rotate=false)=>{const lab=new context.PhysicsLab(R);lab.objects.forEach((o,i)=>{o.body.setTranslation({x:i===0?-.5:i===1?.4:.6,y:o.collider.radius(),z:i===2?.4:0},true);const v=axial?[.7,0,0]:[.7,0,-.4],w=axial?[0,2,-5]:[8,3,-5],rot=x=>rotate?[x[2],x[1],-x[0]]:x;const a=rot(v),b=rot(w);o.body.setLinvel({x:i===0?a[0]:0,y:0,z:i===0?a[2]:0},true);o.body.setAngvel({x:i===0?b[0]:0,y:i===0?b[1]:0,z:i===0?b[2]:0},true);});if(rotate)lab.objects[0].body.setRotation({x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2},true);lab.world.propagateModifiedBodyPositionsToColliders();return lab;};
 const lab=make(),duration=.04;try{
  assert.equal(evaluateGeneralSlidingSegment({},1,{errorBudget:budget(1e-6)}).eligible,false);
  const domain=certifySourceGeneralSlidingDomain(lab,duration,{preparedBoundary:true});assert.equal(domain.eligible,true,JSON.stringify(domain));assert.equal(domain.domainRHSEvaluations,1);
  const before=lab.world.takeSnapshot(),loose=evaluateGeneralSlidingSegment(domain,1,{errorBudget:budget(1e-5)}),tight=evaluateGeneralSlidingSegment(domain,1,{errorBudget:budget(1e-10)});
  for(const r of [loose,tight]){assert.equal(r.status,'completed-numerical-segment',JSON.stringify(r));assert.equal(r.errorBoundCertified,false);assert.equal(r.attitudeComplete,true);assert.equal(r.physicalShotAccepted,false);assert.ok(r.rhsEvaluations<=512);}
  const reference=rk4(domain.bodies[0],domain.materials[0],duration,512),reference2=rk4(domain.bodies[0],domain.materials[0],duration,1024),eLoose=error(flat(loose),reference2),eTight=error(flat(tight),reference2);
  assert.ok(eTight<eLoose);assert.ok(error(reference,reference2)<1e-11);assert.ok(eTight<1e-9);
  const qref=rk4Attitude(domain.bodies[0],domain.materials[0],duration,1024);assert.ok(error(tight.quaternion,qref)<1e-10);assert.equal(tight.normalizationApplied,false);assert.ok(Math.abs(tight.quaternionNormDrift)<1e-10);
  const capped=evaluateGeneralSlidingSegment(domain,1,{errorBudget:budget(1e-12),maxEvaluations:7});assert.equal(capped.status,'incomplete');assert.ok(capped.rhsEvaluations<=7);
  assert.deepEqual(lab.world.takeSnapshot(),before);
  const longDomain=certifySourceGeneralSlidingDomain(lab,.25,{preparedBoundary:true});assert.equal(longDomain.eligible,true);const nearBoundary=evaluateGeneralSlidingSegment(longDomain,1,{errorBudget:budget(1e-6),maxEvaluations:96});assert.equal(nearBoundary.status,'incomplete');assert.ok(nearBoundary.time<.25);assert.ok(nearBoundary.angular[1]>0);assert.ok(nearBoundary.rhsEvaluations<=96);
  const rotated=make(false,true);try{const d=certifySourceGeneralSlidingDomain(rotated,duration,{preparedBoundary:true}),r=evaluateGeneralSlidingSegment(d,1,{errorBudget:budget(1e-10)});assert.equal(r.status,'completed-numerical-segment');const rot=x=>[x[2],x[1],-x[0]];assert.ok(error(r.velocity,rot(tight.velocity))<1e-12);assert.ok(error(r.angular,rot(tight.angular))<1e-12);assert.ok(error(r.quaternion,product(d.bodies[0].rotation,tight.quaternion))<1e-11);const qr=rk4Attitude(d.bodies[0],d.materials[0],duration,1024);assert.ok(error(r.quaternion,qr)<1e-10);}finally{rotated.world.free();rotated.queue.free();}
  t.diagnostic(JSON.stringify({duration,looseRhs:loose.rhsEvaluations,tightRhs:tight.rhsEvaluations,sourceWholeStepsEquivalent:duration/lab.dt,domainRhs:domain.domainRHSEvaluations,geometryTests:domain.geometryTests,eLoose,eTight,referenceRefinementDelta:error(reference,reference2),quaternionError:error(tight.quaternion,qref),quaternionNormDrift:tight.quaternionNormDrift,notCertified:true}));
  lab.objects[0].body.setLinvel({x:30,y:0,z:0},true);assert.equal(certifySourceGeneralSlidingDomain(lab,.2,{preparedBoundary:true}).eligible,false);
 }finally{lab.world.free();lab.queue.free();}
 const axial=make(true);try{const d=certifySourceGeneralSlidingDomain(axial,.02,{preparedBoundary:true}),r=evaluateGeneralSlidingSegment(d,1,{errorBudget:budget(1e-10)}),exact=evaluateCollinearMotion(prepareCollinearSegment(d.bodies[0],d.materials[0]),.02);assert.equal(r.status,'completed-numerical-segment');assert.ok(error(flat(r),flat(exact))<1e-12);const beta=5*d.materials[0].gravity*d.materials[0].spinLength/(2*d.bodies[0].radius**2);assert.ok(Math.abs(r.angular[1]-(d.bodies[0].angular[1]-beta*.02))<1e-12);}finally{axial.world.free();axial.queue.free();}
 const fixed=make(true);try{
  const o=fixed.objects[0];o.body.setAngvel({x:0,y:0,z:-5},true);o.body.setRotation({x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2},true);
  const d=certifySourceGeneralSlidingDomain(fixed,.02,{preparedBoundary:true}),r=evaluateGeneralSlidingSegment(d,1,{errorBudget:budget(1e-11)}),segment=prepareCollinearSegment(d.bodies[0],d.materials[0]);
  const theta=d.bodies[0].angular[2]*.02+segment.angularAcceleration[2]*.02**2/2,qExact=product([0,0,Math.sin(theta/2),Math.cos(theta/2)],d.bodies[0].rotation);
  assert.equal(r.status,'completed-numerical-segment');assert.ok(error(r.quaternion,qExact)<1e-11);assert.ok(Math.abs(r.quaternionNormDrift)<1e-11);assert.equal(r.normalizationApplied,false);
 }finally{fixed.world.free();fixed.queue.free();}

 for(const [normal,zeroDrag]of [[-5.72e-30,false],[-1e-45,false],[-.05,false],[-.05,true]]){const spinning=make();try{
  if(zeroDrag)spinning.setParams({spinLength:0});const o=spinning.objects[0],w=o.body.angvel();o.body.setAngvel({...w,y:normal},true);
  const d=certifySourceGeneralSlidingDomain(spinning,.02,{preparedBoundary:true}),r=evaluateGeneralSlidingSegment(d,1,{errorBudget:budget(1e-10)});assert.equal(r.status,'completed-numerical-segment',JSON.stringify(r));assert.equal(r.angular[1],zeroDrag?o.body.angvel().y:0);assert.equal(r.normalSpinStopProcessed,!zeroDrag);assert.ok(r.rhsEvaluations<=512);assert.ok(Number.isFinite(r.quaternionNorm));
 }finally{spinning.dispose();}}
 const represented=make();let restored;try{
  const freshGravity=sourceGravityRepresentation(represented);restored=context.PhysicsLab.fromSnapshot(R,represented.snapshot());
  assert.deepEqual(sourceGravityRepresentation(restored),freshGravity);assert.equal(freshGravity.matched,true);assert.equal(freshGravity.normalLoadGravity,Math.fround(9.81));assert.equal(freshGravity.patchCapGravity,9.81);
  const d=certifySourceGeneralSlidingDomain(restored,.02,{preparedBoundary:true});assert.equal(d.eligible,true,JSON.stringify(d));
  represented.setParams({gravity:9.7});const down=capturePreparedSpinWorld(represented,{preparedBoundary:true});assert.equal(down.material.normalLoadGravity,Math.fround(9.7));assert.equal(down.material.patchCapGravity,9.7);assert.equal(down.material.gravity,Math.fround(9.7));
  restored.objects[0].body.setTranslation({...restored.objects[0].body.translation(),y:restored.objects[0].radius-.00006},true);restored.world.propagateModifiedBodyPositionsToColliders();assert.equal(certifySourceGeneralSlidingDomain(restored,.02,{preparedBoundary:true}).eligible,false);assert.equal(inspectSupportedSpinState(capturePreparedSpinWorld(restored,{preparedBoundary:true})).eligible,false);
  represented.world.gravity={x:0,y:-9.8,z:0};assert.equal(sourceGravityRepresentation(represented).matched,false);
 }finally{represented.dispose();restored?.dispose();}

});
