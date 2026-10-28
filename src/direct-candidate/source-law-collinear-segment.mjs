/** PREPARED constant-load, collinear sliding kinematics from ORIGINAL source
 * friction + rollingLength + spinLength. Not generic Coulomb and not runtime
 * admission. No collision resolver or full attitude integration is implied.
 */
import {pairTOI} from './event-core.mjs';
export const COLLINEAR_PROFILE='source-law-prepared-collinear-sliding-v1';
const finite=a=>a.every(Number.isFinite);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const magnitude=a=>Math.hypot(...a);
const failure=reason=>({eligible:false,reason,profile:COLLINEAR_PROFILE});
function zeroTime(value,rate){
 if(value===0||rate===0||Math.sign(value)===Math.sign(rate))return Infinity;
 const t=-value/rate;return t>0?t:NaN; // Positive physical boundary rounded to zero: refuse.
}
export function prepareCollinearSegment(body,material){
 const {clothFriction:mu,rollingLength:lr,spinLength:ls}=material;
 const g=material.normalLoadGravity??material.gravity,capGravity=material.patchCapGravity??material.gravity,patchGravity=Math.min(g,capGravity);
 if(body.provenance!=='prepared-flat-constant-load'||body.otherContact||body.externalForce)return failure('unsupported-support-or-coupling');
 if(![body.position,body.velocity,body.angular].every(v=>Array.isArray(v)&&v.length===3)||!finite([...body.position,...body.velocity,...body.angular,body.radius,body.mass,g,capGravity,mu,lr,ls])||body.radius<=0||body.mass<=0||g<=0||capGravity<0||mu<0||lr<0||ls<0)return failure('invalid-state-or-material');
 if(body.velocity[1]!==0)return failure('vertical-motion');
 const r=body.radius,v=body.velocity,c=[-r*body.angular[2],0,r*body.angular[0]],speed=magnitude(v),surfaceSpeed=magnitude(c);
 const beta=5*patchGravity*ls/(2*r*r),patch=5*patchGravity*lr/(2*r);
 if(!finite([beta,patch,mu*g]))return failure('nonfinite-derived-rate');
 if((ls>0&&capGravity>0&&beta===0)||(lr>0&&capGravity>0&&patch===0)||(mu>0&&mu*g===0))return failure('underflow-derived-rate');
 if(!finite(c)||((body.angular[0]!==0||body.angular[2]!==0)&&surfaceSpeed===0))return failure('unrepresentable-tangential-spin');
 if(speed===0&&body.angular[0]===0&&body.angular[2]===0){
  const alpha=[0,-Math.sign(body.angular[1])*beta,0],stop=zeroTime(body.angular[1],alpha[1]);
  if(Number.isNaN(stop))return failure('unrepresentable-regime-horizon');
  return {eligible:true,profile:COLLINEAR_PROFILE,body:structuredClone(body),material:{...material},acceleration:[0,0,0],angularAcceleration:alpha,horizon:stop,boundaries:body.angular[1]!==0&&beta>0?['normal-spin-stop']:[],regime:'stationary-normal-spin',orientationAdvance:false};
 }
 if(surfaceSpeed===0)return failure('tangential-spin-sign-boundary');
 // First certified subset is coordinate-axial. A rounded determinant equal
 // to zero is NOT a proof of collinearity (cancellation/underflow can hide it).
 if(!((v[2]===0&&body.angular[0]===0)||(v[0]===0&&body.angular[2]===0)))return failure('nonaxial-or-noncollinear-slip-and-spin');
 const axis=v[0]!==0?0:v[2]!==0?2:c[0]!==0?0:2,sign=Math.sign(v[axis]||c[axis]);
 const direction=axis===0?[sign,0,0]:[0,0,sign];
 const scalarV=dot(v,direction),scalarC=dot(c,direction),u=scalarV-scalarC;
 if(!finite([scalarV,scalarC,u]))return failure('nonfinite-derived-state');
 if(u===0)return failure('rolling-boundary-unqualified');
 const dv=-mu*g*Math.sign(u);
 const dc=2.5*mu*g*Math.sign(u)-patch*Math.sign(scalarC);
 const du=dv-dc,normalRate=-Math.sign(body.angular[1])*beta;
 const times=[['slip-zero',zeroTime(u,du)],['tangential-spin-zero',zeroTime(scalarC,dc)],['normal-spin-stop',zeroTime(body.angular[1],normalRate)]];
 const horizon=Math.min(...times.map(([,t])=>t));
 if(Number.isNaN(horizon)||horizon===0)return failure('unrepresentable-regime-horizon');
 const acceleration=direction.map(x=>dv*x),angularAcceleration=[dc*direction[2]/r,normalRate,-dc*direction[0]/r];
 if(!finite([...acceleration,...angularAcceleration,dv,dc,du]))return failure('nonfinite-derived-rate');
 return {eligible:true,profile:COLLINEAR_PROFILE,body:structuredClone(body),material:{...material},direction,scalarV,scalarC,slip:u,scalarAcceleration:dv,surfaceAcceleration:dc,slipRate:du,acceleration,angularAcceleration,horizon,boundaries:times.filter(([,t])=>t===horizon&&Number.isFinite(t)).map(([name])=>name),regime:'collinear-sliding',orientationAdvance:false};
}
export function evaluateCollinearMotion(segment,time){
 if(!segment.eligible||!Number.isFinite(time)||time<0||time>segment.horizon)throw RangeError('Evaluation must remain inside the certified motion regime');
 const b=segment.body;
 const position=b.position.map((p,i)=>p+b.velocity[i]*time+segment.acceleration[i]*time*time/2);
 const velocity=b.velocity.map((v,i)=>v+segment.acceleration[i]*time),angular=b.angular.map((w,i)=>w+segment.angularAcceleration[i]*time);
 if(!finite([...position,...velocity,...angular]))throw RangeError('Nonfinite motion evaluation');
 return {id:b.id,position,velocity,angular,radius:b.radius,mass:b.mass,orientationAdvance:false};
}

