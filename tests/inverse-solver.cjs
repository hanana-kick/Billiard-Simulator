'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../src/math.js');globalThis.LabDimensions={width:2.84,depth:1.42};
for(const n of ['route-rules','route-sampler','optimizer-core'])require('../src/'+n+'.js');
test('bracketed inverse roots meet the restitution-based contact residual',()=>{
 const zero={ix:0,iz:0,order:0,rails:[]};
 for(const kappa of [1,.965,.8]){
  const roots=LabRouteSampler.inverseRoots({x:-.8,z:0},{x:0,z:0},{x:.4,z:.4},.0615,zero,zero,.03075,kappa);
  assert.ok(roots.length);for(const root of roots){assert.ok(root.residual<1e-7);assert.ok(root.source==='closed-form-stun'||root.iterations<48);assert.ok(Number.isFinite(root.angle));}
 }
});
test('damped least-squares reduces a signed two-dimensional residual in four cue inputs',()=>{
 const residual=[.05,-.04],columns=[[.02,.01],[-.01,.02],[.005,.001],[0,.003]];
 const delta=ShotSearchCore.dampedStep(residual,columns,1e-4);
 assert.equal(delta.length,4);assert.ok(delta.every(Number.isFinite));
 const next=residual.map((r,j)=>r+columns.reduce((sum,c,i)=>sum+c[j]*delta[i],0));
 assert.ok(Math.hypot(...next)<Math.hypot(...residual));
});
test('damping safely handles rank-deficient finite-difference Jacobians',()=>{
 const delta=ShotSearchCore.dampedStep([.1,.1],[[0,0],[0,0],[0,0],[0,0]],1e-4);
 assert.ok(delta.every(x=>x===0));
});

