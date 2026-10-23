'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../src/math.js');
globalThis.LabDimensions={width:2.84,depth:1.42};
for(const n of ['route-rules','route-sampler','optimizer-core'])require('../src/'+n+'.js');
const settings={angle:20,elevation:8,speed:3,tipX:.1,tipY:.2};
const snapshot={objects:[{id:1,shape:'sphere',radius:.03075,pos:{x:-.6,y:.03075,z:0}},{id:2,shape:'sphere',radius:.03075,pos:{x:0,y:.03075,z:0}},{id:3,shape:'sphere',radius:.03075,pos:{x:.6,y:.03075,z:.3}}]};
const req={snapshot,selectedId:1,settings,options:{mode:'direct',targetId:2,secondId:3,budget:48,horizon:16,spin:true,objective:'shortest'}};
test('optional search ranges retain backward-compatible fixed elevation',()=>{
 assert.doesNotThrow(()=>ShotSearchCore.validate(req));
 assert.equal(ShotSearchCore.constrainSettings({req,count:2,pool:[]},{...settings,elevation:70}).elevation,8);
});
test('all proposed shot inputs obey speed and elevation ranges',()=>{
 const request={...req,options:{...req.options,minSpeed:1,maxSpeed:2,elevationMode:'search',minElevation:5,maxElevation:15}};
 const angles=new Set();
 for(let count=0;count<48;count++){
  const s=ShotSearchCore.constrainSettings({req:request,count,pool:[]},{...settings,speed:count%2?4:.5});
  assert.ok(s.speed>=1&&s.speed<=2);assert.ok(s.elevation>=5&&s.elevation<=15);angles.add(s.elevation);
 }
 assert.ok(angles.size>20);
});
test('invalid ranges and malformed policy fail before simulating',()=>{
 for(const patch of [{minSpeed:3,maxSpeed:2},{minSpeed:NaN},{maxElevation:81},{minElevation:20,maxElevation:10},{elevationMode:'magic'},{allowMovingTargets:'false'}])assert.throws(()=>ShotSearchCore.validate({...req,options:{...req.options,...patch}}));
});
test('kiss option migrates legacy polarity and explicit new values take precedence',()=>{
 for(const value of [true,false])assert.equal(LabRouteRules.kissAllowed({allowMovingTargets:value}),value);
 assert.equal(LabRouteRules.kissAllowed({}),true);
 assert.equal(LabRouteRules.kissAllowed({allowKiss:false,allowMovingTargets:true}),false);
 assert.equal(LabRouteRules.kissAllowed({allowKiss:true,allowMovingTargets:false}),true);
 assert.throws(()=>ShotSearchCore.validate({...req,options:{...req.options,allowKiss:'false'}}));
});
test('kiss tracker requires an actual repeat impact after separation, not chatter or first moving contact',()=>{
 const t=LabRouteRules.createKissTracker(),hit=(id,impact,separated,time)=>LabRouteRules.observeKiss(t,id,{impact,separated,time});
 assert.equal(hit(2,true,false,0),false);
 assert.equal(hit(2,true,false,.001),false);
 assert.equal(hit(3,true,false,.002),false);
 assert.equal(hit(2,false,true,.003),false);
 assert.equal(hit(2,true,false,.01),true);
 assert.deepEqual(t.contacts,[{id:2,time:.01}]);
});
test('inverse contact seed lies on contact circle and leaves along tangent towards goal',()=>{
 const p={x:-1,z:0},target={x:0,z:0},destination={x:.3,z:.5},r=.0615;
 const contacts=[-1,1].map(sign=>LabRouteSampler.tangentContact(p,target,destination,r,sign)).filter(Boolean);
 assert.ok(contacts.length);
 for(const c of contacts){assert.ok(Math.abs(Math.hypot(c.ghost.x,c.ghost.z)-r)<1e-10);assert.ok(Math.abs(c.normal.x*c.desired.x+c.normal.z*c.desired.z)<1e-9);}
});

test('partition budgets exactly preserve total and reject malformed splits',()=>{
 for(const count of [1,2,3,4,8]){
  const groups=Array.from({length:count},(_,index)=>ShotSearchCore.createSearch(null,{...req,partition:{index,count}}));
  assert.equal(groups.reduce((sum,g)=>sum+g.req.options.budget,0),req.options.budget);
 }
 const empty=ShotSearchCore.createSearch(null,{...req,testBudget:true,options:{...req.options,budget:1},partition:{index:3,count:4}});
 assert.equal(empty.req.options.budget,0);assert.equal(ShotSearchCore.advanceSearch(empty),true);
 for(const partition of [{index:4,count:4},{index:0,count:0},{index:-1,count:2}])assert.throws(()=>ShotSearchCore.createSearch(null,{...req,partition}));
});

test('free route inverse seeds cover mixed prefix and suffix cushion counts',()=>{
 const request={...req,options:{...req.options,mode:'three',methodId:'any'}},search={};
 const seeds=Array.from({length:4*(4+5+6+7)},(_,i)=>LabRouteSampler.freeProposalAt(request,i,search));
 for(let n=3;n<=6;n++)for(let p=0;p<=n;p++)assert.ok(seeds.some(s=>s.prefix===p&&s.suffix===n-p),`${p} before / ${n-p} after`);
 assert.ok(search.seedMaxOrder>=6);
});
test('success archive is not truncated by refinement or display caps',()=>{
 const search=ShotSearchCore.createSearch(null,req);
 search.successes=Array.from({length:25},(_,i)=>({success:true,settings:{...settings,angle:i*.01},distance:i+1}));
 search.pool=search.successes.slice(0,18);
 assert.equal(ShotSearchCore.finishSearch(search).results.length,25);
});
