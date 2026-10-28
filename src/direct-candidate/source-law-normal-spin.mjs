/** Opt-in ORIGINAL torque-law advancement, not the withdrawn Coulomb profile.
 * Exact supported equilibrium is a prerequisite, never a position projection.
 * Y is up. Only stationary translation and pure normal spin are admitted.
 */
export const NORMAL_SPIN_PROFILE='source-law-supported-normal-spin-v1';
const vector=v=>[v.x,v.y,v.z];
const allZero=v=>v.every(x=>x===0);
const finite=v=>v.every(Number.isFinite);
function multiply(a,b){return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
export function advanceNormalSpin(body,{gravity,spinLength},duration){
 if(!finite([...body.position,...body.velocity,...body.angular,...body.rotation,body.radius,gravity,spinLength,duration])||body.radius<=0||gravity<0||spinLength<0||duration<0)throw RangeError('Finite source-law normal-spin state required');
 if(!allZero(body.velocity)||body.angular[0]!==0||body.angular[2]!==0)throw RangeError('Normal spin only; rolling/sliding require local physics');
 const beta=5*gravity*spinLength/(2*body.radius*body.radius),w=body.angular[1];
 const stopTime=beta>0?Math.abs(w)/beta:Infinity;
 const movingTime=Math.min(duration,stopTime);
 const angle=w*movingTime-Math.sign(w)*beta*movingTime*movingTime/2;
 const rotation=multiply([0,Math.sin(angle/2),0,Math.cos(angle/2)],body.rotation);
 const norm=Math.hypot(...rotation);
 if((spinLength>0&&gravity>0&&beta===0)||!finite([beta,angle,norm])||norm===0)throw RangeError('Nonfinite source-law advancement');
 return {...body,position:[...body.position],velocity:[...body.velocity],angular:[0,duration>=stopTime?0:Math.sign(w)*Math.max(0,Math.abs(w)-beta*duration),0],rotation:rotation.map(x=>x/norm),stopTime,angle};
}

/** Pure semantic guard. The physical scene must be stationary except for normal
 * spin. Finite support bounds include radius; no four-plane rail substitution.
 */
export function inspectSupportedSpinState(state){
 const fail=reason=>({eligible:false,reason});
 if(state.profile!=='prepared-original-law-boundary'||state.cue||state.externalDynamics||state.jointCount!==0)return fail('unowned-or-coupled-world');
 const {gravity,spinLength}=state.material??{},s=state.support;
 if(!finite([gravity,spinLength])||gravity<=0||spinLength<0||!s||s.kind!=='horizontal-cloth-box'||!finite([s.top,...s.min,...s.max]))return fail('unsupported-material-or-support');
 if(!Array.isArray(state.balls)||!state.balls.length)return fail('no-balls');
 for(const b of state.balls){
  if(![b.position,b.velocity,b.angular].every(v=>Array.isArray(v)&&v.length===3)||!Array.isArray(b.rotation)||b.rotation.length!==4||!finite([...b.position,...b.velocity,...b.angular,...b.rotation,b.radius])||b.radius<=0)return fail('invalid-state');
  const rate=5*gravity*spinLength/(2*b.radius*b.radius);
  if(!Number.isFinite(rate)||(spinLength>0&&rate===0))return fail('nonfinite-spin-rate');
  if(!allZero(b.velocity)||b.angular[0]!==0||b.angular[2]!==0)return fail('translation-or-tangential-spin');
  // f32 equality certifies only the source coordinate representation; it does
  // not expand the physical domain by a chosen positional tolerance.
  if(b.position[1]!==Math.fround(s.top+b.radius))return fail('not-exact-supported-equilibrium');
  for(const axis of [0,2])if(b.position[axis]-b.radius<=s.min[axis]||b.position[axis]+b.radius>=s.max[axis])return fail('support-edge');
  if(Math.abs(Math.hypot(...b.rotation)-1)>8*2**-24)return fail('invalid-orientation');
  if(b.otherContact||b.forced||b.constrained||b.damped)return fail('other-force-or-contact');
 }
 for(let i=0;i<state.balls.length;i++)for(let j=i+1;j<state.balls.length;j++){
  const a=state.balls[i],b=state.balls[j];if(Math.hypot(...a.position.map((x,k)=>x-b.position[k]))<=a.radius+b.radius)return fail('touching-balls');
 }
 return {eligible:true,reason:'stationary-supported-spherical-world'};
}

/** Global earliest spin-stop recurrence. All bodies share each event time.
 * externalHorizon is a certified caller event boundary, not an estimated TOI.
 * The remainder is delegated unchanged instead of jumping past that boundary.
 */
export function planSupportedSpinAdvance(state,duration,{externalHorizon=Infinity,maxEvents=64}={}){
 const guard=inspectSupportedSpinState(state);
 if(!guard.eligible)return {...guard,advancedDuration:0,remainder:duration};
 if(!Number.isFinite(duration)||duration<0||(typeof externalHorizon!=='number'||!(externalHorizon>=0))||!Number.isInteger(maxEvents)||maxEvents<1)throw RangeError('Invalid horizon or budget');
 let balls=structuredClone(state.balls),time=0;const horizon=Math.min(duration,externalHorizon),events=[];
 while(time<horizon){
  if(events.length>=maxEvents)return {eligible:false,reason:'event-budget',advancedDuration:0,remainder:duration};
  let next=horizon-time;
  for(const b of balls){const beta=5*state.material.gravity*state.material.spinLength/(2*b.radius*b.radius);if(beta>0&&b.angular[1]!==0)next=Math.min(next,Math.abs(b.angular[1])/beta);}
  if(!(next>0))return {eligible:false,reason:'nonprogressing-event',advancedDuration:0,remainder:duration};
  const stopped=[];
  balls=balls.map(b=>{const out=advanceNormalSpin(b,state.material,next);if(b.angular[1]!==0&&out.angular[1]===0)stopped.push(b.id);return out;});
  time+=next;events.push({time,kind:stopped.length?'spin-stop':'horizon',stopped});
 }
 return {eligible:true,reason:'analytic-supported-normal-spin',balls,events,advancedDuration:time,remainder:duration-time,pass:null};
}

/** Actual PhysicsLab scene inspection: every rigid body and joint must be owned;
 * other fixed hulls use their actual contactShape queries, never rectangle rails.
 * Caller must supply a PREPARED, drained source-step boundary. This first adapter
 * does not auto-certify arbitrary live shots or queued collision transitions.
 */
/** Native gravity input is f32 even when a fresh World's JS getter retains
 * the configured Number; restored snapshots expose the f32 value directly.
 * Load and source patch impulse-cap gravities remain distinct quantities. */
export function sourceGravityRepresentation(lab){
 const configured=lab.params.gravity,native=lab.world.gravity;
 const matched=Number.isFinite(configured)&&configured>0&&native.x===0&&native.z===0&&(native.y===-configured||native.y===Math.fround(-configured));
 const normalLoadGravity=Math.abs(Math.fround(native.y)),patchCapGravity=configured;
 return {matched:matched&&Number.isFinite(normalLoadGravity)&&normalLoadGravity>0,configuredGravity:configured,normalLoadGravity,patchCapGravity,patchGravity:Math.min(normalLoadGravity,patchCapGravity)};
}
export function capturePreparedSpinWorld(lab,{preparedBoundary=false}={}){
 const gravity=sourceGravityRepresentation(lab);
 const state={profile:preparedBoundary?'prepared-original-law-boundary':'unverified-boundary',material:{gravity:gravity.patchGravity,configuredGravity:gravity.configuredGravity,normalLoadGravity:gravity.normalLoadGravity,patchCapGravity:gravity.patchCapGravity,spinLength:lab.params.spinLength},cue:!!lab.cue,jointCount:lab.world.impulseJoints.len()+lab.world.multibodyJoints.len(),externalDynamics:lab.world.bodies.len()!==lab.statics.length+lab.objects.length,balls:[]};
 const cloth=lab.statics.filter(o=>o.kind==='cloth');
 if(cloth.length!==1||cloth[0].shape!=='box')return state;
 const support=cloth[0],p=support.collider.translation(),q=support.collider.rotation();
 if(q.x!==0||q.y!==0||q.z!==0||q.w!==1)return state;
 if(lab.statics.some(o=>!o.body.isFixed())||lab.world.colliders.len()!==lab.statics.length+2*lab.objects.length)state.externalDynamics=true;
 state.support={kind:'horizontal-cloth-box',top:p.y+support.half.y,min:[p.x-support.half.x,p.y-support.half.y,p.z-support.half.z],max:[p.x+support.half.x,p.y+support.half.y,p.z+support.half.z]};
 // Source fixedBox rounds body position to f32 but stores original half extent.
 // Use the actual native collider shape dimensions for the physical plane.
 const half=support.collider.halfExtents();
 if(half){state.support.top=p.y+half.y;state.support.min=[p.x-half.x,p.y-half.y,p.z-half.z];state.support.max=[p.x+half.x,p.y+half.y,p.z+half.z];}
 if(!support.body.isEnabled()||!support.collider.isEnabled()||support.collider.contactSkin()!==0||support.collider.solverGroups()!==0xffffffff||support.collider.activeCollisionTypes()!==15||support.collider.isSensor()||support.collider.collisionGroups()!==((2<<16)|(1|4|16)))state.externalDynamics=true;
 if(!support.body.isFixed()||!gravity.matched)state.externalDynamics=true;
 for(const o of lab.objects){
  if(o.shape!=='sphere'){state.externalDynamics=true;continue;}
  if(!o.body.isEnabled()||[o.collider,o.pairCollider].some(c=>c.contactSkin()!==0||c.solverGroups()!==0xffffffff||c.activeCollisionTypes()!==15)||!o.collider.isEnabled()||!o.pairCollider.isEnabled()||o.collider.isSensor()||o.pairCollider.isSensor()||o.collider.collisionGroups()!==((1<<16)|(2|4))||o.pairCollider.collisionGroups()!==((8<<16)|8))state.externalDynamics=true;
  if([o.collider,o.pairCollider].some(c=>!allZero(vector(c.translationWrtParent()))))state.externalDynamics=true;
  const b=o.body,position=vector(b.translation()),v=vector(b.linvel()),w=vector(b.angvel()),rotation=b.rotation();
  const otherContact=lab.statics.some(s=>s!==support&&s.collider.contactShape(new lab.R.Ball(o.radius),b.translation(),{x:0,y:0,z:0,w:1},0)!==null);
  const inverse=b.effectiveInvMass(),mass=b.mass(),expectedInv=1/mass;
  const matrix=b.effectiveWorldInvInertia(),ii=[matrix.m11,matrix.m12,matrix.m13,matrix.m22,matrix.m23,matrix.m33],idealInverse=1/(.4*o.mass*o.radius*o.radius);
  const sphericalMass=Math.abs(mass-o.mass)<=4*2**-24*o.mass&&ii.every((x,k)=>Math.abs(x-([0,3,5].includes(k)?idealInverse:0))<=16*2**-24*idealInverse);
  if(o.collider.radius()!==Math.fround(o.radius)||o.pairCollider.radius()!==Math.fround(o.radius))state.externalDynamics=true;
  state.balls.push({id:o.id,position,velocity:v,angular:w,rotation:[rotation.x,rotation.y,rotation.z,rotation.w],radius:o.radius,otherContact,forced:!allZero(vector(b.userForce()))||!allZero(vector(b.userTorque()))||b.gravityScale()!==1,constrained:!sphericalMass||!b.isDynamic()||(b.isSleeping()&&!allZero(w))||[inverse.x,inverse.y,inverse.z].some(x=>Math.abs(x-expectedInv)>4*2**-24*Math.abs(expectedInv)),damped:b.linearDamping()!==0||b.angularDamping()!==0});
 }
 return state;
}

/** Explicit opt-in prepared boundary adapter. Failure calls original lab.step.
 * No scoring/production authority. All guards are recomputed on every call.
 */
export function stepPreparedSpinWorld(lab,frames,{enabled=false,preparedBoundary=false,externalHorizon=Infinity}={}){
 if(!Number.isInteger(frames)||frames<0||frames>4096)throw RangeError('0..4096 source frames required');
 if(!Number.isFinite(lab.dt)||lab.dt<=0||lab.dt>1/120||(typeof externalHorizon!=='number'||!(externalHorizon>=0)))throw RangeError('Valid source dt and event horizon required');
 if(frames===0)return {path:'no-op',sourceStepsExecuted:0,sourceStepsSkipped:0,pass:null};
 const original=reason=>{lab.step(frames);return {path:'original',reason,sourceFramesExecuted:frames,sourceStepsExecuted:null,sourceStepsSkipped:0,pass:null};};
 if(!enabled)return original('disabled');
 // Partial-frame source handoff is intentionally not guessed. Stop before an
 // outside event only at an original frame boundary; otherwise use the solver.
 const duration=frames*lab.dt;
 if(externalHorizon<duration)return original('external-event-horizon');
 const state=capturePreparedSpinWorld(lab,{preparedBoundary}),plan=planSupportedSpinAdvance(state,duration);
 if(!plan.eligible)return original(plan.reason);
 for(let i=0;i<lab.objects.length;i++){
  const o=lab.objects[i],b=plan.balls[i],q=b.rotation;
  o.body.setAngvel({x:0,y:b.angular[1],z:0},false);o.body.setRotation({x:q[0],y:q[1],z:q[2],w:q[3]},false);
  // Preserve sleep flags; do not invent a sleep event. anyMotion reads the new
  // physical angular speed. Original solver handles future sleep/wake transitions.
  const pos=o.body.translation();o.maxHeight=Math.max(o.maxHeight,pos.y-o.radius);
  o.distance+=Math.hypot(pos.x-o.lastPos.x,pos.y-o.lastPos.y,pos.z-o.lastPos.z);o.lastPos={...pos};
  if(Math.floor((lab.steps+frames)/6)>Math.floor(lab.steps/6)){
   const last=o.trail.at(-1);if(!last||Math.hypot(pos.x-last.x,pos.y-last.y,pos.z-last.z)>.004){o.trail.push({...pos,shot:lab.shots});if(o.trail.length>4000)o.trail.shift();}
  }
 }
 lab.time+=duration;lab.steps+=frames;lab.world.propagateModifiedBodyPositionsToColliders();
 return {path:'analytic',profile:NORMAL_SPIN_PROFILE,sourceStepsExecuted:0,sourceStepsSkipped:frames,analyticEvents:plan.events,advancedDuration:duration,pass:null,preparedBoundary:true};
}
