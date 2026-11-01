/** Experimental numerical segment only: DP5(4) error ESTIMATES, not proofs.
 * No world mutation, contact response or whole-shot acceptance.
 */
import {sourceLawNonaxialRHS} from './source-law-nonaxial-rhs.mjs';
import {capturePreparedSpinWorld,sourceGravityRepresentation} from './source-law-normal-spin.mjs';
import {actualStaticColliderBounds,sweptSphereBounds3D} from './source-geometry-horizon.mjs';
import {nextUp,nextDown} from './conservative-pair-cull.mjs';
const domains=new WeakSet(),zero=a=>a.every(x=>x===0),vector=v=>[v.x,v.y,v.z];
const separated=(a,b)=>a.some((r,k)=>r[1]<b[k][0]||r[0]>b[k][1]);
const fail=reason=>({eligible:false,status:'unsupported',reason,rhsEvaluations:0,trajectoryAdvanced:false});
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
/** Snapshot certificate: native geometry + force-magnitude envelopes, not an
 * RK trajectory estimate. Never authority to mutate a later changed world.
 */
export function certifySourceGeneralSlidingDomain(lab,duration,{preparedBoundary=false}={}){return buildDomain(lab,duration,{preparedBoundary});}
export function createExperimentalRetainedSupportDomain(lab,duration,{enabled=false}={}){return enabled?buildDomain(lab,duration,{preparedBoundary:true,retained:true}):fail('retained-support-opt-in-required');}
function buildDomain(lab,duration,{preparedBoundary=false,retained=false}={}){
 let domainRHSEvaluations=0,geometryTests=0;const reject=reason=>({...fail(reason),domainRHSEvaluations,geometryTests});
 if(!preparedBoundary||!Number.isFinite(duration)||duration<=0)return reject('unverified-domain');
 const captured=capturePreparedSpinWorld(lab,{preparedBoundary:true});
 if(captured.externalDynamics||captured.cue||captured.jointCount||!captured.support||captured.balls.length!==lab.objects.length)return reject('unsupported-world');
 const cloth=lab.statics.find(o=>o.kind==='cloth'),support=actualStaticColliderBounds(cloth,lab.R);if(!support)return reject('unsupported-support');
 const top=cloth.collider.translation().y+cloth.collider.halfExtents().y,materials=[],bodies=[],bounds=[],supportEvidence=[];let movingBodies=0;
 for(let i=0;i<lab.objects.length;i++){
  const o=lab.objects[i],b=captured.balls[i],radius=o.collider.radius();
  if(b.forced||b.constrained||b.damped||b.otherContact||b.velocity[1]!==0||(!retained&&b.position[1]!==top+radius)||o.collider.frictionCombineRule()!==lab.R.CoefficientCombineRule.Multiply||cloth.collider.frictionCombineRule()!==lab.R.CoefficientCombineRule.Multiply||[o.collider,o.pairCollider].some(c=>c.shapeType()!==lab.R.ShapeType.Ball||c.radius()!==radius||vector(c.translation()).some((x,k)=>x!==b.position[k])))return reject('unsupported-prepared-body');
  const gravity=sourceGravityRepresentation(lab);
  const material={gravity:lab.params.gravity,normalLoadGravity:gravity.normalLoadGravity,patchCapGravity:gravity.patchCapGravity,clothFriction:o.collider.friction()*cloth.collider.friction(),rollingLength:lab.params.rollingLength,spinLength:lab.params.spinLength};
  const body={...b,mass:o.mass,radius:o.radius,collisionRadius:radius,provenance:'prepared-flat-constant-load'},stationary=zero(b.velocity)&&zero(b.angular);
  if(retained){
   if(!stationary&&o.body.isSleeping())return reject('moving-body-sleeping');
   if(stationary&&!o.body.isSleeping())return reject('passive-body-not-asleep');
   if(!stationary&&++movingBodies>1)return reject('multiple-moving-bodies-unqualified');
   const bottom=cloth.collider.translation().y-cloth.collider.halfExtents().y;
   if(!(b.position[1]>nextUp(top)&&b.position[1]-radius<=top&&nextDown(b.position[1]-radius)>nextUp(bottom)))return reject('not-native-top-face-intersection');
   let points=0,impulse=0,vertical=true;
   lab.world.contactPair(o.collider,cloth.collider,(m,flipped)=>{const n=m.normal(),up=flipped?n.y:-n.y;if(n.x!==0||n.z!==0||up!==1)vertical=false;for(let j=0;j<m.numContacts();j++){points++;const distance=m.contactDist(j),savedImpulse=m.contactImpulse(j);if(!Number.isFinite(distance)||!Number.isFinite(savedImpulse))vertical=false;impulse+=Math.max(0,savedImpulse);if(!stationary&&distance>0)vertical=false;}});
   if(!vertical||points!==1||!Number.isFinite(impulse)||!(impulse>0))return reject('missing-vertical-native-support');
   supportEvidence.push({id:b.id,retainedY:b.position[1],gap:b.position[1]-top-radius,observedNormalImpulse:impulse,passiveSleepingManifoldMayBeHistorical:stationary,futureLoadCertified:false});
  }
  if(!stationary&&((domainRHSEvaluations++),!sourceLawNonaxialRHS(body,material).eligible))return reject('unsupported-motion-regime');
  const a=stationary?0:nextUp(material.clothFriction*material.normalLoadGravity);
  if(!Number.isFinite(a))return reject('invalid-force-bound');
  const high=sweptSphereBounds3D({...body,radius},[a,0,a],duration),low=sweptSphereBounds3D({...body,radius},[-a,0,-a],duration);
  if(!high||!low)return reject('invalid-motion-envelope');
  const bound=high.map((r,k)=>[Math.min(r[0],low[k][0]),Math.max(r[1],low[k][1])]);
  for(const k of [0,2]){const key=k===0?'x':'z',p=cloth.collider.translation()[key],h=cloth.collider.halfExtents()[key];if(bound[k][0]<=nextUp(p-h)||bound[k][1]>=nextDown(p+h))return reject('finite-support-horizon');}
  bodies.push(body);materials.push(material);bounds.push(bound);
 }
 for(const object of lab.statics)if(object!==cloth){const obstacle=actualStaticColliderBounds(object,lab.R);if(!obstacle)return reject('unsupported-native-hull');for(const bound of bounds){geometryTests++;if(!separated(bound,obstacle.bounds))return reject('native-hull-preemption');}}
 for(let i=0;i<bounds.length;i++)for(let j=0;j<i;j++){geometryTests++;if(!separated(bounds[i],bounds[j]))return reject('moving-pair-preemption');}
 if(retained&&movingBodies!==1)return reject('one-moving-body-required');
 const result=freeze({eligible:true,kind:retained?'experimental-retained-native-support-domain':'prepared-source-force-bounded-geometry-domain',supportEvidence,continuumContactMode:retained?'conditional-persistent-flat-spherical-support':'prepared-ideal-support',futureNativeLoadCertified:false,nativeBridgeQualified:false,duration,bodies,materials,bounds,geometryTests,domainRHSEvaluations,sceneTime:lab.time,sourceRevision:lab.revision,liveWorldAuthority:false});domains.add(result);return result;
}
// Dormand–Prince explicit 5(4), seven directly evaluated stages per attempt.
const C=[0,1/5,3/10,4/5,8/9,1,1];
const A=[[],[1/5],[3/40,9/40],[44/45,-56/15,32/9],[19372/6561,-25360/2187,64448/6561,-212/729],[9017/3168,-355/33,46732/5247,49/176,-5103/18656],[35/384,0,500/1113,125/192,-2187/6784,11/84]];
const B5=[35/384,0,500/1113,125/192,-2187/6784,11/84,0],B4=[5179/57600,0,7571/16695,393/640,-92097/339200,187/2100,1/40];
export function evaluateGeneralSlidingSegment(domain,bodyId,{duration=domain?.duration,errorBudget,maxEvaluations=512}={}){
 if(!domains.has(domain)||!Number.isFinite(duration)||duration<=0||duration>domain.duration)return fail('missing-or-invalid-geometry-domain');
 if(!errorBudget||!['position','velocity','angular','attitude'].every(k=>Number.isFinite(errorBudget[k])&&errorBudget[k]>0)||!Number.isInteger(maxEvaluations)||maxEvaluations<7||maxEvaluations>100000)return fail('invalid-error-or-work-budget');
 const index=domain.bodies.findIndex(b=>b.id===bodyId);if(index<0)return fail('unknown-body');
 const body=domain.bodies[index],inside=state=>state.slice(0,3).every((x,k)=>Number.isFinite(x)&&nextDown(x-body.collisionRadius)>=domain.bounds[index][k][0]&&nextUp(x+body.collisionRadius)<=domain.bounds[index][k][1]),material=domain.materials[index],initial=sourceLawNonaxialRHS(body,material);if(!initial.eligible)return {...fail(initial.reason),rhsEvaluations:1};
 const normalStop=initial.normalSpinStopTime,beta=Math.abs(initial.angularDerivative[1]),initialNormal=body.angular[1];
 const normalAt=t=>t===0?initialNormal:t>=normalStop?0:Math.sign(initialNormal)*Math.max(0,Math.abs(initialNormal)-beta*t);
 const initialQuaternionNorm=Math.hypot(...body.rotation);
 if(!Number.isFinite(initialQuaternionNorm)||initialQuaternionNorm===0)return fail('invalid-initial-attitude');
 let y=[...body.position,...body.velocity,...body.angular,...body.rotation],time=0,h=duration,calls=1,accepted=0,rejected=0;
 const groups=[[0,1,2],[3,4,5],[6,7,8],[9,10,11,12]],estimated=[0,0,0,0],budget=[errorBudget.position,errorBudget.velocity,errorBudget.angular,errorBudget.attitude];
 const finish=(status,reason)=>({eligible:true,status,reason,time,position:y.slice(0,3),velocity:y.slice(3,6),angular:y.slice(6,9),quaternion:y.slice(9,13),quaternionNorm:Math.hypot(...y.slice(9,13)),initialQuaternionNorm,quaternionNormDrift:Math.hypot(...y.slice(9,13))-initialQuaternionNorm,normalizationApplied:false,normalLoadGravity:material.normalLoadGravity??material.gravity,patchCapGravity:material.patchCapGravity??material.gravity,normalSpinStopTime:normalStop,normalSpinStopTimeUnderflow:initial.normalSpinStopTimeUnderflow,normalSpinStopProcessed:Number.isFinite(normalStop)&&time>0&&time>=normalStop,attitudeBudgetUnits:'absolute-quaternion-component',rhsEvaluations:calls,acceptedSteps:accepted,rejectedSteps:rejected,estimatedAccumulatedError:{position:estimated[0],velocity:estimated[1],angular:estimated[2],attitude:estimated[3]},errorBoundCertified:false,regimeGuardIsLocal:true,attitudeComplete:true,physicalShotAccepted:false,worldMutated:false,geometryDomainDuration:domain.duration});
 const rhs=state=>{if(!inside(state))return null;calls++;const r=sourceLawNonaxialRHS({...body,position:state.slice(0,3),velocity:state.slice(3,6),angular:state.slice(6,9)},material);if(!r.eligible)return null;
  const [wx,wy,wz]=state.slice(6,9),[qx,qy,qz,qw]=state.slice(9,13);
  // World angular velocity: LEFT quaternion multiplication. No normalization
  // of stages/endpoints; caller sees raw component error and norm drift.
  const dq=[(wx*qw+wy*qz-wz*qy)/2,(-wx*qz+wy*qw+wz*qx)/2,(wx*qy-wy*qx+wz*qw)/2,-(wx*qx+wy*qy+wz*qz)/2];
  return dq.every(Number.isFinite)?{r,dy:[...r.positionDerivative,...r.velocityDerivative,...r.angularDerivative,...dq]}:null;};
 while(time<duration){
  if(calls+7>maxEvaluations)return finish('incomplete','rhs-budget');
  h=Math.min(h,duration-time);
  if(normalStop>time&&normalStop<time+h)h=normalStop-time;if(!(time+h>time))return finish('incomplete','nonprogressing-time');
  const k=[],start=rhs(y);if(!start)return finish('incomplete','regime-boundary');k.push(start.dy);
  // Conservative directional-change approach guard, not event root isolation.
  const r=body.radius,mu=material.clothFriction,g=material.normalLoadGravity??material.gravity,patchG=Math.min(g,material.patchCapGravity??material.gravity);
  const mul=(a,b)=>nextUp(a*b),add=(a,b)=>nextUp(a+b),div=(a,b)=>nextUp(a/b);
  const rollingBound=div(mul(5,mul(patchG,material.rollingLength)),nextDown(2*nextDown(r*r)));
  const slipRateBound=add(mul(3.5,mul(mu,g)),mul(r,rollingBound)),tangentRateBound=add(div(mul(2.5,mul(mu,g)),r),rollingBound);
  // L-infinity lower norms, using outward slip arithmetic rather than trusting
  // rounded cancellation or a rounded Euclidean norm as a lower bound.
  const lowerAbs=(lo,hi)=>lo>0?lo:hi<0?-hi:0;
  const wx=y[6],wz=y[8],vx=y[3],vz=y[5];
  const ux=[nextDown(vx+nextDown(r*wz)),nextUp(vx+nextUp(r*wz))],uz=[nextDown(vz-nextUp(r*wx)),nextUp(vz-nextDown(r*wx))];
  const slipLower=Math.max(lowerAbs(...ux),lowerAbs(...uz)),tangentLower=Math.max(Math.abs(wx),Math.abs(wz));
  const guard=Math.min(slipRateBound>0?nextDown(slipLower/slipRateBound):Infinity,tangentRateBound>0?nextDown(tangentLower/tangentRateBound):Infinity);
  if(!Number.isFinite(guard)&&guard!==Infinity)return finish('incomplete','invalid-boundary-guard');
  if(h>=guard/2){h=guard/4;rejected++;if(!(time+h>time))return finish('incomplete','boundary-approach');continue;}
  let invalid=false;
  for(let stage=1;stage<7;stage++){
   const state=y.map((x,j)=>x+h*A[stage].reduce((s,a,i)=>s+a*k[i][j],0));
   state[7]=normalAt(time+C[stage]*h);
   const next=rhs(state);if(!next){invalid=true;break;}k.push(next.dy);
  }
  if(invalid){h/=2;rejected++;continue;}
  const high=y.map((x,j)=>x+h*B5.reduce((s,b,i)=>s+b*k[i][j],0)),low=y.map((x,j)=>x+h*B4.reduce((s,b,i)=>s+b*k[i][j],0));
  high[7]=normalAt(time+h);low[7]=high[7];
  if(!high.every(Number.isFinite)||!low.every(Number.isFinite)||!Number.isFinite(Math.hypot(...high.slice(9,13)))||!inside(high))return finish('incomplete','nonfinite-stage');
  const error=groups.map(group=>Math.max(...group.map(j=>Math.abs(high[j]-low[j]))));
  const ratio=Math.max(...error.map((e,i)=>e===0?0:e/(budget[i]*h/duration)));
  if(!Number.isFinite(ratio))return finish('incomplete','unrepresentable-error-estimate');
  const reachesNormalStop=ratio<=1&&time<normalStop&&time+h>=normalStop;
  if(ratio<=1){y=high;time+=h;accepted++;error.forEach((e,i)=>estimated[i]+=e);}else rejected++;
  if(reachesNormalStop){h=duration-time;continue;}
  h*=ratio===0?2:Math.max(.1,Math.min(2,.9*ratio**(-1/5)));
 }
 return finish('completed-numerical-segment','estimated-budget-met');
}
