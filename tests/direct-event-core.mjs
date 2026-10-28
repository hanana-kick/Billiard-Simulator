import test from 'node:test';
import assert from 'node:assert/strict';
import {runPreparedEvents,polynomialRoots,pairTOI,motionSegment} from '../src/direct-candidate/event-core.mjs';
const table={profile:'finite-rectangle-planar',width:20,height:10};
const material={gravity:10,slidingFriction:0,rollingDeceleration:0,spinDeceleration:0,ballRestitution:1,wallRestitution:1};
const ball=(x,y,vx=0,vy=0)=>({p:[x,y],v:[vx,vy],w:[-vy/.1,vx/.1,0],r:.1});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const run=(balls,options={},m=material)=>runPreparedEvents(table,balls,m,{trace:true,maxEvents:1,...options});
test('prepared moving pair uses relative velocity and globally advances all balls',()=>{
 const r=run([ball(2,2,1),ball(5,2,-1),ball(3,8,.25)]);
 assert.equal(r.status,'incomplete');assert.equal(r.pass,null);assert.equal(r.events[0].kind,'pair');near(r.time,1.4);
 near(r.balls[0].v[0],-1);near(r.balls[1].v[0],1);near(r.balls[2].p[0],3.35);
});
test('nearer object beats farther object regardless of list order (four balls)',()=>{
 const r=run([ball(2,2,1),ball(8,2),ball(4,2),ball(3,8)]);
 assert.equal(r.events[0].j,2);near(r.time,1.8);
});
test('radius-offset finite wall collision',()=>{
 const r=run([ball(18,2,1),ball(2,5),ball(4,7)]);near(r.time,1.9);assert.equal(r.events[0].kind,'wall');near(r.balls[0].p[0],19.9);
});
test('rolling sphere stops before wall without false MISS authority',()=>{
 const r=run([ball(18,2,1),ball(2,5),ball(4,7)],{maxEvents:10},{...material,rollingDeceleration:1});
 assert.equal(r.status,'rest-unscored');assert.equal(r.pass,null);near(r.time,1);near(r.balls[0].p[0],18.5);
});
test('slip-to-roll horizon preempts collision; spin-stop competes globally',()=>{
 const b=ball(2,2,1);b.w=[0,0,0];
 const m={...material,slidingFriction:.1,rollingDeceleration:.2,spinDeceleration:1};
 const r=run([b,ball(4,2),ball(3,8)],{},m);assert.equal(r.events[0].transition,'rolling');near(r.time,2/7);near(r.balls[0].v[0],5/7);
 const spin=ball(3,8);spin.w[2]=.1;
 const s=run([b,ball(4,2),spin],{},m);assert.equal(s.events[0].transition,'spin-stop');near(s.time,.1);
});
test('quartic isolation includes multiple roots and flags grazing',()=>{
 const roots=polynomialRoots([24,-50,35,-10,1],0,5);assert.equal(roots.length,4);roots.forEach((r,i)=>near(r,i+1));
 const a=ball(2,2,1),b=ball(4,2.2);const s={a:[0,0]};const t=pairTOI(a,b,s,s,4);near(t.t,2);assert.equal(t.ambiguous,true);
 const moving=ball(2,2,2),target=ball(4,2);const accelerated=pairTOI(moving,target,{a:[-1,0]},s,1.5);near(accelerated.t,2-Math.sqrt(.4));
});
test('simultaneous, zero-time, overlaps, airborne and unsupported rails reject explicitly',()=>{
 const corner=run([ball(18,8,1,1),ball(2,5),ball(4,7)]);assert.equal(corner.reason,'simultaneous-events');
 assert.equal(run([ball(.1,2,-1),ball(2,5),ball(4,7)]).reason,'zero-time-contact');
 assert.equal(run([ball(2,2),ball(2.1,2),ball(4,7)]).reason,'initial-overlap');
 const b=ball(2,2);b.vz=1;assert.equal(run([b,ball(2,5),ball(4,7)]).status,'unsupported');
 assert.equal(runPreparedEvents({...table,profile:'rapier-convex-rails'},[ball(2,2),ball(2,5),ball(4,7)],material).reason,'unsupported-geometry');
});
test('bounded/no future event stays incomplete, never MISS; input remains immutable',()=>{
 const input=[ball(2,2,1),ball(2,5),ball(4,7)],before=structuredClone(input);
 const r=run(input,{maxTime:.01});assert.equal(r.reason,'no-event-within-time-budget');assert.equal(r.pass,null);assert.deepEqual(input,before);
 assert.equal(run(input).reason,'event-budget');
});
test('Coulomb segment uses solid-sphere 7/2 slip decay, not rolling torque coefficient',()=>{
 const b=ball(2,2,1);b.w=[0,0,0];const s=motionSegment(b,{...material,slidingFriction:.1});near(s.a[0],-1);near(s.aw[1],25);near(s.horizon,2/7);
});
test('horizontal spin at zero translation starts motion and advances uninvolved spin',()=>{
 const b=ball(2,2);b.w=[0,10,0];const spin=ball(4,7);spin.w[2]=5;
 const r=run([b,ball(4,2),spin],{}, {...material,slidingFriction:.1,spinDeceleration:1});
 near(r.time,2/7);assert.ok(r.balls[0].p[0]>2);near(r.balls[0].v[0],2/7);near(r.balls[2].w[2],5-2/7);
});
test('each new regime recomputes event times, rather than retaining stale collision roots',()=>{
 const b=ball(2,2,1);b.w=[0,0,0];
 const r=run([b,ball(4,2),ball(3,8)],{maxEvents:10},{...material,slidingFriction:.1,rollingDeceleration:1});
 assert.equal(r.status,'rest-unscored');assert.deepEqual(r.events.map(e=>e.transition),['rolling','stop']);assert.ok(r.balls[0].p[0]<3);
});
test('finite face outside its span is discarded before selecting the nearer wall',()=>{
 const input=[ball(2,8,1,1),ball(2,5),ball(4,7)];
 for(const balls of [input,[input[2],input[1],input[0]]]){
  const r=run(balls);assert.equal(r.status,'incomplete');assert.equal(r.events[0].axis,1);near(r.time,1.9);
 }
});
test('overflowing polynomial coefficients are unsupported, not a false no-event result',()=>{
 const r=run([ball(2,2,1e300),ball(4,2,-1e300),ball(4,7)]);
 assert.equal(r.status,'unsupported');assert.equal(r.reason,'nonfinite-event-arithmetic');assert.equal(r.pass,null);
 assert.throws(()=>polynomialRoots([1,Infinity],0,1),/nonfinite/);
});
