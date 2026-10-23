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
 for(const patch of [{minSpeed:3,maxSpeed:2},{minSpeed:NaN},{maxElevation:86},{minElevation:20,maxElevation:10},{elevationMode:'magic'},{allowMovingTargets:'false'}])assert.throws(()=>ShotSearchCore.validate({...req,options:{...req.options,...patch}}));
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
 for(const count of [1,2,3,4,8,16,32,64]){
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

test('modern 32-way worker partitions preserve the complete finite candidate budget',()=>{require('../src/optimizer.js');const request={...req,options:{...req.options,mode:'three',methods:['any'],order:'either'}};const searches=Array.from({length:32},(_,index)=>LabOptimizer.createSearch(null,{...request,partition:{index,count:32}}));assert.equal(searches.reduce((n,s)=>n+s.groups.reduce((m,g)=>m+g.req.options.budget,0),0),48);for(const s of searches)LabOptimizer.disposeSearch(s);assert.throws(()=>LabOptimizer.createSearch(null,{...request,partition:{index:0,count:65}}));});
test('staged feasibility observations fold by candidate order and clear after a passed clearance',()=>{
 const g=ShotSearchCore.createSearch(null,req);g.count=4;g.feasibility={settings,distance:-.2,probes:4};g.dls={};g.dlsPending={};
 const blocked=distance=>({rejected:true,clearancePassed:false,resetDls:true,feasibility:{settings,distance,probes:0},feasibilityStats:{checked:1,blocked:1,restored:0}});
 ShotSearchCore.commitCandidate(g,{ordinal:1},blocked(-.1));assert.equal(g.feasibility.distance,-.1);assert.equal(g.feasibility.probes,4);assert.equal(g.dls,null);
 ShotSearchCore.commitCandidate(g,{ordinal:2},blocked(-.3));assert.equal(g.feasibility.distance,-.1);
 ShotSearchCore.commitCandidate(g,{ordinal:3},{rejected:true,clearancePassed:true,resetDls:false,feasibility:null,feasibilityStats:{checked:1,blocked:0,restored:0}});assert.equal(g.feasibility,null);assert.equal(g.feasibilityStats.restored,1);assert.equal(g.rejected,3);assert.equal(g.count,4);
});
test('staged method progress counts committed work rather than reserved wave candidates',()=>{
 require('../src/optimizer.js');const s=LabOptimizer.createStagedSearch(null,{...req,options:{...req.options,mode:'three',methods:['any'],order:'either'}}),jobs=LabOptimizer.planWave(s);let p=LabOptimizer.stagedResult(s);assert.equal(jobs.length,8);assert.equal(p.tested,0);assert.equal(p.methods.reduce((n,m)=>n+m.tested,0),0);
 assert.throws(()=>LabOptimizer.commitWave(s,[]));LabOptimizer.commitWave(s,jobs.map(j=>({id:j.id,outcome:{rejected:true,clearancePassed:false,feasibility:null,feasibilityStats:{checked:1,blocked:1,restored:0},resetDls:true}})).reverse());p=LabOptimizer.stagedResult(s);assert.equal(p.tested,8);assert.equal(p.methods.reduce((n,m)=>n+m.tested,0),8);assert.equal(p.total,48);
});

test('family full-angle exploration spans all quadrants and elevation endpoints without discrete preset restriction',()=>{
 for(const mode of ['direct','carom','three']){const request={...req,testBudget:true,options:{...req.options,mode,methodId:mode==='three'?'any':mode,elevationMode:'search',minElevation:0,maxElevation:85,budget:320}},search=ShotSearchCore.createSearch(null,request);const broad=[];for(let i=0;i<320;i++){const j=ShotSearchCore.proposeCandidate(search,false);if(j.searchModel?.stage==='full-angle-exploration')broad.push(j.settings);}assert.equal(new Set(broad.map(s=>Math.floor((s.angle+180)/90))).size,4);assert.ok(broad.some(s=>s.elevation===0));assert.ok(broad.some(s=>s.elevation===85));assert.ok(new Set(broad.map(s=>s.elevation)).size>20);assert.ok(broad.every(s=>s.elevation>=0&&s.elevation<=85));}
});
test('explicit fixed elevation is preserved and local/current/analytic stages do not acquire unrelated elevation',()=>{for(const stage of ['current-user-settings','closed-form-input-estimate','local-physical-refinement']){const request={...req,options:{...req.options,elevationMode:'search',minElevation:0,maxElevation:85}};assert.equal(ShotSearchCore.constrainSettings({req:request,count:12,pool:[],pendingModel:{stage}},settings).elevation,8);}const request={...req,options:{...req.options,elevationMode:'fixed',minElevation:0,maxElevation:85}};for(let count=0;count<48;count++)assert.equal(ShotSearchCore.constrainSettings({req:request,count,pool:[]},{...settings,elevation:85}).elevation,8);assert.doesNotThrow(()=>ShotSearchCore.validate({...request,settings:{...settings,elevation:85}}));});

test('full-angle exploration remains global even when a near-miss refinement pool exists',()=>{const request={...req,options:{...req.options,elevationMode:'search',minElevation:0,maxElevation:85}};for(const elevationFraction of [0,.12345,1]){const got=ShotSearchCore.constrainSettings({req:request,count:28,pool:[{settings}],pendingModel:{stage:'full-angle-exploration',elevationFraction}},settings);assert.ok(Math.abs(got.elevation-85*elevationFraction)<.00001);}});

test('physical failure diagnostics preserve incomplete four-ball verification separately from a foul',()=>{require('../src/optimizer.js');const request={...req,options:{...req.options,mode:'three',methods:['any'],order:'either'}},s=LabOptimizer.createSearch(null,request);for(const [i,reason] of ['four-ball-shot-incomplete','four-ball-opponent-or-off-table'].entries()){const g=s.groups[i];g.count=1;ShotSearchCore.acceptCandidate(g,{settings,success:false,failureReason:reason,score:600,distance:0,clearance:0},1);}assert.deepEqual(LabOptimizer.finishSearch(s).failureReasons,{'four-ball-shot-incomplete':1,'four-ball-opponent-or-off-table':1});});