/** Event prediction only. Caller supplies an explicitly prepared collision-free
 * actual-geometry interval. No rectangular replacement for real cushion hulls.
 * At the boundary, original geometry/contact physics must take over.
 */
export function predictPreparedCollinearEvent(bodies,material,{duration,geometryHorizon,geometryProvenance}={}){
 if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(geometryHorizon)||geometryHorizon<=0||geometryProvenance!=='prepared-collision-free-interval')return failure('missing-actual-geometry-horizon');
 if(![3,4].includes(bodies.length))return failure('three-or-four-balls-required');
 if(bodies.some(b=>b.collisionRadius!==undefined&&(!Number.isFinite(b.collisionRadius)||b.collisionRadius<=0)))return failure('invalid-collision-radius');
 const segments=bodies.map(b=>prepareCollinearSegment(b,material));
 const invalid=segments.find(s=>!s.eligible);if(invalid)return invalid;
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)if(magnitude(bodies[i].position.map((x,k)=>x-bodies[j].position[k]))<=(bodies[i].collisionRadius??bodies[i].radius)+(bodies[j].collisionRadius??bodies[j].radius))return failure('initial-touch-or-overlap');
 const horizon=Math.min(duration,geometryHorizon,...segments.map(s=>s.horizon));
 const events=[];
 for(let i=0;i<segments.length;i++)if(segments[i].horizon===horizon)events.push({time:horizon,kind:'regime-boundary',ball:i,boundaries:segments[i].boundaries});
 // A certified no-contact prefix endpoint is a truncation bound, not a
 // physical collision; do not manufacture a tie with a regime/pair event.
 let pairRootCalls=0;
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
  const a=bodies[i],b=bodies[j];
  // Flat support must be common; different sphere center heights need 3D TOI.
  if(a.position[1]!==b.position[1]||a.radius!==b.radius)return failure('unequal-height-or-radius');
  const record=x=>({p:[x.position[0],x.position[2]],v:[x.velocity[0],x.velocity[2]],r:x.collisionRadius??x.radius});
  pairRootCalls++;
  let hit;try{hit=pairTOI(record(a),record(b),{a:[segments[i].acceleration[0],segments[i].acceleration[2]]},{a:[segments[j].acceleration[0],segments[j].acceleration[2]]},horizon);}catch{return failure('nonfinite-pair-prediction');}
  if(hit)events.push({time:hit.t,kind:'pair',i,j,ambiguous:hit.ambiguous});
 }
 if(!events.length)events.push({time:horizon,kind:geometryHorizon<=duration&&geometryHorizon===horizon?'geometry-horizon':'observation-horizon'});
 events.sort((a,b)=>a.time-b.time);const selected=events[0];
 if(selected.ambiguous||selected.time<=0)return failure('ambiguous-or-zero-time-contact');
 if(events[1]&&Math.abs(events[1].time-selected.time)<=1e-8*(1+selected.time))return failure('simultaneous-or-near-tied-events');
 return {eligible:true,profile:COLLINEAR_PROFILE,event:selected,states:segments.map(s=>evaluateCollinearMotion(s,selected.time)),pairRootCalls,trajectoryTimeSteps:0,collisionResolved:false,orientationAdvance:false,pass:null};
}
