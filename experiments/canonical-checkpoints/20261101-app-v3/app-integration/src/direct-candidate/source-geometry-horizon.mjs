/** Conservative actual-source static geometry horizon for PREPARED motion laws.
 * Geometry certification is separate from motion-law eligibility. No rail plane
 * replacement, sampled trajectory, collision response or live-shot admission.
 */
import {nextUp,nextDown} from './conservative-pair-cull.mjs';
import {capturePreparedSpinWorld} from './source-law-normal-spin.mjs';
import {prepareCollinearSegment,predictPreparedCollinearEvent} from './source-law-collinear-segment.mjs';
const finite=a=>a.every(Number.isFinite),point=x=>[x,x];
const add=(a,b)=>[nextDown(a[0]+b[0]),nextUp(a[1]+b[1])];
const multiply=(a,b)=>{const p=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];return [nextDown(Math.min(...p)),nextUp(Math.max(...p))];};
const fail=reason=>({certified:false,reason});
const vector=v=>[v.x,v.y,v.z];
export function sweptSphereBounds3D(body,acceleration,horizon){
 if(![body.position,body.velocity,acceleration].every(v=>Array.isArray(v)&&v.length===3)||!finite([...body.position,...body.velocity,...acceleration,body.radius,horizon])||body.radius<=0||horizon<0)return null;
 const bounds=[];
 for(let k=0;k<3;k++){
  const p=point(body.position[k]),vh=multiply(point(body.velocity[k]),point(horizon));
  const controls=[p,add(p,multiply(vh,point(.5))),add(add(p,vh),multiply(multiply(multiply(point(acceleration[k]),point(horizon)),point(horizon)),point(.5)))];
  const bound=[nextDown(Math.min(...controls.map(c=>c[0]))-body.radius),nextUp(Math.max(...controls.map(c=>c[1]))+body.radius)];
  if(!controls.every(finite)||!finite(bound))return null;bounds.push(bound);
 }
 return bounds;
}
function staticBounds(object,R){
 const collider=object.collider;
 if(collider.contactSkin()!==0||(object.shape==='box'&&collider.shapeType()!==R.ShapeType.Cuboid)||(object.shape==='convex'&&collider.shapeType()!==R.ShapeType.ConvexPolyhedron))return null;
 const p=vector(collider.translation()),q=collider.rotation(),bp=vector(object.body.translation()),bq=object.body.rotation(),local=collider.translationWrtParent();
 if(bq.x!==0||bq.y!==0||bq.z!==0||bq.w!==1||local.x!==0||local.y!==0||local.z!==0||p.some((x,k)=>x!==bp[k]))return null;
 if(!object.body.isFixed()||q.x!==0||q.y!==0||q.z!==0||q.w!==1||!finite(p))return null;
 let localBounds;
 if(object.shape==='box'){
  const h=vector(collider.halfExtents());if(!finite(h)||h.some(x=>x<0))return null;localBounds=h.map(x=>[-x,x]);
 }else if(object.shape==='convex'){
  const vertices=collider.vertices();if(!vertices||vertices.length<12||vertices.length%3||!finite([...vertices]))return null;
  localBounds=[0,1,2].map(k=>{const values=[];for(let j=k;j<vertices.length;j+=3)values.push(vertices[j]);return [Math.min(...values),Math.max(...values)];});
 }else return null;
 const bounds=localBounds.map((range,k)=>add(range,point(p[k])));
 return bounds.every(finite)?{kind:object.kind,label:object.label,shape:object.shape,bounds}:null;
}
export function certifySourceGeometryHorizon(lab,bodies,segments,duration,{maxHalvings=16}={}){
 if(!Number.isFinite(duration)||duration<=0||!Number.isInteger(maxHalvings)||maxHalvings<0||maxHalvings>32)return fail('invalid-geometry-budget');
 if(lab.cue||lab.world.impulseJoints.len()||lab.world.multibodyJoints.len()||lab.world.bodies.len()!==lab.statics.length+lab.objects.length||lab.world.colliders.len()!==lab.statics.length+2*lab.objects.length)return fail('unowned-or-coupled-scene');
 if(bodies.length!==lab.objects.length||segments.length!==bodies.length||!segments.every(s=>s.eligible))return fail('missing-motion-owner');
 const cloths=lab.statics.filter(o=>o.kind==='cloth');if(cloths.length!==1)return fail('unsupported-support');
 const cloth=cloths[0],support=staticBounds(cloth,lab.R);
 if(!support||cloth.shape!=='box'||!cloth.body.isEnabled()||!cloth.collider.isEnabled()||cloth.collider.isSensor()||cloth.collider.solverGroups()!==0xffffffff||cloth.collider.activeCollisionTypes()!==15||cloth.collider.collisionGroups()!==((2<<16)|(1|4|16)))return fail('unsupported-support');
 const top=cloth.collider.translation().y+cloth.collider.halfExtents().y;
 const ballRecords=[];
 for(let i=0;i<bodies.length;i++){
  const input=bodies[i],saved=segments[i].body;
  if(!saved||saved.id!==input.id||saved.radius!==input.radius||!['position','velocity','angular'].every(key=>saved[key].every((x,k)=>x===input[key][k])))return fail('stale-motion-segment');
  const o=lab.objects[i],actualPosition=vector(o.body.translation()),actualVelocity=vector(o.body.linvel()),actualAngular=vector(o.body.angvel());
  if(o.id!==input.id||o.shape!=='sphere'||!o.body.isEnabled()||!o.body.isDynamic()||input.radius!==o.radius||!input.position.every((x,k)=>x===actualPosition[k])||!input.velocity.every((x,k)=>x===actualVelocity[k])||!input.angular.every((x,k)=>x===actualAngular[k]))return fail('stale-or-incomplete-motion-state');
  if(input.position[1]!==Math.fround(top+input.radius)||input.velocity[1]!==0||segments[i].acceleration[1]!==0)return fail('not-exact-flat-support');
  if([o.collider,o.pairCollider].some(c=>c.contactSkin()!==0||c.shapeType()!==lab.R.ShapeType.Ball||vector(c.translationWrtParent()).some(x=>x!==0)||vector(c.translation()).some((x,k)=>x!==actualPosition[k])))return fail('unsupported-native-sphere-envelope');
  const radius=Math.max(input.radius,o.collider.radius(),o.pairCollider.radius());
  if(!Number.isFinite(radius)||radius<=0)return fail('invalid-native-radius');
  ballRecords.push({...input,radius});
 }
 const bounds=[];
 try{for(const o of lab.statics){if(o===cloth)continue;const bound=staticBounds(o,lab.R);if(!bound)return fail('unsupported-actual-static-shape');bounds.push(bound);}}catch{return fail('unsupported-actual-static-shape');}
 let horizon=Math.min(duration,...segments.map(s=>s.horizon)),boundEvaluations=0,staticTests=0;
 if(!(horizon>0)||!Number.isFinite(horizon))return fail('invalid-motion-horizon');
 for(let attempt=0;attempt<=maxHalvings;attempt++){
  let clear=true;
  for(let i=0;i<ballRecords.length;i++){
   boundEvaluations++;const swept=sweptSphereBounds3D(ballRecords[i],segments[i].acceleration,horizon);
   if(!swept)return fail('nonfinite-swept-bound');
   // Supporting cloth is finite too. Require the complete sphere to remain
   // inside its horizontal footprint, using the inner native bounds.
   const cp=cloth.collider.translation(),half=cloth.collider.halfExtents();
   for(const axis of [0,2]){const center=axis===0?cp.x:cp.z,extent=axis===0?half.x:half.z;if(swept[axis][0]<=nextUp(center-extent)||swept[axis][1]>=nextDown(center+extent))clear=false;}
   for(const obstacle of bounds){staticTests++;if(!swept.some((range,k)=>range[1]<obstacle.bounds[k][0]||range[0]>obstacle.bounds[k][1])){clear=false;break;}}
  }
  if(clear)return {certified:true,kind:'actual-source-static-aabb-prefix',duration:horizon,fromTime:lab.time,revision:lab.revision,bodyIds:bodies.map(b=>b.id),boundEvaluations,staticTests,halvings:attempt,actualStaticBounds:bounds,collisionResolved:false};
  const next=horizon/2;if(next===0||next===horizon)break;horizon=next;
 }
 return {...fail('no-certified-positive-static-prefix'),boundEvaluations,staticTests};
}
/** Geometry no longer relies on a caller asserted interval. The prepared
 * constant-load motion assumption is still explicit and NOT a live-shot proof.
 */
