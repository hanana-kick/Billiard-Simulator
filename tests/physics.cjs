'use strict';
// Tests use the shipped WASM engine, not mocks or a separate trajectory model.
const assert=require('node:assert/strict');
const {test,before}=require('node:test');
const R=require('../vendor/rapier.cjs');
require('../src/math.js');require('../src/physics.js');
const {V,len,sub}=LabMath,D=LabDimensions;
before(async()=>{await R.init();});
const near=(a,b,tol=1e-5)=>assert.ok(Math.abs(a-b)<=tol,`${a} not within ${tol} of ${b}`);
const vectorNear=(a,b,t=1e-5)=>['x','y','z'].forEach(k=>near(a[k],b[k],t));
const run=(params,fn)=>{const lab=new PhysicsLab(R,params);try{return fn(lab);}finally{lab.dispose();}};
const step=(lab,n=1)=>lab.step(Math.round(n/480/lab.dt));
const settings=(extra={})=>({angle:0,elevation:8,tipX:0,tipY:0,speed:2,...extra});
function isolate(lab){for(const o of [...lab.objects])lab.removeObject(o.id);}
function energy(o){const v=o.body.linvel(),w=o.body.angvel();return .5*o.mass*len(v)**2+.5*.4*o.mass*o.radius**2*len(w)**2;}