test('primary ideal inverse uses closed-form tangent-circle solutions without iteration',()=>{
 const zero={ix:0,iz:0,order:0,rails:[]};
 const roots=LabRouteSampler.closedFormContacts({x:-.8,z:0},{x:0,z:0},{x:.4,z:.4},.0615,zero,zero,.03075);
 assert.ok(roots.length);for(const root of roots){assert.equal(root.source,'closed-form-stun');assert.equal(root.iterations,undefined);assert.ok(root.residual<1e-12);}
});
test('carom rule permits zero or two cushions while three-cushion free routing still requires three',()=>{
 const object=id=>({kind:'object',id,time:id}),rail={kind:'cushion',rail:'x+',time:1.5};
 for(const contacts of [[object(2),object(3)],[rail,object(2),rail,object(3)]]){
  assert.equal(LabRouteRules.evaluate(contacts,{method:'carom',firstId:2,secondId:3}).success,true);
  assert.equal(LabRouteRules.evaluate(contacts,{method:'any',firstId:2,secondId:3}).success,false);
 }
});
test('numerical probes and steps respect narrow, zero-width, and fixed elevation constraints',()=>{
 for(const options of [{elevationMode:'search',minElevation:10,maxElevation:10.5},{elevationMode:'search',minElevation:10,maxElevation:10},{elevationMode:'fixed',minElevation:10,maxElevation:10.5}]){
  const req={settings:{elevation:8},options:{...options,spin:true,budget:48}},base={success:false,firstHit:true,score:100,residual:[.1,.02,.03],settings:{angle:0,speed:2,tipX:0,tipY:0,elevation:options.elevationMode==='fixed'?8:10.5}};
  if(options.maxElevation===10)base.settings.elevation=10;
  const search={req,count:12,pool:[base]};ShotSearchCore.nextDls(search);
  assert.equal(search.dls.axes.includes('elevation'),options.elevationMode==='search'&&options.maxElevation>options.minElevation);
  if(search.dls.axes.includes('elevation')){search.dls.columns=Array.from({length:4},()=>[1,0,0]);const probe=ShotSearchCore.nextDls(search);assert.ok(probe.elevation>=10&&probe.elevation<=10.5);assert.equal(search.dlsPending.step,-.5);}
  const projected=ShotSearchCore.projectInputs({...base.settings,elevation:80},req);assert.equal(projected.elevation,options.elevationMode==='fixed'?8:options.maxElevation);
 }
});
test('angle finite differences use the short signed perturbation across wrap boundaries',()=>{
 const settings={angle:179.98,elevation:8,speed:2,tipX:0,tipY:0};
 const search={req:{settings,options:{spin:false,budget:48,elevationMode:'fixed'}},count:12,pool:[{success:false,firstHit:true,score:100,residual:[.1,.1,.1],settings}]};
 const s=ShotSearchCore.nextDls(search);assert.equal(s.angle,-179.97);assert.ok(Math.abs(search.dlsPending.step-.05)<1e-9);
});
test('fixed cue speed removes only that numerical axis',()=>{
 const settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0};const search={req:{settings,options:{spin:true,budget:48,minSpeed:2,maxSpeed:2}},count:12,pool:[{success:false,firstHit:true,score:100,residual:[.1,.1,.1],settings}]};ShotSearchCore.nextDls(search);assert.deepEqual(search.dls.axes,['angle','tipX','tipY']);
});
function idealRequest(){return{snapshot:{objects:[{id:1,pos:{x:-.3,z:0},radius:.03075,mass:.21},{id:2,pos:{x:0,z:0},radius:.03075,mass:.21},{id:3,pos:{x:.3,z:.3},radius:.03075,mass:.21}],params:{}},selectedId:1,settings:{angle:0,elevation:0,speed:2,tipX:0,tipY:0},options:{targetId:2,secondId:3,methodId:'carom',mode:'carom',spin:true,inputStrategy:'analytic'}};}
test('closed-form cue input inverse satisfies ideal energy and first-contact stun equations',()=>{
 const req=idealRequest(),seed=LabRouteSampler.inverseInputSeeds(req).find(x=>x.ok);assert.ok(seed);const a=.2*9.81,R=.03075,t=2*seed.geometry.beforeDistance/(seed.ballSpeed+seed.firstContactSpeed);
 assert.ok(Math.abs(seed.ballSpeed**2-seed.firstContactSpeed**2-2*a*seed.geometry.beforeDistance)<1e-10);
 assert.ok(Math.abs(seed.initialBackspin-5*a*t/(2*R))<1e-10);assert.ok(Math.abs(seed.afterContactSpeed**2-seed.lambda*seed.firstContactSpeed**2)<1e-10);
 assert.ok(seed.settings.tipY<0&&seed.settings.tipY>=-.45);assert.ok(seed.terminalSpeed>=.25);assert.equal(seed.approximate,true);
});
test('closed-form input proposals precede sampled fallback and reject out-of-range exact inputs instead of clipping',()=>{
 const req=idealRequest(),search={req,count:1,pool:[]};const settings=LabRouteSampler.next(search,x=>x);assert.equal(search.pendingModel.stage,'closed-form-input-estimate');assert.ok(settings.tipY<0);
 req.options.maxSpeed=.6;const bad=LabRouteSampler.inverseInputSeeds(req);assert.ok(bad.every(x=>!x.ok));assert.ok(bad.some(x=>x.reason==='required-cue-speed-outside-range'));
});
test('ideal input equations handle zero friction and reject singular or unphysical constraints',()=>{
 const req=idealRequest(),geometry=LabRouteSampler.inverseInputSeeds(req)[0].geometry;
 req.snapshot.params={clothFriction:0,rollingLength:0};
 const zero=LabRouteSampler.idealCueInputs(req,geometry,{terminalSpeed:1});assert.ok(zero.ok);assert.equal(zero.settings.tipY,0);assert.equal(zero.initialBackspin,0);assert.equal(zero.terminalSpeed,1);
 assert.equal(LabRouteSampler.idealCueInputs(req,{...geometry,impactCosine:1}).ok,false);
 assert.equal(LabRouteSampler.idealCueInputs(req,geometry,{terminalSpeed:0}).ok,false);
 const immediate=LabRouteSampler.idealCueInputs(req,{...geometry,beforeDistance:0},{terminalSpeed:1});assert.ok(immediate.ok);assert.equal(immediate.initialBackspin,0);
});
test('analytical candidate ordinals are partitioned without duplicate input seeds',()=>{
 const zero={ix:0,iz:0,order:0,rails:[]};
 for(const workers of [1,2,4]){const keys=[];
  for(let index=0;index<workers;index++){
   const req=idealRequest();req.partition={index,count:workers};const seeds=LabRouteSampler.inverseInputSeeds(req).filter(x=>x.ok);
   const search={req,count:0,pool:[],refs:{cue:req.snapshot.objects[0],first:req.snapshot.objects[1]},analyticSeeds:Array.from({length:8},(_,k)=>({...seeds[0],settings:{...seeds[0].settings,angle:k}}))};
   for(let local=0;local<64;local++){search.count=local*workers+index;const s=LabRouteSampler.next(search,x=>x);if(search.pendingModel.stage==='closed-form-input-estimate')keys.push(s.angle);}
  }
  assert.equal(keys.length,8);assert.equal(new Set(keys).size,8);
 }
});
test('analytical elevation is preserved through range constraints instead of being resampled',()=>{
 const req=idealRequest();req.settings.elevation=8;req.options={...req.options,elevationMode:'search',minElevation:0,maxElevation:30};
 const settings={...req.settings,angle:10,speed:1.5,tipY:-.3};const constrained=ShotSearchCore.constrainSettings({req,count:1,pool:[],pendingModel:{stage:'closed-form-input-estimate'}},settings);
 assert.equal(constrained.elevation,8);assert.equal(constrained.tipY,-.3);
});
test('default hybrid strategy never consumes direct cue-input candidates',()=>{
 const req=idealRequest();delete req.options.inputStrategy;
 const s={req,count:1,pool:[],refs:{cue:req.snapshot.objects[0],first:req.snapshot.objects[1]}};
 LabRouteSampler.next(s,x=>x);assert.equal(s.analyticCursor,undefined);assert.equal(s.analyticSeeds,undefined);assert.equal(s.pendingModel.stage,'sampled-or-adaptive-fallback');
});
