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
