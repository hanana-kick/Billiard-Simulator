'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {test,before,after}=require('node:test');
const R=require('../vendor/rapier.cjs');require('../src/math.js');require('../src/physics.js');require('../src/forecast.js');
const {V,len,add,sub,mul,cross}=LabMath,D=LabDimensions,metrics=[];
const settings=(x={})=>({angle:0,elevation:8,tipX:0,tipY:0,speed:2,...x});
const near=(actual,expected,tol)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} versus ${expected}, tolerance ${tol}`);
const run=(params,fn,options={})=>{const l=new PhysicsLab(R,params,options);try{return fn(l)}finally{l.dispose()}};
const isolate=l=>l.objects.slice().forEach(o=>l.removeObject(o.id));
const advance=(l,t)=>l.step(Math.round(t/l.dt));
const I=o=>.4*o.mass*o.radius**2;
const energy=o=>.5*o.mass*len(o.body.linvel())**2+.5*I(o)*len(o.body.angvel())**2;
const angular=o=>add(cross(o.body.translation(),mul(o.body.linvel(),o.mass)),mul(o.body.angvel(),I(o)));
const record=(name,values)=>metrics.push({name,...values});
before(async()=>{await R.init()});
after(()=>{if(process.env.QA_REPORT)fs.writeFileSync(process.env.QA_REPORT,JSON.stringify({engine:R.version(),dt:D.dt,metrics},null,2));});
test('free fall matches analytic displacement and velocity after 0.2 s',()=>run({},l=>{
 const o=l.objects[0];l.move(o.id,V(0,.7,0));advance(l,.2);const measured=o.body.translation().y,expected=.7-.5*9.81*.2**2;
 record('free-fall',{measured,expected,errorMm:Math.abs(measured-expected)*1000,velocity:o.body.linvel().y});near(measured,expected,.00015);near(o.body.linvel().y,-1.962,.0002);
}));
test('friction turns sliding into rolling at 5/7 of initial speed',()=>run({rollingLength:0,spinLength:0},l=>{
 isolate(l);const o=l.addSphere(V(-1,D.radius,0));advance(l,.15);o.body.setLinvel(V(1,0,0),true);advance(l,.3);
 const measured=o.body.linvel().x,expected=5/7,slip=measured+D.radius*o.body.angvel().z;
 record('slide-to-roll',{measured,expected,relativeErrorPercent:100*Math.abs(measured-expected)/expected,slip});near(measured,expected,.0015);near(slip,0,.002);
}));
test('rolling-resistance deceleration matches the configured contact torque law',()=>run({spinLength:0},l=>{
 isolate(l);const o=l.addSphere(V(-1,D.radius,0));advance(l,.15);o.body.setLinvel(V(.6,0,0),true);o.body.setAngvel(V(0,0,-.6/D.radius),true);advance(l,.5);
 const expected=.6-5/7*9.81*l.params.rollingLength/D.radius*.5,measured=o.body.linvel().x;
 record('rolling-resistance',{measured,expected,relativeErrorPercent:100*Math.abs(measured-expected)/expected});near(measured,expected,.001);
}));
test('torsional-resistance spin decay matches N times resistance length',()=>run({rollingLength:0},l=>{
 isolate(l);const o=l.addSphere(V(-1,D.radius,0));advance(l,.15);o.body.setAngvel(V(0,10,0),true);advance(l,.5);
 const expected=10-9.81*l.params.spinLength/(.4*D.radius**2)*.5,measured=o.body.angvel().y;
 record('torsional-resistance',{measured,expected,relativeErrorPercent:100*Math.abs(measured-expected)/expected});near(measured,expected,.02);
}));
test('compliant center impact agrees with a force-clamped Kelvin-Voigt reference',()=>run({gravity:0,rollingLength:0,spinLength:0},l=>{
 isolate(l);const o=l.addSphere(V(0,.5,0));const start={...o.body.linvel()};assert.equal(l.strike(o.id,settings({elevation:0})).ok,true);assert.deepEqual({...o.body.linvel()},start);advance(l,.06);
 const m=D.cueMass*D.mass/(D.cueMass+D.mass),k=l.params.tipNormalStiffness,c=l.params.tipNormalDamping,alpha=c/(2*m),wd=Math.sqrt(k/m-alpha*alpha),theta=Math.PI-Math.atan(c*wd/(k-c*alpha)),tc=theta/wd,e=-Math.exp(-alpha*tc)*(Math.cos(theta)-alpha/wd*Math.sin(theta));
 const expected=(1+e)*D.cueMass/(D.cueMass+D.mass)*2,measured=o.body.linvel().x;
 record('center-cue-impact',{measured,expected,relativeErrorPercent:100*Math.abs(measured-expected)/expected});near(measured,expected,.025);near(len(o.body.angvel()),0,.001);
}));
test('inelastic equal-mass impact matches both analytical outgoing velocities',()=>run({gravity:0,ballFriction:0,ballRestitution:.6,rollingLength:0,spinLength:0},l=>{
 isolate(l);const a=l.addSphere(V(-.2,.5,0)),b=l.addSphere(V(.2,.5,0));a.body.setLinvel(V(2,0,0),true);advance(l,.3);
 const va=a.body.linvel().x,vb=b.body.linvel().x;record('inelastic-collision',{measuredA:va,expectedA:.4,measuredB:vb,expectedB:1.6,momentumError:Math.abs((va+vb)*D.mass-2*D.mass)});near(va,.4,.002);near(vb,1.6,.002);near(va+vb,2,1e-5);
}));
test('oblique frictional impact conserves total linear and angular momentum',()=>run({gravity:0,rollingLength:0,spinLength:0},l=>{
 isolate(l);const a=l.addSphere(V(-.18,.5,.02)),b=l.addSphere(V(.18,.5,0));a.body.setLinvel(V(2,0,0),true);a.body.setAngvel(V(0,10,0),true);
 const beforeP=add(mul(a.body.linvel(),D.mass),mul(b.body.linvel(),D.mass)),beforeL=add(angular(a),angular(b)),E=energy(a)+energy(b);advance(l,.25);
 const deltaP=len(sub(add(mul(a.body.linvel(),D.mass),mul(b.body.linvel(),D.mass)),beforeP)),deltaL=len(sub(add(angular(a),angular(b)),beforeL));
 record('oblique-impact',{linearMomentumError:deltaP,angularMomentumError:deltaL,energyBefore:E,energyAfter:energy(a)+energy(b)});assert.ok(deltaP<1e-5);assert.ok(deltaL<.0002);assert.ok(energy(a)+energy(b)<=E*1.001);
}));
test('cloth vertical restitution matches the configured rebound speed ratio',()=>run({clothRestitution:.4,rollingLength:0,spinLength:0},l=>{
 isolate(l);const o=l.addSphere(V(0,D.radius+.2,0));let up=0;for(let i=0;i<Math.round(.35/l.dt);i++){l.step();up=Math.max(up,o.body.linvel().y);}
 const measured=up/Math.sqrt(2*9.81*.2);record('vertical-restitution',{measured,expected:.4,relativeErrorPercent:100*Math.abs(measured-.4)/.4});near(measured,.4,.003);
}));
test('zero ball friction/restitution stays finite without disabling cloth friction',()=>run({ballFriction:0,ballRestitution:0},l=>{
 const o=l.objects[0];near(l.statics[0].collider.friction(),.2,1e-7);near(l.statics[0].collider.restitution(),.2,1e-7);near(o.pairCollider.friction(),0,0);near(o.pairCollider.restitution(),0,0);advance(l,.1);
 for(const o of l.objects)for(const n of Object.values(o.body.translation()))assert.ok(Number.isFinite(n));
 record('zero-coefficient',{clothFriction:l.statics[0].collider.friction(),clothRestitution:l.statics[0].collider.restitution(),finite:true});
}));
test('two collision channels do not double sphere mass or inertia',()=>run({},l=>{
 for(const o of l.objects){near(o.body.mass(),D.mass,1e-7);near(o.body.principalInertia().x,I(o),1e-9);assert.notEqual(o.collider.collisionGroups(),o.pairCollider.collisionGroups());}
}));
test('invalid parameters are rejected atomically before the live world is changed',()=>run({},l=>{
 const original={...l.params};assert.throws(()=>l.setParams({gravity:NaN}),RangeError);assert.throws(()=>l.setParams({ballRestitution:1.1}),RangeError);assert.deepEqual(l.params,original);
 assert.equal(l.strike(1,settings({tipX:2})).ok,false);assert.equal(l.shots,0);assert.equal(l.move(1,V(NaN,0,0)),false);
}));
test('native world snapshot preserves sleeping state and solver continuation',()=>run({},l=>{
 advance(l,3);assert.ok(l.objects.every(o=>o.body.isSleeping()));const clone=l.fork();try{
  assert.deepEqual(clone.objects.map(o=>o.body.isSleeping()),l.objects.map(o=>o.body.isSleeping()));
  l.strike(1,settings({tipX:.3}));clone.strike(1,settings({tipX:.3}));advance(l,.5);advance(clone,.5);
  for(const o of l.objects){const c=clone.get(o.id);assert.deepEqual({...o.body.translation()},{...c.body.translation()});assert.deepEqual({...o.body.angvel()},{...c.body.angvel()});}
 }finally{clone.dispose();}
}));
test('forecast leaves original world bytes, shot count and event log unchanged',()=>run({},l=>{
 const before=l.snapshot(),bytes=Buffer.from(before.world);LabForecast.predict(R,{snapshot:before,selectedId:1,settings:settings(),horizon:4});const after=l.snapshot();
 assert.equal(Buffer.compare(bytes,Buffer.from(after.world)),0);assert.equal(after.shots,0);assert.equal(after.time,0);assert.deepEqual(after.events,before.events);
 record('prediction-isolation',{snapshotByteChanges:0,shotCount:after.shots});
}));
test('eight-second prediction and actual integration agree at every sampled point',()=>run({},l=>{
 const before=l.snapshot(),s=settings({tipX:.25,tipY:-.15}),pred=LabForecast.predict(R,{snapshot:before,selectedId:1,settings:s,horizon:8});
 assert.equal(l.strike(1,s).ok,true);let maxError=0,checked=0,indices=pred.tracks.map(()=>1);
 for(let i=1;i<=pred.iterations;i++){
  l.step();pred.tracks.forEach((track,j)=>{const point=track.points[indices[j]];if(point&&Math.abs(point.t-i*l.dt)<l.dt*.1){maxError=Math.max(maxError,len(sub(point,l.get(track.id).body.translation())));indices[j]++;checked++;}});
 }
 for(const end of pred.final)maxError=Math.max(maxError,len(sub(end.position,l.get(end.id).body.translation())));
 record('prediction-replay',{maxPositionErrorMeters:maxError,samplesChecked:checked,seconds:pred.seconds,steps:pred.iterations});assert.ok(checked>300);near(maxError,0,1e-9);
}));
test('prediction includes elevated three-dimensional paths, not flattened 2D bounces',()=>run({},l=>{
 const o=l.objects[0];l.move(o.id,V(-.5,.30,.05));const result=LabForecast.predict(R,{snapshot:l.snapshot(),selectedId:o.id,settings:settings({elevation:0}),horizon:1});
 const ys=result.tracks[0].points.map(p=>p.y);assert.ok(Math.max(...ys)-Math.min(...ys)>.20);assert.ok(ys.every(Number.isFinite));
}));
test('undo restores exact serialized engine state including its sleep/contact cache',()=>run({},l=>{
 advance(l,3);const before=l.snapshot();l.strike(1,settings());advance(l,.5);assert.equal(l.undo(),true);
 assert.equal(Buffer.compare(Buffer.from(before.world),Buffer.from(l.snapshot().world)),0);assert.equal(l.steps,before.steps);
}));
test('short off-center impact sensitivity is measured across three timesteps',()=>{
 const rows=[];for(const hz of [480,960,1920])run({gravity:0,rollingLength:0,spinLength:0},l=>{
  isolate(l);const o=l.addSphere(V(0,.5,0));l.strike(o.id,settings({elevation:0,tipX:.4,tipY:-.2}));advance(l,.1);rows.push({hz,speed:len(o.body.linvel()),spin:len(o.body.angvel())});
 },{dt:1/hz});
 const a=rows[1],b=rows[2],speedChangePercent=100*Math.abs(a.speed-b.speed)/b.speed,spinChangePercent=100*Math.abs(a.spin-b.spin)/b.spin;
 record('timestep-sensitivity',{rows,speedChangePercent,spinChangePercent});assert.ok(speedChangePercent<5);assert.ok(spinChangePercent<10);
 // This is a numerical-sensitivity measurement, not validation against real equipment.
});
