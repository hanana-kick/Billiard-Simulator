/** Original-law event PREDICTION only. No world mutation/contact response.
 * Domain: explicitly prepared scene of spherical ballistic flights and exact
 * stationary supported spheres. No sliding/rolling continuation is assumed.
 */
import {capturePreparedSpinWorld} from './source-law-normal-spin.mjs';
import {sweptSphereBounds3D,actualStaticColliderBounds} from './source-geometry-horizon.mjs';
import {nextUp,nextDown} from './conservative-pair-cull.mjs';
const fail=reason=>({eligible:false,reason});
const zero=a=>a.every(x=>x===0),finite=a=>a.every(Number.isFinite);
const separated=(a,b)=>a.some((r,k)=>r[1]<b[k][0]||r[0]>b[k][1]);
export function descendingLandingTime(gap,verticalVelocity,gravity){
 if(!finite([gap,verticalVelocity,gravity])||gap<=0||gravity<=0)return null;
 const discriminant=verticalVelocity*verticalVelocity+2*gravity*gap;
 if(!Number.isFinite(discriminant)||discriminant<=0)return null;
 const speed=Math.sqrt(discriminant);
 // Rationalized descending branch avoids cancellation for downward velocity.
 const time=verticalVelocity<0?2*gap/(speed-verticalVelocity):(verticalVelocity+speed)/gravity;
 return Number.isFinite(time)&&time>0&&verticalVelocity-gravity*time<0?time:null;
}
export function predictPreparedLandingEvent(lab,{preparedBoundary=false,maxDuration=1,maxHalvings=16}={}){
 if(!preparedBoundary)return fail('unverified-prepared-boundary');
 if(!Number.isFinite(maxDuration)||maxDuration<=0||!Number.isInteger(maxHalvings)||maxHalvings<0||maxHalvings>32)return fail('invalid-budget');
 let captured;try{captured=capturePreparedSpinWorld(lab,{preparedBoundary:true});}catch{return fail('unsupported-native-state');}
 if(!captured.support||captured.externalDynamics||captured.cue||captured.jointCount||captured.balls.length!==lab.objects.length)return fail('unsupported-world');
 const cloth=lab.statics.find(o=>o.kind==='cloth'),support=actualStaticColliderBounds(cloth,lab.R);
 if(!support)return fail('unsupported-support');
 const top=cloth.collider.translation().y+cloth.collider.halfExtents().y,g=captured.material.normalLoadGravity;
 if(!Number.isFinite(top)||!Number.isFinite(g)||g<=0)return fail('invalid-gravity-or-support');
 const motions=[],landings=[];
 for(let i=0;i<captured.balls.length;i++){
  const b=captured.balls[i],o=lab.objects[i];
  if(b.forced||b.constrained||b.damped||b.otherContact||!finite([...b.position,...b.velocity,...b.angular]))return fail('unsupported-body-dynamics');
  if([o.collider,o.pairCollider].some(c=>c.shapeType()!==lab.R.ShapeType.Ball||['x','y','z'].some((k,j)=>c.translation()[k]!==b.position[j])))return fail('unsupported-sphere-envelope');
  const radius=o.collider.radius();if(radius!==o.pairCollider.radius()||!(radius>0))return fail('unsupported-native-radius');
  const gap=b.position[1]-top-radius;
  if(gap===0&&zero(b.velocity)&&zero(b.angular)){
   motions.push({...b,radius,airborne:false,acceleration:[0,0,0]});continue;
  }
  const time=descendingLandingTime(gap,b.velocity[1],g);
  if(time===null||o.body.isSleeping())return fail('not-certified-ballistic-flight');
  // Reject active manifold impulses/penetrations, including stale native caches.
  let active=false;
  for(const c of [o.collider,o.pairCollider])lab.world.contactPairsWith(c,other=>lab.world.contactPair(c,other,m=>{for(let j=0;j<m.numContacts();j++)if(m.contactDist(j)<=0||m.contactImpulse(j)!==0||m.contactTangentImpulseX(j)!==0||m.contactTangentImpulseY(j)!==0)active=true;}));
  if(active)return fail('active-native-contact');
  motions.push({...b,radius,airborne:true,acceleration:[0,-g,0]});landings.push({id:b.id,time});
 }
 if(!landings.length)return fail('no-airborne-body');
 const earliest=Math.min(...landings.map(x=>x.time)),obstacles=[];
 for(const o of lab.statics)if(o!==cloth){const bound=actualStaticColliderBounds(o,lab.R);if(!bound)return fail('unsupported-native-hull');obstacles.push(bound);}
 let horizon=Math.min(earliest,maxDuration),boundTests=0;
 for(let attempt=0;attempt<=maxHalvings;attempt++){
  const bounds=motions.map(b=>sweptSphereBounds3D(b,b.acceleration,horizon));
  if(bounds.some(b=>b===null))return fail('invalid-swept-arithmetic');
  let safe=true;
  for(let i=0;i<bounds.length;i++){
   // A numerical root may round upward. A purported pre-event safe prefix
   // must independently exclude cloth contact, not merely compare root times.
   if(horizon!==earliest&&motions[i].airborne&&bounds[i][1][0]<=support.bounds[1][1])safe=false;
   for(const k of [0,2]){const axis=k===0?'x':'z',center=cloth.collider.translation()[axis],extent=cloth.collider.halfExtents()[axis];if(bounds[i][k][0]<=nextUp(center-extent)||bounds[i][k][1]>=nextDown(center+extent))safe=false;}
   for(const obstacle of obstacles){boundTests++;if(!separated(bounds[i],obstacle.bounds))safe=false;}
   for(let j=0;j<i;j++){boundTests++;if(!separated(bounds[i],bounds[j]))safe=false;}
  }
  if(safe){
   const reached=horizon===earliest,ids=landings.filter(x=>x.time===earliest).map(x=>x.id);
   return {eligible:true,event:{kind:reached?'cloth-landing-candidate':'geometry-or-observation-horizon',time:horizon,bodyIds:reached?ids:[]},simultaneousLandingCandidates:reached&&ids.length>1,ballisticLawCertified:true,otherContactsExcluded:true,prefixExcludesClothContact:!reached,certifiedAdvanceDuration:reached?null:horizon,rootOrderingCertified:false,noClothContactThroughEndpointCertified:!reached,landingRootIsNumerical:true,collisionResolved:false,boundTests,halvings:attempt,nativeSupport:{top},motionCount:motions.length};
  }
  horizon/=2;if(!(horizon>0))break;
 }
 return {...fail('no-certified-positive-flight-prefix'),boundTests};
}
