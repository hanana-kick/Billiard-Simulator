/*
 * Generic rigid-body world. No billiards trajectory, rebound-angle, draw, follow,
 * squirt or masse rule exists here. Rapier integrates every rigid body and solves scene contacts. Cue-tip/sphere
 * contact uses a compliant 3D spring/friction material, not a billiards impulse
 * formula. A finite end mass on an elastic transverse joint models cue flex.
 */
(function(G){
'use strict';
const {V,add,sub,mul,dot,cross,len,norm,clamp,rotate,qident,qfromY}=G.LabMath;
const D={width:2.84,depth:1.42,radius:.03075,mass:.210,cueLength:1.35,tipRadius:.006,cueRadius:.011,cueMass:.54,tipEndMass:.012,flexibleLength:.12,strokeSubsteps:64,dt:1/960};
const DEFAULTS={gravity:9.81,clothFriction:.20,ballFriction:.04,ballRestitution:.93,cushionFriction:.15,cushionRestitution:.82,clothRestitution:.20,tipFriction:.70,tipNormalStiffness:1000000,tipTangentialStiffness:400000,tipNormalDamping:110,tipTangentialDamping:10,cueLateralStiffness:1200,cueLateralDamping:1,rollingLength:.00045,spinLength:.00035};
// Two disjoint collider channels preserve independent pair coefficients, even at
// zero friction/restitution. Environment contacts use the primary collider;
// moving-body contacts use a massless identical collider. A pair is never solved twice.
const GROUP={bodyEnvironment:(1<<16)|(2|4),bodyBody:(8<<16)|8,environment:(2<<16)|(1|4|16),cue:(4<<16)|(1|2),compliantTip:(16<<16)|(1|2)};
function validatedParams(values){
 const p={...DEFAULTS,...values};
 for(const key of Object.keys(DEFAULTS)){
  const value=p[key]; if(!Number.isFinite(value)||value<0)throw new RangeError('Invalid physical parameter: '+key);
  if(key.endsWith('Restitution')&&value>1)throw new RangeError('Restitution must be between 0 and 1: '+key);
 }
 return p;
}
class PhysicsLab{
 constructor(R,params={},options={}){
  this.R=R;this.params=validatedParams(params);this.dt=options.dt||D.dt;if(!Number.isFinite(this.dt)||this.dt<=0||this.dt>1/120)throw new RangeError("Invalid timestep");this.revision=0;this.objects=[];this.statics=[];this.byCollider=new Map();this.nextId=1;
  this.time=0;this.steps=0;this.lastStroke=null;this.strokeSubsteps=options.strokeSubsteps??D.strokeSubsteps;if(!Number.isInteger(this.strokeSubsteps)||this.strokeSubsteps<1||this.strokeSubsteps>256)throw new RangeError('Invalid stroke substep count');this.shots=0;this.events=[];this.cue=null;this.lastSnapshot=null;this.onEvent=null;
  this.world=new R.World(V(0,-this.params.gravity,0));this.queue=new R.EventQueue(true);
  const p=this.world.integrationParameters;p.dt=this.dt;p.lengthUnit=D.radius*2;p.numSolverIterations=12;p.numInternalPgsIterations=4;p.contact_natural_frequency=30;p.maxCcdSubsteps=4;
  p.normalizedAllowedLinearError=.00005;p.normalizedPredictionDistance=.001;
  this.buildEnvironment();this.addSphere(V(-.66,D.radius+.00005,.10),'수구','#f6f3df');
  this.addSphere(V(.17,D.radius+.00005,.055),'노랑','#f5bf41');this.addSphere(V(.84,D.radius+.00005,-.29),'빨강','#df5b54');
  // Settle only at construction. A shot NEVER reconstructs or rewinds the world.
  for(let i=0;i<72;i++)this.world.step();
  this.world.propagateModifiedBodyPositionsToColliders();
 }
 material(desc,kind){
  const p=this.params;let f=1,e=1,group=GROUP.environment;
  if(kind==='ball'){group=GROUP.bodyEnvironment;}
  else if(kind==='pair'){f=Math.sqrt(p.ballFriction);e=Math.sqrt(p.ballRestitution);group=GROUP.bodyBody;}
  else if(kind==='cloth'){f=p.clothFriction;e=p.clothRestitution;}
  else if(kind==='cushion'){f=p.cushionFriction;e=p.cushionRestitution;}
  else if(kind==='wood'){f=.30;e=.35;}
  else if(kind==='floor'){f=.50;e=.25;}
  else if(kind==='tip'){f=p.tipFriction;e=.2;group=GROUP.compliantTip;}
  else if(kind==='shaft'){f=.30;e=.20;group=GROUP.cue;}
  desc.setFriction(f);desc.setRestitution(e);desc.setCollisionGroups(group);
  desc.setFrictionCombineRule(this.R.CoefficientCombineRule.Multiply);
  desc.setRestitutionCombineRule(this.R.CoefficientCombineRule.Multiply);
  return desc;
 }
 fixedBox(pos,half,kind,color,label){
  const b=this.world.createRigidBody(this.R.RigidBodyDesc.fixed().setTranslation(pos.x,pos.y,pos.z));
  const c=this.world.createCollider(this.material(this.R.ColliderDesc.cuboid(half.x,half.y,half.z),kind),b);
  const o={body:b,collider:c,shape:'box',half,kind,color,label,pos};this.statics.push(o);this.byCollider.set(c.handle,o);return o;
 }
 buildEnvironment(){
  const w=D.width/2,h=D.depth/2;
  this.fixedBox(V(0,-.05,0),V(w,.05,h),'cloth','#187365','테이블 천');
  this.fixedBox(V(0,-.145,0),V(w+.16,.045,h+.16),'wood','#273737','테이블 프레임');
  this.fixedBox(V(0,-.24,0),V(w+.10,.05,h+.10),'wood','#152627','테이블 하부');
  this.fixedBox(V(w+.11,.016,0),V(.055,.052,h+.16),'wood','#715743','오른쪽 레일');
  this.fixedBox(V(-w-.11,.016,0),V(.055,.052,h+.16),'wood','#715743','왼쪽 레일');
  this.fixedBox(V(0,.016,h+.11),V(w+.055,.052,.055),'wood','#715743','앞쪽 레일');
  this.fixedBox(V(0,.016,-h-.11),V(w+.055,.052,.055),'wood','#715743','뒤쪽 레일');
  const sides=[['오른쪽 쿠션',h,(u,v)=>V(w+u,v[1],v[0])],['왼쪽 쿠션',h,(u,v)=>V(-w-u,v[1],v[0])],['앞쪽 쿠션',w,(u,v)=>V(v[0],v[1],h+u)],['뒤쪽 쿠션',w,(u,v)=>V(v[0],v[1],-h-u)]];
  const section=[[0,.0399],[.057,.009],[.057,.061],[.014,.061]];
  for(const [label,half,convert] of sides){
   const verts=[];for(const end of [-half,half])for(const [u,y] of section){const p=convert(u,[end,y]);verts.push(p.x,p.y,p.z);}
   const desc=this.R.ColliderDesc.convexHull(new Float32Array(verts));if(!desc)throw new Error('쿠션 형상 생성 실패');
   const body=this.world.createRigidBody(this.R.RigidBodyDesc.fixed());const collider=this.world.createCollider(this.material(desc,'cushion'),body);
   const o={body,collider,shape:'cushion',vertices:verts,kind:'cushion',color:'#1b8a73',label};this.statics.push(o);this.byCollider.set(collider.handle,o);
  }
  for(const x of [-1.05,1.05])for(const z of [-.48,.48])this.fixedBox(V(x,-.53,z),V(.095,.25,.095),'wood','#253132','테이블 다리');
  this.fixedBox(V(0,-.88,0),V(5,.10,4),'floor','#182427','바닥');
 }
 addSphere(pos,label='공',color='#78bad0',mass=D.mass,radius=D.radius){
  const body=this.world.createRigidBody(this.R.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y,pos.z).setCcdEnabled(true).setCanSleep(true).setLinearDamping(0).setAngularDamping(0));
  const collider=this.world.createCollider(this.material(this.R.ColliderDesc.ball(radius).setMass(mass),'ball').setActiveEvents(this.R.ActiveEvents.COLLISION_EVENTS),body);
  const pairCollider=this.world.createCollider(this.material(this.R.ColliderDesc.ball(radius).setMass(0),'pair').setActiveEvents(this.R.ActiveEvents.COLLISION_EVENTS),body);
  const o={id:this.nextId++,body,collider,pairCollider,shape:'sphere',radius,mass,kind:'ball',label,color,trail:[],maxHeight:0,distance:0,lastPos:{...pos}};
  this.objects.push(o);this.byCollider.set(collider.handle,o);this.byCollider.set(pairCollider.handle,o);this.revision++;return o;
 }
 addBox(pos,label='블록',color='#819aa7'){
  const half=V(.045,.045,.045),mass=.21;
  const body=this.world.createRigidBody(this.R.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y,pos.z).setCcdEnabled(true));
  const collider=this.world.createCollider(this.material(this.R.ColliderDesc.cuboid(half.x,half.y,half.z).setMass(mass),'ball').setCollisionGroups((1<<16)|(2|4|16)).setActiveEvents(this.R.ActiveEvents.COLLISION_EVENTS),body);
  const pairCollider=this.world.createCollider(this.material(this.R.ColliderDesc.cuboid(half.x,half.y,half.z).setMass(0),'pair').setActiveEvents(this.R.ActiveEvents.COLLISION_EVENTS),body);
  const o={id:this.nextId++,body,collider,pairCollider,shape:'box',half,mass,kind:'ball',label,color,trail:[],maxHeight:0,distance:0,lastPos:{...pos}};
  this.objects.push(o);this.byCollider.set(collider.handle,o);this.byCollider.set(pairCollider.handle,o);this.revision++;return o;
 }
 get(id){return this.objects.find(o=>o.id===id);}
 setParams(p){this.params=validatedParams({...this.params,...p});this.revision++;this.world.gravity=V(0,-this.params.gravity,0);for(const o of [...this.statics,...this.objects]){this.material(o.collider,o.kind);if(o.kind==='ball'&&o.shape==='box')o.collider.setCollisionGroups((1<<16)|(2|4|16));if(o.pairCollider)this.material(o.pairCollider,'pair');}if(this.cue){this.material(this.cue.tip,'tip');this.material(this.cue.shaft,'shaft');this.material(this.cue.neck,'shaft');}this.objects.forEach(o=>o.body.wakeUp());}
 removeObject(id){const o=this.get(id);if(!o)return;this.byCollider.delete(o.collider.handle);if(o.pairCollider)this.byCollider.delete(o.pairCollider.handle);this.revision++;this.world.removeRigidBody(o.body);this.objects=this.objects.filter(a=>a!==o);}
 pose(o,settings,retract=.012){
  const a=settings.angle*Math.PI/180,e=settings.elevation*Math.PI/180;
  const direction=V(Math.cos(a)*Math.cos(e),-Math.sin(e),Math.sin(a)*Math.cos(e));
  const side=V(-Math.sin(a),0,Math.cos(a)),up=cross(side,direction);
  const x=settings.tipX,y=settings.tipY;const surface=add(add(mul(side,x),mul(up,y)),mul(direction,-Math.sqrt(Math.max(.0001,1-x*x-y*y))));
  const center=o.body.translation(),contact=add(center,mul(surface,o.radius));
  const tip=add(add(center,mul(surface,o.radius+D.tipRadius)),mul(direction,-retract));
  const rotation=qfromY(direction),shaftCenter=sub(tip,mul(direction,D.tipRadius+D.cueLength/2));
  return{direction,side,up,contact,tip,rotation,shaftCenter,surface};
 }
 cueObstruction(o,settings){
  if(!o||o.shape!=='sphere')return '공을 선택하세요';
  const p=this.pose(o,settings),rear=D.cueLength-D.flexibleLength;
  const parts=[{shape:new this.R.Cylinder(rear/2,D.cueRadius),center:sub(p.tip,mul(p.direction,D.tipRadius+D.flexibleLength+rear/2))},{shape:new this.R.Cylinder(D.flexibleLength/2,.0058),center:sub(p.tip,mul(p.direction,D.tipRadius+D.flexibleLength/2))}];
  this.world.propagateModifiedBodyPositionsToColliders();
  for(const other of [...this.statics,...this.objects]){
   if(other===o)continue;
   if(parts.some(part=>other.collider.intersectsShape(part.shape,part.center,p.rotation)))return other.label;
  }
  const tipShape=new this.R.Ball(D.tipRadius);
  for(const other of [...this.statics,...this.objects])if(other!==o&&other.collider.intersectsShape(tipShape,p.tip,p.rotation))return other.label;
  return null;
 }
 strike(id,settings,{ignoreObstruction=false,saveSnapshot=true}={}){
  if(!settings||![settings.angle,settings.elevation,settings.tipX,settings.tipY,settings.speed].every(Number.isFinite)||Math.hypot(settings.tipX,settings.tipY)>=1||settings.speed<=0||settings.speed>10||settings.elevation<0||settings.elevation>85)return{ok:false,reason:"유효하지 않은 타격 설정입니다."};
  const o=this.get(id);if(!o||o.shape!=='sphere')return{ok:false,reason:'타격할 공을 선택하세요.'};
  if(this.cue)return{ok:false,reason:'큐가 스트로크 중입니다.'};
  const obstruction=this.cueObstruction(o,settings);if(obstruction&&!ignoreObstruction)return{ok:false,reason:`큐가 ${obstruction}에 닿습니다. 경사 또는 조준 방향을 바꾸세요.`};
  if(saveSnapshot)this.lastSnapshot=this.snapshot();
  const p=this.pose(o,settings),R=this.R;
  // The shaft is guided axially; its small end mass can deflect transversely.
  // The longitudinal and angular constraints are generic engine joints. Neither
  // a ball velocity nor a spin target is assigned at any point.
  const body=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.tip.x,p.tip.y,p.tip.z).setRotation(p.rotation).setGravityScale(0).setCcdEnabled(true).setCanSleep(false));
  const rearLength=D.cueLength-D.flexibleLength;
  const shaft=this.world.createCollider(this.material(R.ColliderDesc.cylinder(rearLength/2,D.cueRadius).setTranslation(0,-D.tipRadius-D.flexibleLength-rearLength/2,0).setMass(D.cueMass-D.tipEndMass),'shaft').setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),body);
  const head=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.tip.x,p.tip.y,p.tip.z).setRotation(p.rotation).setGravityScale(0).setCcdEnabled(true).setCanSleep(false));
  const tip=this.world.createCollider(this.material(R.ColliderDesc.ball(D.tipRadius).setMass(D.tipEndMass),'tip').setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),head);
  const neck=this.world.createCollider(this.material(R.ColliderDesc.cylinder(D.flexibleLength/2,.0058).setTranslation(0,-D.tipRadius-D.flexibleLength/2,0).setMass(0),'shaft').setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),head);
  const axes=R.JointAxesMask;
  const flex=this.world.createImpulseJoint(R.JointData.generic(V(),V(),V(0,1,0),axes.LinX|axes.AngX|axes.AngY|axes.AngZ),body,head,true);flex.setContactsEnabled(false);
  const guide=this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(p.tip.x,p.tip.y,p.tip.z).setRotation(p.rotation));
  const joint=this.world.createImpulseJoint(R.JointData.prismatic(V(),V(),V(0,1,0)),guide,body,true);joint.setLimits(-.08,.13);joint.setContactsEnabled(false);
  body.setLinvel(mul(p.direction,settings.speed),true);head.setLinvel(mul(p.direction,settings.speed),true);
  this.cue={body,head,guide,joint,flex,tip,shaft,neck,pose:p,started:this.time,contacted:false,contacts:new Map(),stats:{firstContact:null,lastContact:null,peakNormalForce:0,maxCompression:0,normalImpulse:0,contactEpisodes:0}};
  this.byCollider.set(tip.handle,{kind:'tip',label:'큐 팁',body:head});this.byCollider.set(shaft.handle,{kind:'shaft',label:'큐 샤프트',body});this.byCollider.set(neck.handle,{kind:'shaft',label:'큐 앞부분',body:head});
  this.shots++;this.revision++;this.emit({kind:'stroke',label: this.shots+'번째 타격 · '+settings.speed.toFixed(2)+' m/s',time:this.time});return{ok:true};
 }
 removeCue(){
  if(!this.cue)return;const c=this.cue;
  this.lastStroke={...c.stats,ended:this.time,started:c.started,contactDuration:c.stats.firstContact===null?0:c.stats.lastContact-c.stats.firstContact};
  for(const col of [c.tip,c.shaft,c.neck])this.byCollider.delete(col.handle);
  this.world.removeRigidBody(c.head);this.world.removeRigidBody(c.body);this.world.removeRigidBody(c.guide);this.cue=null;
 }
 compliantTipContact(h){
  const c=this.cue;if(!c)return;
  const p=this.params,axis=c.pose.direction,a=c.head.translation(),shaftAnchor=c.body.translation();
  const d=sub(a,shaftAnchor),lateral=sub(d,mul(axis,dot(d,axis)));
  const rv=sub(c.head.velocityAtPoint(a),c.body.velocityAtPoint(a)),vl=sub(rv,mul(axis,dot(rv,axis)));
  const springImpulse=mul(add(mul(lateral,-p.cueLateralStiffness),mul(vl,-p.cueLateralDamping)),h);
  c.head.applyImpulse(springImpulse,true);c.body.applyImpulseAtPoint(mul(springImpulse,-1),a,true);
  let touching=false;
  for(const o of this.objects){
   if(o.shape!=='sphere')continue;
   const delta=sub(o.body.translation(),a),dist=len(delta),compression=o.radius+D.tipRadius-dist;
   if(compression<=0||dist<1e-9){c.contacts.delete(o.id);continue;}
   touching=true;const n=mul(delta,1/dist),point=add(a,mul(n,D.tipRadius-compression*.5));
   let contact=c.contacts.get(o.id);
   if(!contact){contact={tangent:V()};c.contacts.set(o.id,contact);c.stats.contactEpisodes++;c.contacted=true;
    if(c.stats.firstContact===null)c.stats.firstContact=this.time;
    this.emit({kind:'contact',label:o.label+' ↔ 큐 팁',time:this.time,position:{...point}});
   }
   const relative=sub(o.body.velocityAtPoint(point),c.head.velocityAtPoint(point)),vn=dot(relative,n),vt=sub(relative,mul(n,vn));
   // Kelvin–Voigt normal compliance, no tensile force. Tangential spring stores
   // shear deformation; Coulomb slip caps its force and updates the spring state.
   const fn=Math.max(0,p.tipNormalStiffness*compression-p.tipNormalDamping*vn);
   contact.tangent=add(sub(contact.tangent,mul(n,dot(contact.tangent,n))),mul(vt,h));
   let ft=add(mul(contact.tangent,-p.tipTangentialStiffness),mul(vt,-p.tipTangentialDamping));
   const limit=p.tipFriction*fn,ftMag=len(ft);
   if(ftMag>limit){ft=ftMag>0?mul(ft,limit/ftMag):V();contact.tangent=p.tipTangentialStiffness>0?mul(add(ft,mul(vt,p.tipTangentialDamping)),-1/p.tipTangentialStiffness):V();}
   const impulse=mul(add(mul(n,fn),ft),h);
   // One common world contact point: equal/opposite impulses conserve pair
   // angular momentum, including orbital terms. The guide supplies reactions.
   o.body.applyImpulseAtPoint(impulse,point,true);c.head.applyImpulseAtPoint(mul(impulse,-1),point,true);
   c.stats.lastContact=this.time;c.stats.peakNormalForce=Math.max(c.stats.peakNormalForce,fn);c.stats.maxCompression=Math.max(c.stats.maxCompression,compression);c.stats.normalImpulse+=fn*h;
  }
  // Once the tip has separated, the player withdraws it. Removal never changes
  // any ball's velocity. This prevents a lingering cue from striking again.
  if(c.contacted&&!touching)this.removeCue();
 }
 anyMotion(){return this.objects.some(o=>!o.body.isSleeping()&&(len(o.body.linvel())>.002||len(o.body.angvel())>.05));}
 emit(e){this.events.push(e);if(this.events.length>120)this.events.shift();if(this.onEvent)this.onEvent(e);}
 angularPatchResistance(h=this.dt){
  const p=this.params;if(!p.rollingLength&&!p.spinLength)return;
  for(const o of this.objects){
   if(o.shape!=='sphere'||o.body.isSleeping())continue;
   this.world.contactPairsWith(o.collider,other=>{
    const material=this.byCollider.get(other.handle);if(!material||!['cloth','floor'].includes(material.kind))return;
    this.world.contactPair(o.collider,other,m=>{
     let normalImpulse=0;for(let j=0;j<m.numContacts();j++)normalImpulse+=Math.max(0,m.contactImpulse(j));
     if(normalImpulse<=0)return;
     const n=m.normal();if(Math.abs(n.y)<.95||Math.abs(o.body.linvel().y)>.05)return;
     normalImpulse=Math.min(normalImpulse,o.mass*this.params.gravity*h);
     const w=o.body.angvel(),wn=dot(w,n),t=sub(w,mul(n,wn)),wt=len(t);
     const inertia=.4*o.mass*o.radius*o.radius;
     // Dissipative contact torque only. Units: normal impulse [N s] *
     // material resistance length [m] -> angular impulse [N m s].
     // No airborne drag, trajectory steering, or translation overwrite.
     const jr=Math.min(normalImpulse*p.rollingLength,inertia*wt);
     const js=Math.min(normalImpulse*p.spinLength,inertia*Math.abs(wn));
     const torque=add(wt>1e-12?mul(t,-jr/wt):V(),mul(n,-Math.sign(wn)*js));
     o.body.applyTorqueImpulse(torque,false);
    });
   });
  }
 }
 step(n=1){
  for(let i=0;i<n;i++){
   const subdivisions=this.cue?this.strokeSubsteps:1,h=this.dt/subdivisions;
   this.world.integrationParameters.dt=h;
   for(let substep=0;substep<subdivisions;substep++){
   this.compliantTipContact(h);
   this.world.step(this.queue);this.time+=h;
   this.queue.drainCollisionEvents((h1,h2,started)=>{
    if(!started)return;const a=this.byCollider.get(h1),b=this.byCollider.get(h2);if(!a||!b)return;
    // Native tip/box and shaft contacts are independent of compliant sphere contacts.
    if((a.kind==='cloth'||b.kind==='cloth')&&this.time<.15)return;
    // Resting contact chatter is not presented as repeated impacts.
    const moving=a.kind==='ball'?a:b.kind==='ball'?b:null;
    if(!moving)return;const vel=len(moving.body.linvel());const other=moving===a?b:a;
    if(['cloth','floor'].includes(other.kind)&&vel<.12)return;
    const key=[h1,h2].sort().join(':');const recent=this.events.slice(-8).some(e=>e.key===key&&this.time-e.time<.12);if(recent)return;
    this.emit({kind:'contact',key,a:{id:a.id??null,kind:a.kind,label:a.label},b:{id:b.id??null,kind:b.kind,label:b.label},label:`${a.label} ↔ ${b.label}`,time:this.time,position:{...moving.body.translation()}});
   });
   this.angularPatchResistance(h);
   if(this.cue&&this.time-this.cue.started>.22)this.removeCue();
   }
   this.world.integrationParameters.dt=this.dt;this.steps++;
   for(const o of this.objects){
    const pos=o.body.translation(),height=pos.y-(o.radius||o.half.y);o.maxHeight=Math.max(o.maxHeight,height);
    o.distance+=len(sub(pos,o.lastPos));o.lastPos={...pos};
    if(this.steps%6===0){const last=o.trail[o.trail.length-1];if(!last||len(sub(pos,last))>.004){o.trail.push({...pos});if(o.trail.length>4000)o.trail.shift();}}
   }
  }
 }
 placementBlocked(o,pos){
  const shape=o.shape==='sphere'?new this.R.Ball(o.radius*.998):new this.R.Cuboid(o.half.x*.998,o.half.y*.998,o.half.z*.998);
  for(const b of this.objects)if(b!==o&&b.collider.intersectsShape(shape,pos,o.body.rotation()))return b.label;
  for(const b of this.statics)if(b.kind!=='cloth'&&b.collider.intersectsShape(shape,pos,o.body.rotation()))return b.label;
  return null;
 }
 move(id,pos,{allowOverlap=false}={}){
  if(!pos||![pos.x,pos.y,pos.z].every(Number.isFinite))return false;
  const o=this.get(id);if(!o)return false;
  const bound=o.radius||o.half.y;pos=V(clamp(pos.x,-3,3),clamp(pos.y,-.78+bound+.00008,2),clamp(pos.z,-2.5,2.5));
  // Cloth/slate is a solid, not a plane through which an editor may push objects.
  if(Math.abs(pos.x)<D.width/2+bound&&Math.abs(pos.z)<D.depth/2+bound&&pos.y<bound&&pos.y>-.2)pos.y=bound+.00005;
  this.world.propagateModifiedBodyPositionsToColliders();
  if(!allowOverlap&&this.placementBlocked(o,pos))return false;
  if(![pos.x,pos.y,pos.z].every(Number.isFinite))return false;this.revision++;o.body.setTranslation(pos,true);o.body.setLinvel(V(),true);o.body.setAngvel(V(),true);o.body.resetForces(true);o.body.resetTorques(true);o.trail=[];o.lastPos={...pos};
  this.world.propagateModifiedBodyPositionsToColliders();return true;
 }
 snapshot({trails=true}={}){
  if(this.cue)throw new Error('Cannot snapshot an active stroke.');
  const metadata=o=>{
   const {body,collider,pairCollider,...meta}=o;
   return {...meta,bodyHandle:body.handle,colliderHandle:collider.handle,pairColliderHandle:pairCollider?.handle,
    pos:{...body.translation()},rot:{...body.rotation()},v:{...body.linvel()},w:{...body.angvel()},
    trail:trails&&o.trail?o.trail.map(p=>({...p})):[],lastPos:{...body.translation()}};
  };
  return{lastStroke:this.lastStroke?{...this.lastStroke}:null,strokeSubsteps:this.strokeSubsteps,world:this.world.takeSnapshot(),time:this.time,steps:this.steps,dt:this.dt,shots:this.shots,nextId:this.nextId,revision:this.revision,
   params:{...this.params},events:this.events.map(e=>({...e})),statics:this.statics.map(metadata),objects:this.objects.map(metadata)};
 }
 restore(s){
  if(this.world){this.removeCue();this.world.free();}
  if(this.queue)this.queue.free();
  this.world=this.R.World.restoreSnapshot(s.world);this.queue=new this.R.EventQueue(true);
  this.params={...s.params};this.lastStroke=s.lastStroke?{...s.lastStroke}:null;this.strokeSubsteps=s.strokeSubsteps||D.strokeSubsteps;this.time=s.time;this.steps=s.steps;this.dt=s.dt;this.shots=s.shots;this.nextId=s.nextId;this.revision=s.revision;
  this.events=s.events.map(e=>({...e}));this.byCollider=new Map();this.cue=null;
  const bind=a=>{
   const o={...a,body:this.world.getRigidBody(a.bodyHandle),collider:this.world.getCollider(a.colliderHandle),
    pairCollider:a.pairColliderHandle===undefined?undefined:this.world.getCollider(a.pairColliderHandle),
    trail:(a.trail||[]).map(p=>({...p})),lastPos:{...a.pos}};
   this.byCollider.set(o.collider.handle,o);if(o.pairCollider)this.byCollider.set(o.pairCollider.handle,o);return o;
  };
  this.statics=s.statics.map(bind);this.objects=s.objects.map(bind);
 }
 static fromSnapshot(R,s){const lab=Object.create(PhysicsLab.prototype);lab.R=R;lab.onEvent=null;lab.lastSnapshot=null;lab.restore(s);return lab;}
 fork(){return PhysicsLab.fromSnapshot(this.R,this.snapshot({trails:false}));}
 undo(){if(!this.lastSnapshot)return false;const old=this.lastSnapshot;this.restore(old);this.lastSnapshot=null;return true;}
 clearTrails(){for(const o of this.objects){o.trail=[];o.distance=0;o.maxHeight=0;}}
 dispose(){this.removeCue();this.queue.free();this.world.free();}
}
G.PhysicsLab=PhysicsLab;G.LabDimensions=D;G.LabDefaults=DEFAULTS;
})(globalThis);
