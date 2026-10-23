'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs');
const R=require('../vendor/rapier.cjs');
for(const name of ['math','physics','forecast','route-rules','route-sampler','optimizer-core','optimizer'])require('../src/'+name+'.js');
let lab,request,result,metrics={};
before(async()=>{await R.init();lab=new PhysicsLab(R);request={snapshot:lab.snapshot({trails:false}),selectedId:1,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0},options:{mode:'three',targetId:2,secondId:3,budget:48,horizon:16,spin:true,objective:'shortest',order:'either',methods:['any']}};});
after(()=>{lab?.dispose();if(process.env.REPAIR_REPORT)fs.writeFileSync(process.env.REPAIR_REPORT,JSON.stringify(metrics,null,2));});

test('fresh default layout finds a three-cushion route from neutral settings, not a supplied winning angle',()=>{
 const original=Buffer.from(lab.world.takeSnapshot()),s=LabOptimizer.createSearch(R,request);let partial=null,firstAt=null,sawFraction=false;
 try{
  while(!LabOptimizer.advanceSearch(s,960)){
   const p=LabOptimizer.progress(s);sawFraction ||= p.fraction>0;
   if(!partial&&p.found){partial=LabOptimizer.previewSearch(s);firstAt=p;assert.ok(partial.results.length>0);assert.ok(partial.partial);assert.ok(p.tested<p.total);}
  }
  result=LabOptimizer.finishSearch(s);assert.equal(result.tested,48);assert.ok(result.results.length>0);assert.ok(sawFraction);assert.ok(partial);
  for(const candidate of result.results){assert.ok(candidate.cushions>=3);assert.ok(LabRouteRules.evaluate(candidate.contacts,{method:'any',firstId:candidate.firstId,secondId:candidate.secondId}).success);}
  assert.equal(lab.shots,0);assert.deepEqual(Buffer.from(lab.world.takeSnapshot()),original);
  metrics={firstFound:firstAt,completed:LabOptimizer.progress(s),candidate:result.results[0],sourceUnchanged:true};
 }finally{LabOptimizer.disposeSearch(s)}
});
test('a newly discovered recommendation exactly matches an independent full-resolution replay',()=>{
 const candidate=result.results[0],f=LabForecast.predict(R,{snapshot:request.snapshot,selectedId:1,settings:candidate.settings,horizon:16}),copy=PhysicsLab.fromSnapshot(R,request.snapshot);
 try{assert.ok(copy.strike(1,candidate.settings).ok);copy.step(f.iterations);let error=0;for(const item of f.final)error=Math.max(error,LabMath.len(LabMath.sub(item.position,copy.get(item.id).body.translation())));assert.equal(error,0);metrics.replay={maxDifferenceM:error,steps:f.iterations};}finally{copy.dispose();}
});
test('near misses get sub-tenth-degree refinement without changing the full-resolution evaluator',()=>{
 const s=ShotSearchCore.createSearch(R,{...request,options:{...request.options,methods:undefined,methodId:'any'}});
 s.count=6;s.pool=[{settings:{angle:27.63,elevation:8,speed:3.7,tipX:.1,tipY:.15},score:101,success:false,firstHit:true,cushions:3,clearance:.04}];
 const a=LabRouteSampler.next(s,x=>x),b=LabRouteSampler.next(s,x=>x);
 assert.ok(Math.abs(a.angle-27.605)<1e-9);assert.ok(Math.abs(b.angle-27.655)<1e-9);
 assert.equal(a.elevation,8);assert.equal(a.speed,3.7);
});
test('full-cut exploration is generated from ball geometry rather than hardcoded world angles',()=>{
 const make=(delta)=>{const copy=structuredClone(request);copy.snapshot.objects.forEach(o=>{const x=o.pos.x,z=o.pos.z;o.pos.x=x*Math.cos(delta)-z*Math.sin(delta);o.pos.z=x*Math.sin(delta)+z*Math.cos(delta)});copy.options={...copy.options,methods:undefined,methodId:'any'};const s=ShotSearchCore.createSearch(R,copy);s.count=2;return LabRouteSampler.next(s,x=>x)};
 const a=make(0),b=make(.2),difference=((b.angle-a.angle+540)%360)-180;assert.ok(Math.abs(difference-.2*180/Math.PI)<1e-6);
});
test('irrecoverable cushion-prefix violations can finish early without changing the route definition',()=>{
 const e=rail=>({kind:'cushion',rail,label:rail,time:0});
 for(const [method,contacts]of [['turn',[e('z+')]],['bank1',[e('x+'),e('z+')]],['bank3',[e('z+'),e('x+'),e('z-'),e('x-')]]]){const r=LabRouteRules.evaluate(contacts,{method,firstId:2,secondId:3});assert.equal(r.invalid,true,method);assert.equal(r.success,false);}
 assert.equal(LabRouteRules.evaluate([e('z+'),e('x+'),e('z-'),e('x-')],{method:'any',firstId:2,secondId:3}).invalid,false);
});