export function predictSourcePreparedCollinearEvent(lab,bodies,{duration,preparedBoundary=false}={}){
 if(!preparedBoundary)return {eligible:false,reason:'unverified-motion-boundary'};
 const captured=capturePreparedSpinWorld(lab,{preparedBoundary:true});
 if(captured.externalDynamics||captured.cue||captured.jointCount||!captured.support||captured.balls.some(b=>b.otherContact||b.forced||b.constrained||b.damped))return {eligible:false,reason:'unsupported-actual-motion-conditions'};
 const cloth=lab.statics.find(o=>o.kind==='cloth');if(!cloth)return {eligible:false,reason:'no-cloth'};
 if(cloth.collider.frictionCombineRule()!==lab.R.CoefficientCombineRule.Multiply||lab.objects.some(o=>o.collider.frictionCombineRule()!==lab.R.CoefficientCombineRule.Multiply))return {eligible:false,reason:'non-source-friction-combine-rule'};
 const coefficients=lab.objects.map(o=>o.collider.friction()*cloth.collider.friction());
 if(!coefficients.length||!coefficients.every(mu=>mu===coefficients[0]))return {eligible:false,reason:'heterogeneous-friction'};
 const material={gravity:lab.params.gravity,normalLoadGravity:captured.material.normalLoadGravity,patchCapGravity:captured.material.patchCapGravity,clothFriction:coefficients[0],rollingLength:lab.params.rollingLength,spinLength:lab.params.spinLength};
 const segments=bodies.map(b=>prepareCollinearSegment(b,material));
 const geometry=certifySourceGeometryHorizon(lab,bodies,segments,duration);
 if(!geometry.certified)return {eligible:false,reason:geometry.reason,geometry};
 const collisionBodies=bodies.map((b,i)=>({...b,collisionRadius:lab.objects[i].pairCollider.radius()}));
 const result=predictPreparedCollinearEvent(collisionBodies,material,{duration,geometryHorizon:geometry.duration,geometryProvenance:'prepared-collision-free-interval'});
 return {...result,geometry,material,preparedBoundary:true};
}

// Shape-only conservative bounds; motion/contact eligibility belongs to callers.
export {staticBounds as actualStaticColliderBounds};
