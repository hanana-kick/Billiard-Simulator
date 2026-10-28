// One ORIGINAL raw post-cue window. No projection, load forcing or guard change.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {writeFileSync} from 'node:fs';
import '../src/math.js';import '../src/physics.js';import '../src/game-rules.js';import '../src/render-cadence.js';import '../src/controller.js';
import {sourceLawNonaxialRHS} from '../src/direct-candidate/source-law-nonaxial-rhs.mjs';
import {sourceGravityRepresentation} from '../src/direct-candidate/source-law-normal-spin.mjs';
import {sweptSphereBounds3D,actualStaticColliderBounds} from '../src/direct-candidate/source-geometry-horizon.mjs';
import {nextUp,nextDown} from '../src/direct-candidate/conservative-pair-cull.mjs';
const R=createRequire(import.meta.url)(process.env.DIRECT_CUE_RAPIER_PATH??new URL('../vendor/rapier.cjs',import.meta.url).pathname);await R.init();
const endpoint=l=>{const o=l.objects[0];return {position:{...o.body.translation()},velocity:{...o.body.linvel()},angular:{...o.body.angvel()},rotation:{...o.body.rotation()}};};
const c=new globalThis.LabController(),start=performance.now();
try{
 c.lab=new globalThis.PhysicsLab(R);c.state.gameMode='four';c.setupGame();
 for(const p of [{id:1,x:-.5,z:0},{id:2,x:-.8,z:.4},{id:3,x:.0435,z:.0435},{id:4,x:.2615,z:-.2}])assert.equal(c.move(p.id,{x:p.x,y:c.lab.get(p.id).radius+.00005,z:p.z}),true);
 let preparation=0;while(preparation<2000&&!c.lab.objects.every(o=>o.body.isSleeping())){c.lab.step();preparation++;}assert.ok(c.lab.objects.every(o=>o.body.isSleeping()));
 const lab=c.lab;assert.equal(lab.strike(1,{angle:0,elevation:8,speed:2,tipX:0,tipY:0},{saveSnapshot:false}).ok,true);let cueOuters=0;while(lab.cue&&cueOuters<300){lab.step();cueOuters++;}assert.equal(lab.cue,null);
 const body=lab.objects[0],cloth=lab.statics.find(o=>o.kind==='cloth'),top=cloth.collider.translation().y+cloth.collider.halfExtents().y;
 const state=()=>({position:{...body.body.translation()},velocity:{...body.body.linvel()},angular:{...body.body.angvel()},rotation:{...body.body.rotation()}}),initial=state(),snapshot=lab.snapshot({trails:false}),rows=[];
 let prePatch=null,patchImpulse=[0,0,0];const patch=lab.angularPatchResistance.bind(lab),apply=body.body.applyTorqueImpulse.bind(body.body);
 body.body.applyTorqueImpulse=(v,wake)=>{patchImpulse=patchImpulse.map((x,k)=>x+[v.x,v.y,v.z][k]);return apply(v,wake);};lab.angularPatchResistance=h=>{prePatch=state();return patch(h);};
 for(let i=0;i<24;i++){
  patchImpulse=[0,0,0];
  const before=state();lab.step();let normalImpulse=0,friction=null,normals=[],contacts=[],solverPoints=[];lab.world.contactPair(body.collider,cloth.collider,(m,flipped)=>{normals.push({normal:{...m.normal()},flipped});friction=m.friction();for(let k=0;k<m.numContacts();k++){normalImpulse+=Math.max(0,m.contactImpulse(k));contacts.push({local1:{...m.localContactPoint1(k)},local2:{...m.localContactPoint2(k)},distance:m.contactDist(k),tangentX:m.contactTangentImpulseX(k),tangentY:m.contactTangentImpulseY(k)});}for(let k=0;k<m.numSolverContacts();k++)solverPoints.push({...m.solverContactPoint(k)});});
  let otherImpulse=0;lab.world.contactPairsWith(body.pairCollider,other=>lab.world.contactPair(body.pairCollider,other,m=>{for(let k=0;k<m.numContacts();k++)otherImpulse+=Math.max(0,m.contactImpulse(k));}));
  const after=state();rows.push({outer:i+1,time:lab.time,gap:after.position.y-top-body.collider.radius(),deltaY:after.position.y-before.position.y,velocityY:after.velocity.y,normalImpulse,loadRatio:normalImpulse/(body.mass*lab.params.gravity*lab.dt),normals,contacts,solverPoints,inverseInertia:Array.from(body.body.effectiveWorldInvInertia().elements).slice(0,6),nativeMass:body.body.mass(),before,prePatch,patchImpulse,friction,otherImpulse,state:after});
 }
 const receipt={kind:'single-original-raw-postcue-support-window',wallMs:performance.now()-start,preparationSteps:preparation,constructorSteps:72,cueOuters,observedSourceSteps:24,duration:24*lab.dt,initial,rows,summary:{deltaY:rows.at(-1).state.position.y-initial.position.y,maxAbsVy:Math.max(...rows.map(r=>Math.abs(r.velocityY))),loadRatioMin:Math.min(...rows.map(r=>r.loadRatio)),loadRatioMax:Math.max(...rows.map(r=>r.loadRatio)),otherImpulse:rows.reduce((s,r)=>s+r.otherImpulse,0)},sourceSnapshotBytes:snapshot.world.byteLength,noStateProjection:true,noRuntimeAdmission:true};


 const accounting=rows.map(r=>{const lever=r.before.position.y-r.solverPoints[0].y,velocityProxy=r.nativeMass*(r.prePatch.velocity.x-r.before.velocity.x),coulombBudget=-r.friction*r.normalImpulse,inv=r.inverseInertia[5];return {lever,velocityProxy,coulombBudget,actualWorldAngular:r.prePatch.angular.z-r.before.angular.z,fromVelocityProxyWithRadius:body.radius*velocityProxy*inv,fromVelocityProxyWithPoint:lever*velocityProxy*inv,fromSaturatedBudgetWithRadius:body.radius*coulombBudget*inv,fromSaturatedBudgetWithPoint:lever*coulombBudget*inv};});
 const sum=key=>accounting.reduce((s,r)=>s+r[key],0);receipt.contactGeometryAccounting={leverMin:Math.min(...accounting.map(r=>r.lever)),leverMax:Math.max(...accounting.map(r=>r.lever)),sums:Object.fromEntries(Object.keys(accounting[0]).filter(k=>k!=='lever').map(k=>[k,sum(k)])),velocityProxyIsNotMeasuredSolverImpulse:true,saturatedBudgetIsAnAssumption:true,postStepPointIsNotProvenEntireSolverHistory:true,torqueLawChanged:false};
 // Authorized diagnostic clones: retained actual height/caches, never ideal-plane
 // placement. The existing production/prepared geometry guard is NOT changed.
 assert.ok(rows.every(r=>r.velocityY===0&&r.otherImpulse===0&&r.normalImpulse===rows[0].normalImpulse&&r.normals.every(n=>n.normal.x===0&&n.normal.z===0&&Math.abs(n.normal.y)===1)),'Paired diagnostic requires the observed flat constant-load/no-other-contact window');
 const original=globalThis.PhysicsLab.fromSnapshot(R,snapshot),hybrid=globalThis.PhysicsLab.fromSnapshot(R,snapshot);
 try{
  const duration=24*lab.dt,ob=hybrid.objects[0],gravity=sourceGravityRepresentation(hybrid),mu=ob.collider.friction()*hybrid.statics.find(o=>o.kind==='cloth').collider.friction();
  const material={gravity:hybrid.params.gravity,normalLoadGravity:gravity.normalLoadGravity,patchCapGravity:gravity.patchCapGravity,clothFriction:mu,rollingLength:hybrid.params.rollingLength,spinLength:hybrid.params.spinLength};
  const vec=v=>[v.x,v.y,v.z],motion=hybrid.objects.map(o=>({id:o.id,position:vec(o.body.translation()),velocity:vec(o.body.linvel()),angular:vec(o.body.angvel()),radius:o.radius,mass:o.mass,rotation:Object.values(o.body.rotation()),provenance:'prepared-flat-constant-load'}));
  assert.ok(hybrid.objects.slice(1).every(o=>o.body.isSleeping()&&[o.body.linvel(),o.body.angvel()].every(v=>v.x===0&&v.y===0&&v.z===0)),'Stationary passive sphere envelope assumption');
  const bounds=motion.map((b,i)=>{const a=i===0?nextUp(mu*gravity.normalLoadGravity):0,radius=hybrid.objects[i].collider.radius(),hi=sweptSphereBounds3D({...b,radius},[a,0,a],duration),lo=sweptSphereBounds3D({...b,radius},[-a,0,-a],duration);return hi.map((r,k)=>[Math.min(r[0],lo[k][0]),Math.max(r[1],lo[k][1])]);});
  const separate=(a,b)=>a.some((r,k)=>r[1]<b[k][0]||r[0]>b[k][1]);let geometryTests=0;
  for(let i=0;i<bounds.length;i++)for(let j=0;j<i;j++){geometryTests++;assert.ok(separate(bounds[i],bounds[j]));}
  for(const o of hybrid.statics)if(o.kind!=='cloth'){const b=actualStaticColliderBounds(o,R);assert.ok(b);for(const a of bounds){geometryTests++;assert.ok(separate(a,b.bounds));}}
  const cp=cloth.collider.translation(),half=cloth.collider.halfExtents();for(const b of bounds)for(const k of [0,2]){const key=k===0?'x':'z';assert.ok(b[k][0]>nextUp(cp[key]-half[key])&&b[k][1]<nextDown(cp[key]+half[key]));}
  function integrate(n){const b=motion[0],r0=sourceLawNonaxialRHS(b,material);assert.ok(r0.eligible);const stop=r0.normalSpinStopTime,beta=Math.abs(r0.angularDerivative[1]),wn=b.angular[1];let evaluations=1,y=[...b.position,...b.velocity,...b.angular,...b.rotation];
   const rhs=(y,t)=>{evaluations++;const w=y.slice(6,9);w[1]=t===0?wn:t>=stop?0:Math.sign(wn)*Math.max(0,Math.abs(wn)-beta*t);const r=sourceLawNonaxialRHS({...b,velocity:y.slice(3,6),angular:w},material);assert.ok(r.eligible);const [qx,qy,qz,qw]=y.slice(9),[wx,wy,wz]=w;return [...r.positionDerivative,...r.velocityDerivative,...r.angularDerivative,(wx*qw+wy*qz-wz*qy)/2,(-wx*qz+wy*qw+wz*qx)/2,(wx*qy-wy*qx+wz*qw)/2,-(wx*qx+wy*qy+wz*qz)/2];};
   const edges=stop>0&&stop<duration?[0,stop,...Array.from({length:n},(_,i)=>stop+(duration-stop)*(i+1)/n)]:Array.from({length:n+1},(_,i)=>duration*i/n);
   for(let i=1;i<edges.length;i++){const t=edges[i-1],h=edges[i]-t,a=rhs(y,t),b1=rhs(y.map((x,j)=>x+h*a[j]/2),t+h/2),c1=rhs(y.map((x,j)=>x+h*b1[j]/2),t+h/2),d=rhs(y.map((x,j)=>x+h*c1[j]),t+h);y=y.map((x,j)=>x+h*(a[j]+2*b1[j]+2*c1[j]+d[j])/6);y[7]=edges[i]>=stop?0:Math.sign(wn)*Math.max(0,Math.abs(wn)-beta*edges[i]);}
   return {state:y,evaluations};
  }
  const numerical=integrate(64),check=integrate(128),out=numerical.state;
  let originalCalls=0,hybridCalls=0;const os=original.world.step.bind(original.world),hs=hybrid.world.step.bind(hybrid.world);original.world.step=(...a)=>{originalCalls++;return os(...a);};hybrid.world.step=(...a)=>{hybridCalls++;return hs(...a);};
  original.step(24);const originalAtPrefix=endpoint(original),initialY=ob.body.translation().y,initialVy=ob.body.linvel().y;
  ob.body.setTranslation({x:out[0],y:initialY,z:out[2]},false);ob.body.setLinvel({x:out[3],y:initialVy,z:out[5]},false);ob.body.setAngvel({x:out[6],y:out[7],z:out[8]},false);ob.body.setRotation({x:out[9],y:out[10],z:out[11],w:out[12]},false);hybrid.world.propagateModifiedBodyPositionsToColliders();hybrid.time=original.time;hybrid.steps+=24;
  const hybridAtPrefix=endpoint(hybrid),resumed=[];
  for(let i=0;i<6;i++){original.step();hybrid.step();const observe=l=>{const o=l.objects[0];let impulse=0;const cloth=l.statics.find(o=>o.kind==='cloth');l.world.contactPair(o.collider,cloth.collider,m=>{for(let k=0;k<m.numContacts();k++)impulse+=Math.max(0,m.contactImpulse(k));});return {state:endpoint(l),normalImpulse:impulse};};resumed.push({step:i+1,original:observe(original),hybrid:observe(hybrid)});}
  receipt.pairedRetainedSupport={kind:'diagnostic-only-conditional-supported-law',geometryTests,sourcePrefixFrames:24,sourceResumeFrames:6,originalCalls,hybridCalls,rhsEvaluations:numerical.evaluations,referenceRhsEvaluations:check.evaluations,numericalRefinementDelta:Math.max(...out.map((x,k)=>Math.abs(x-check.state[k]))),originalAtPrefix,hybridAtPrefix,resumed,originalHeightRetained:hybridAtPrefix.position.y===initialY,originalVerticalVelocityRetained:hybridAtPrefix.velocity.y===initialVy,noNativeCacheInjection:true,noRuntimeGuardRelaxation:true};
 }finally{original.dispose();hybrid.dispose();}
 receipt.wallMs=performance.now()-start;
 if(process.env.SOURCE_LAW_LIVE_SUPPORT_RECEIPT)writeFileSync(process.env.SOURCE_LAW_LIVE_SUPPORT_RECEIPT,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({wallMs:receipt.wallMs,summary:receipt.summary,first:rows[0],last:rows.at(-1),paired:receipt.pairedRetainedSupport},null,2));
}finally{clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab?.dispose();}
