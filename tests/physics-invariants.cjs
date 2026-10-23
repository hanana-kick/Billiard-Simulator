'use strict';
// Numerical/analytic regression checks, not real-equipment calibration.
// Rapier contact coefficients and convex hull contract:
// https://rapier.rs/docs/user_guides/javascript/colliders/
const assert=require('node:assert/strict');
const {test,before}=require('node:test');
const R=require('../vendor/rapier.cjs');require('../src/math.js');require('../src/physics.js');
const {V,len}=LabMath,D=LabDimensions;
before(async()=>R.init());
const near=(a,b,t)=>assert.ok(Math.abs(a-b)<t,`${a} vs ${b}; tolerance ${t}`);
const isolated=(params,fn,options={})=>{const l=new PhysicsLab(R,params,options);try{for(const o of [...l.objects])l.removeObject(o.id);return fn(l);}finally{l.dispose();}};
const advance=(l,t)=>l.step(Math.round(t/l.dt));
const energy=o=>.5*o.mass*len(o.body.linvel())**2+.2*o.mass*o.radius**2*len(o.body.angvel())**2;

test('unequal-mass elastic impacts conserve momentum and energy at three timestep sizes',()=>{
 for(const hz of [480,960,1920])isolated({gravity:0,ballFriction:0,ballRestitution:1,rollingLength:0,spinLength:0},l=>{
  const m1=.12,m2=.32,v=1.4,a=l.addSphere(V(-.2,.5,0),'A','#ffffff',m1),b=l.addSphere(V(.2,.5,0),'B','#ffffff',m2);
  a.body.setLinvel(V(v,0,0),true);const E=energy(a);advance(l,.35);
  near(a.body.linvel().x,(m1-m2)/(m1+m2)*v,.0001);near(b.body.linvel().x,2*m1/(m1+m2)*v,.0001);
  near(m1*a.body.linvel().x+m2*b.body.linvel().x,m1*v,1e-6);near(energy(a)+energy(b),E,1e-6);
 },{dt:1/hz});
});

function rebound(sign=1,hz=960){return isolated({},l=>{
 const o=l.addSphere(V(sign*1,.03075,.05));advance(l,.1);o.body.setLinvel(V(sign*1,0,.2),true);
 advance(l,.7);return{p:{...o.body.translation()},v:{...o.body.linvel()},w:{...o.body.angvel()}};
},{dt:1/hz});}
test('left/right cushion geometry and friction produce mirror-symmetric rebounds',()=>{
 const a=rebound(1),b=rebound(-1);assert.ok(a.v.x<0&&b.v.x>0);
 near(a.p.x,-b.p.x,.002);near(a.p.z,b.p.z,.002);near(a.p.y,b.p.y,.002);
 near(a.v.x,-b.v.x,.01);near(a.v.z,b.v.z,.01);near(a.w.y,-b.w.y,.1);near(a.w.z,-b.w.z,.1);
});
test('cushion rebound converges within 2 mm and 1 cm/s at 960 versus 1920 Hz',()=>{
 const coarse=rebound(1,480),normal=rebound(1,960),fine=rebound(1,1920);
 for(const k of ['x','y','z']){near(normal.p[k],fine.p[k],.002);near(normal.v[k],fine.v[k],.01);}
 // Explicitly bound the coarser run too, without assuming monotonic convergence
 // through a discontinuous contact event.
 for(const k of ['x','y','z'])near(coarse.p[k],fine.p[k],.005);
});
test('sliding/spinning cloth contact dissipates energy over successive intervals',()=>isolated({},l=>{
 const o=l.addSphere(V(-.8,D.radius,0));advance(l,.1);o.body.setLinvel(V(.65,0,.1),true);o.body.setAngvel(V(2,15,-3),true);
 let previous=energy(o);const initial=previous;
 for(let i=0;i<12;i++){advance(l,.05);const next=energy(o);assert.ok(next<=previous+1e-5,`${next} > ${previous}`);previous=next;}
 assert.ok(previous<initial*.8);
}));