test('sphere mass, solid-sphere inertia and all translation/rotation axes are real',()=>run({},lab=>{
 const o=lab.objects[0];near(o.body.mass(),.21,1e-7);const I=.4*.21*D.radius**2;
 vectorNear(o.body.principalInertia(),V(I,I,I),1e-9);assert.equal(o.body.isDynamic(),true);
 near(o.body.linearDamping(),0);near(o.body.angularDamping(),0);
}));
test('launch drives only the shaft and tip; the ball changes only after contact',()=>run({},lab=>{
 const o=lab.objects[0],before={p:{...o.body.translation()},v:{...o.body.linvel()},w:{...o.body.angvel()}};
 assert.equal(lab.strike(o.id,settings()).ok,true);
 vectorNear(o.body.translation(),before.p,0);vectorNear(o.body.linvel(),before.v,0);vectorNear(o.body.angvel(),before.w,0);
 near(lab.cue.body.mass()+lab.cue.head.mass(),D.cueMass,1e-6);near(len(lab.cue.body.linvel()),2,1e-6);
 step(lab,12);assert.ok(len(o.body.linvel())>1);assert.ok(lab.events.some(e=>e.kind==='contact'&&e.label.includes('큐 팁')));
}));
test('opposite side contact points generate opposite angular momentum',()=>{
 const out=[];for(const side of [-.4,.4])run({},lab=>{const o=lab.objects[0];assert.equal(lab.strike(o.id,settings({tipX:side})).ok,true);step(lab,12);out.push({v:{...o.body.linvel()},w:{...o.body.angvel()}});});
 assert.ok(out[0].w.y<-1&&out[1].w.y>1);near(out[0].w.y,-out[1].w.y,.01);near(out[0].v.z,-out[1].v.z,.01);
});
test('free flight obeys 3D gravity and does not clamp the ball to cloth',()=>run({},lab=>{
 const o=lab.objects[0];assert.equal(lab.move(o.id,V(-.4,.7,.2)),true);o.body.setLinvel(V(.3,0,-.2),true);
 step(lab,96);near(o.body.translation().y,.7-.5*9.81*.2**2,.002);near(o.body.linvel().y,-1.962,.002);
 near(o.body.translation().x,-.34,.001);near(o.body.translation().z,.16,.001);
}));
test('contact resistance does not damp an airborne spinning body',()=>{
 const results=[];for(const params of [{gravity:0},{gravity:0,rollingLength:0,spinLength:0}])run(params,lab=>{
 const o=lab.objects[0];lab.move(o.id,V(0,.7,0));o.body.setAngvel(V(12,17,-9),true);step(lab,240);results.push({...o.body.angvel()});
 });
 // Compare with the same engine with resistance disabled, rather than hiding
 // the engine's single-precision integration drift with ideal exact equality.
 vectorNear(results[0],results[1],1e-6);vectorNear(results[0],V(12,17,-9),.02);
});
test('equal-mass elastic collision conserves momentum and exchanges velocity',()=>run({gravity:0,ballRestitution:1,rollingLength:0,spinLength:0},lab=>{
 isolate(lab);const a=lab.addSphere(V(-.2,.5,0)),b=lab.addSphere(V(.2,.5,0));a.body.setLinvel(V(2,0,0),true);
 const E=energy(a)+energy(b);step(lab,120);
 near(a.body.linvel().x,0,.03);near(b.body.linvel().x,2,.03);
 near(a.body.linvel().x+b.body.linvel().x,2,.001);near(energy(a)+energy(b),E,.004);
}));
test('zero cloth friction preserves horizontal sliding without artificial rolling',()=>run({clothFriction:0,rollingLength:0,spinLength:0},lab=>{
 isolate(lab);const o=lab.addSphere(V(-1,D.radius,0));step(lab,80);o.body.setLinvel(V(.7,0,0),true);step(lab,200);
 near(o.body.linvel().x,.7,1e-4);near(o.body.angvel().z,0,1e-4);
}));
test('cloth contact friction produces rolling from sliding',()=>run({rollingLength:0,spinLength:0},lab=>{
 isolate(lab);const o=lab.addSphere(V(-1,D.radius,0));step(lab,80);o.body.setLinvel(V(1,0,0),true);step(lab,200);
 const v=o.body.linvel(),w=o.body.angvel();assert.ok(w.z<-5);assert.ok(Math.abs(v.x+D.radius*w.z)<.02);assert.ok(v.x<1&&v.x>0);
}));
test('finite contact patch resistance dissipates energy instead of steering paths',()=>run({},lab=>{
 isolate(lab);const o=lab.addSphere(V(-1,D.radius,0));step(lab,80);o.body.setLinvel(V(.6,0,0),true);o.body.setAngvel(V(0,10,-.6/D.radius),true);
 const E=energy(o);step(lab,480);assert.ok(energy(o)<E*.95);assert.ok(Math.abs(o.body.translation().z)<.001);
}));
test('low-elevation draw no longer receives a spurious upward kick',()=>run({},lab=>{
 const o=lab.objects[0];lab.strike(o.id,settings({elevation:10,tipY:-.45}));step(lab,24);
 assert.ok(o.maxHeight<.001,`spurious lift: ${o.maxHeight}`);assert.ok(o.body.angvel().z>20,'draw must retain backspin after contact');assert.ok(lab.events.some(e=>e.label.includes('큐 팁')));
}));
test('height editing releases a body that falls, collides and rebounds',()=>run({clothRestitution:.4},lab=>{
 const o=lab.objects[0];lab.move(o.id,V(-.4,.45,.3));let hit=false,up=false;
 for(let i=0;i<300;i++){step(lab);if(o.body.translation().y<.04)hit=true;if(hit&&o.body.linvel().y>.2)up=true;}
 assert.ok(hit&&up);assert.ok(o.body.translation().y>D.radius-.001);
}));
test('successive strokes keep the same world and all current body states',()=>run({},lab=>{
 const o=lab.objects[0],world=lab.world,body=o.body;lab.strike(o.id,settings({speed:1}));step(lab,6000);
 const before=lab.snapshot();assert.ok(len(sub(before.objects[0].pos,V(-.66,D.radius,.1)))>.1);
 const result=lab.strike(o.id,settings({angle:90,elevation:35,speed:1}));assert.equal(result.ok,true,result.reason);
 assert.equal(lab.world,world);assert.equal(o.body,body);assert.equal(lab.shots,2);
 for(const a of before.objects){const b=lab.get(a.id);vectorNear(b.body.translation(),a.pos,0);vectorNear(b.body.linvel(),a.v,0);vectorNear(b.body.angvel(),a.w,0);}
}));
test('moving one body leaves other bodies untouched and rejects overlap',()=>run({},lab=>{
 const[a,b]=lab.objects,p={...b.body.translation()};b.body.setLinvel(V(.1,0,.2),true);
 assert.equal(lab.move(a.id,V(-.4,.3,-.2)),true);vectorNear(b.body.translation(),p,0);vectorNear(b.body.linvel(),V(.1,0,.2),1e-7);
 assert.equal(lab.move(a.id,p),false);near(a.body.translation().y,.3,1e-6);
}));
test('undo restores the complete pre-stroke state and count',()=>run({},lab=>{
 const original=lab.snapshot();lab.strike(lab.objects[0].id,settings({tipX:.2}));step(lab,350);assert.equal(lab.undo(),true);
 assert.equal(lab.shots,original.shots);near(lab.time,original.time,0);assert.equal(lab.cue,null);
 for(const a of original.objects){const o=lab.get(a.id);vectorNear(o.body.translation(),a.pos,0);vectorNear(o.body.linvel(),a.v,0);vectorNear(o.body.angvel(),a.w,0);}
}));
test('a non-spherical body uses the same world and 3D contact solver',()=>run({},lab=>{
 const b=lab.addBox(V(-.2,.4,-.3));b.body.setRotation({x:0,y:0,z:Math.sin(.2),w:Math.cos(.2)},true);b.body.setAngvel(V(1,2,3),true);
 step(lab,600);assert.ok(b.body.translation().y>=.04&&b.body.translation().y<.09);assert.ok(Number.isFinite(b.body.rotation().w));
 assert.ok(lab.events.some(e=>e.label.includes('블록')));
}));
test('continuous collision detection prevents high-speed sphere tunnelling',()=>run({gravity:0,ballRestitution:1,rollingLength:0,spinLength:0},lab=>{
 isolate(lab);const a=lab.addSphere(V(-.2,.5,0)),b=lab.addSphere(V(.15,.5,0));a.body.setLinvel(V(20,0,0),true);step(lab,16);
 assert.ok(b.body.linvel().x>19);assert.ok(a.body.translation().x<b.body.translation().x);
}));
