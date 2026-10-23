'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const R=require('../vendor/rapier.cjs');for(const f of ['math','physics','forecast','route-rules','route-sampler','optimizer-core','optimizer'])require('../src/'+f+'.js');
const rules=LabRouteRules,ball=id=>({kind:'object',id,label:id===2?'노랑':'빨강',time:0}),rail=id=>({kind:'cushion',rail:id,label:({'x+':'오른쪽 쿠션','x-':'왼쪽 쿠션','z+':'앞쪽 쿠션','z-':'뒤쪽 쿠션'})[id],time:0});
const judge=(method,contacts,other={})=>rules.evaluate(contacts,{method,firstId:2,secondId:3,...other});
let lab,snapshot,direct,metrics={};
before(async()=>{await R.init();lab=new PhysicsLab(R);snapshot=lab.snapshot({trails:false});});
after(()=>{lab.dispose();if(process.env.ROUTES_REPORT)fs.writeFileSync(process.env.ROUTES_REPORT,JSON.stringify(metrics,null,2));});
const request=(overrides={})=>({snapshot,selectedId:1,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0},options:{mode:'direct',targetId:2,secondId:3,budget:48,horizon:16,spin:true,objective:'shortest',order:'either',methods:['turn','return','cross','bank3']},...overrides});
function run(req){const s=LabOptimizer.createSearch(R,req);try{while(!LabOptimizer.advanceSearch(s,8000));return LabOptimizer.finishSearch(s)}finally{LabOptimizer.disposeSearch(s)}}
test('direct means zero cushions before both targets, not merely two hits in order',()=>{
 assert.ok(judge('direct',[ball(2),ball(3)]).success);
 for(const c of [[rail('z+'),ball(2),ball(3)],[ball(2),rail('z+'),ball(3)],[ball(3),ball(2)]])assert.equal(judge('direct',c).success,false);
 assert.equal(judge('direct',[ball(2),ball(3),rail('x+')]).total,0);
});
test('three cushion scoring counts contacts before the second target, including repeated sides',()=>{
 assert.ok(judge('any',[ball(2),rail('z+'),rail('z-'),rail('z+'),ball(3)]).success);
 assert.ok(judge('any',[rail('z+'),ball(2),rail('z-'),rail('x+'),ball(3)]).success);
 assert.equal(judge('any',[ball(2),rail('z+'),rail('z-'),ball(3),rail('x+')]).success,false);
});
test('each listed family accepts its explicit contact constraints',()=>{
 const examples={turn:[ball(2),rail('z+'),rail('x+'),rail('z-'),ball(3)],grand:[ball(2),rail('z+'),rail('x+'),rail('z-'),rail('x-'),ball(3)],return:[ball(2),rail('x+'),rail('z+'),rail('x+'),ball(3)],cross:[ball(2),rail('z+'),rail('z-'),rail('z+'),ball(3)],bank1:[rail('z+'),ball(2),rail('x+'),rail('z-'),ball(3)],bank2:[rail('z+'),rail('x+'),ball(2),rail('z-'),ball(3)],bank3:[rail('z+'),rail('x+'),rail('z-'),ball(2),ball(3)],allWalls:[rail('z+'),rail('x+'),rail('z-'),rail('x-'),ball(2),ball(3)],any:[rail('x+'),ball(2),rail('z+'),rail('x+'),ball(3)]};
 for(const [m,c]of Object.entries(examples))assert.ok(judge(m,c).success,m);
});
test('three-bank and all-walls-first reject extra cushions between the targets',()=>{
 assert.equal(judge('bank3',[rail('z+'),rail('x+'),rail('z-'),ball(2),rail('x-'),ball(3)]).success,false);
 assert.equal(judge('allWalls',[rail('z+'),rail('x+'),rail('z-'),rail('z+'),ball(2),ball(3)]).success,false);
 assert.equal(judge('allWalls',[rail('z+'),rail('x+'),rail('z-'),rail('x-'),ball(2),rail('z+'),ball(3)]).success,false);
});
test('unexpected objects and ambiguous simultaneous contact order are not successful routes',()=>{
 assert.equal(judge('direct',[ball(2),ball(4),ball(3)]).success,false);
 assert.equal(judge('direct',[ball(2),ball(3)],{ambiguous:true}).success,false);
 assert.throws(()=>judge('missing',[ball(2),ball(3)]));
});
test('method filters and order are validated, and search allocates independent budgets',()=>{
 const req=request();for(const options of [{...req.options,mode:'three',methods:[]},{...req.options,mode:'three',methods:['fake']},{...req.options,mode:'three',methods:['turn','turn']},{...req.options,order:'random'}])assert.throws(()=>LabOptimizer.validate({...req,options}));
 const s=LabOptimizer.createSearch(R,{...req,options:{...req.options,mode:'three'}});try{assert.equal(s.groups.length,8);assert.equal(LabOptimizer.progress(s).total,192);assert.ok(s.groups.every(g=>g.req.options.budget===24));}finally{LabOptimizer.disposeSearch(s)}
});
test('geometry only proposes finite inputs for every method; outcomes use real physics',()=>{
 const req=request();for(const m of ['direct',...rules.catalog.map(m=>m.id)]){const proposals=LabRouteSampler.proposals({...req,options:{...req.options,methodId:m}});assert.ok(proposals.length,m);assert.ok(proposals.every(p=>Number.isFinite(p.angle)&&Number.isFinite(p.distance)),m);}
});
test('modern direct search finds real zero-cushion two-object hits and leaves the source unchanged',()=>{
 const bytes=Buffer.from(lab.world.takeSnapshot());direct=run(request());assert.ok(direct.results.length);assert.equal(direct.tested,48);assert.equal(direct.evaluated+direct.rejected,48);assert.deepEqual(Buffer.from(lab.world.takeSnapshot()),bytes);assert.equal(lab.shots,0);
 for(const r of direct.results){assert.equal(r.method,'direct');assert.equal(r.cushions,0);assert.ok(rules.evaluate(r.contacts,{method:'direct',firstId:r.firstId,secondId:r.secondId}).success);}
 metrics.direct=direct;
});
test('returned direct shot replays independently with the same contacts and forecast',()=>{
 const result=direct.results[0],forecast=LabForecast.predict(R,{snapshot,selectedId:1,settings:result.settings,horizon:16}),replay=PhysicsLab.fromSnapshot(R,snapshot);
 try{assert.ok(replay.strike(1,result.settings).ok);replay.step(forecast.iterations);let maxError=0;for(const p of forecast.final)maxError=Math.max(maxError,LabMath.len(LabMath.sub(p.position,replay.get(p.id).body.translation())));assert.equal(maxError,0);metrics.replay={maxPositionDifferenceM:maxError,iterations:forecast.iterations};}finally{replay.dispose()}
});
test('real three-cushion fixture matches turning method only, not bank or return labels',()=>{
 const req=request(),result=run({...req,testBudget:true,settings:{angle:-1.09069,elevation:8,speed:4.5,tipX:0,tipY:.15},options:{...req.options,mode:'three',order:'fixed',budget:1,methods:['turn','return','cross','bank3']}});
 assert.equal(result.tested,4);assert.equal(result.results.length,1);assert.equal(result.results[0].method,'turn');assert.deepEqual(result.results[0].contacts.map(c=>c.kind==='object'?c.id:c.rail),[2,'z+','x+','z-',3]);assert.equal(result.methods.find(m=>m.id==='bank3').found,0);metrics.three=result;
});
test('multi-family cancellation disposes active clones without changing live bodies',()=>{
 const bytes=Buffer.from(lab.world.takeSnapshot()),req=request(),s=LabOptimizer.createSearch(R,{...req,options:{...req.options,mode:'three'}});LabOptimizer.advanceSearch(s,1);assert.ok(s.groups.some(g=>g.active));LabOptimizer.disposeSearch(s);assert.ok(s.groups.every(g=>!g.active));assert.deepEqual(Buffer.from(lab.world.takeSnapshot()),bytes);
});
for (const family of ['bank3','allWalls']) test('real physical fixture: '+family+' satisfies cushions-first and two-ball contact order',()=>{
 const fixture=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'fixtures/route-families.json'),'utf8'))[family];
 const trial=new PhysicsLab(R);
 try{
  trial.objects.slice(1).forEach(o=>trial.removeObject(o.id));
  const targets=fixture.points.map((p,i)=>trial.addSphere(p,i===0?'노랑':'빨강'));
  const radius=LabDimensions.radius;
  for(const target of targets){const p=target.body.translation();assert.ok(Math.abs(p.x)<LabDimensions.width/2-radius-.003);assert.ok(Math.abs(p.z)<LabDimensions.depth/2-radius-.003);}
  assert.ok(LabMath.len(LabMath.sub(targets[0].body.translation(),targets[1].body.translation()))>2*radius);
  const original=trial.snapshot({trails:false}),bytes=Buffer.from(trial.world.takeSnapshot());
  const req=request({snapshot:original,testBudget:true,settings:fixture.settings,options:{mode:'three',targetId:targets[0].id,secondId:targets[1].id,budget:1,horizon:16,spin:true,objective:'shortest',order:'fixed',methods:[family]}});
  const result=run(req);assert.equal(result.results.length,1);const candidate=result.results[0];
  assert.ok(rules.evaluate(candidate.contacts,{method:family,firstId:targets[0].id,secondId:targets[1].id}).success);
  assert.deepEqual(Buffer.from(trial.world.takeSnapshot()),bytes);
  const f=LabForecast.predict(R,{snapshot:original,selectedId:1,settings:candidate.settings,horizon:16});
  assert.ok(trial.strike(1,candidate.settings).ok);trial.step(f.iterations);
  let error=0;for(const x of f.final)error=Math.max(error,LabMath.len(LabMath.sub(x.position,trial.get(x.id).body.translation())));
  assert.equal(error,0);metrics[family]={positions:fixture.points,settings:candidate.settings,contacts:candidate.contacts,forecastReplayMaxErrorM:error};
 }finally{trial.dispose();}
});
