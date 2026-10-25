'use strict';
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const R=require('../vendor/rapier.cjs');
for(const n of ['math','physics','route-rules','route-sampler','optimizer-core'])require('../src/'+n+'.js');
const baseline=require('./fixtures/physical-scoring-original-cpu.json'),core=ShotSearchCore;
before(()=>R.init());
const json=x=>JSON.parse(JSON.stringify(x));
for(const c of baseline.cases)test(`original CPU exact outcome and detached read-only replay: ${c.name}`,()=>{
 const source=new PhysicsLab(R);source.addSphere({x:.64,y:LabDimensions.radius+.00005,z:.30},'적구 2');
 const req={snapshot:source.snapshot({trails:false}),selectedId:1,testBudget:true,settings:{...baseline.settings,...c.settings},options:{...baseline.options,...c.options}};
 let t;
 try{
  const search=core.createSearch(R,req);t=core.beginTrial(search,req.settings);assert.ok(t);
  const detached=core.createPhysicalAccumulator({...t.settings},t.searchModel,t.start,t.previous),frames=[];
  let events=[];const onEvent=t.lab.onEvent;t.lab.onEvent=e=>{events.push(structuredClone(e));onEvent(e);};
  const native=t.input;let reads=[];
  t.input={get time(){reads.push(['time',[],native.time]);return native.time;},get dt(){return native.dt;}};
  for(const method of ['cuePresent','allSleeping','position','radius','sphereIds','positiveImpulse'])t.input[method]=(...args)=>{
   const value=method==='sphereIds'?[...native[method](...args)]:native[method](...args);
   reads.push([method,args,structuredClone(value)]);return value;
  };
  let done=false;
  while(!done){events=[];reads=[];const before=t.steps;done=core.stepTrial(search,t,1);if(t.steps!==before)frames.push({events,reads,done,time:native.time});}
  const actual=core.finishTrial(search,t);t=null;
  assert.equal(search.physicsSteps,c.steps);assert.deepEqual(json(actual),c.result);
  // Replay only producer measurements and presentation events, never expected outcomes.
  for(const frame of frames){
   for(const e of frame.events)core.observePhysicalEvent(req,detached,Object.freeze(e));
   let cursor=0;
   const consume=(name,args)=>{const row=frame.reads[cursor++];assert.ok(row,`missing ${name}`);assert.equal(row[0],name);assert.deepEqual(row[1],args);return structuredClone(row[2]);};
   const input={dt:req.snapshot.dt,get time(){return consume('time',[]);}};
   for(const name of ['cuePresent','allSleeping','position','radius','sphereIds','positiveImpulse'])input[name]=(...args)=>consume(name,args);
   Object.freeze(input);
   const stop=core.observePhysicalStep(req,detached,input)||core.finishPhysicalHorizon(req,detached,input);
   assert.equal(stop,frame.done);assert.equal(cursor,frame.reads.length);
  }
  assert.equal(detached.steps,c.steps);
  const before=structuredClone(detached),projected=core.physicalResult(req.options,detached,frames.at(-1).time);
  assert.deepEqual(detached,before,'outcome projection must not mutate accumulator');assert.deepEqual(projected,actual);
 }finally{if(t)t.lab.dispose();source.dispose();}
});
function small(options={}){
 const req={selectedId:1,options:{mode:'carom',methodId:'carom',targetId:2,secondId:3,horizon:2,allowKiss:true,...options}};
 const t=core.createPhysicalAccumulator({speed:2},null,0,{x:0,y:.03,z:0});
 const input={dt:1,time:1,cuePresent:()=>false,allSleeping:()=>false,sphereIds:()=>[1,2,3],positiveImpulse:()=>false,radius:()=>.03,position:id=>({x:id===1?0:id*.2,y:.03,z:0})};
 return {req,t,input};
}
const contact=(id,time=1,kind='ball')=>({kind:'contact',time,a:{id:1,kind:'ball',label:'cue'},b:{id,kind,label:kind==='cushion'?'오른쪽 쿠션':String(id)}});
test('same-time distinct objects remain ambiguous instead of guessed ordered hits',()=>{
 const {req,t,input}=small();core.observePhysicalEvent(req,t,contact(2));core.observePhysicalEvent(req,t,contact(3));
 assert.equal(core.observePhysicalStep(req,t,input),true);assert.equal(t.ambiguous,true);assert.equal(t.invalid,true);assert.equal(core.physicalResult(req.options,t,1).success,false);
});
test('latched four-ball goal still checks opponent impulses but does not sample kisses or path',()=>{
 const {req,t,input}=small({gameMode:'four',opponentId:4});t.success=true;t.goalLatched=true;t.hitTime=.5;
 input.positiveImpulse=(a,b)=>{assert.equal(a,1);assert.equal(b,4);return true;};
 input.sphereIds=()=>{throw Error('post-goal kiss sampling forbidden');};
 assert.equal(core.observePhysicalStep(req,t,input),true);assert.equal(t.fourBallFoul,true);assert.equal(t.length,0);
 assert.equal(core.physicalResult(req.options,t,1).failureReason,'four-ball-opponent-or-off-table');
});
test('full-rest and cue-tail horizon invalidations retain exact failure reasons',()=>{
 for(const four of [true,false]){
  const {req,t,input}=small(four?{gameMode:'four',opponentId:4}:{});t.success=true;t.goalLatched=true;t.steps=2;
  input.cuePresent=()=>!four;
  assert.equal(core.finishPhysicalHorizon(req,t,input),true);assert.equal(t.verificationIncomplete,true);
  assert.equal(core.physicalResult(req.options,t,2).failureReason,four?'four-ball-shot-incomplete':'cue-tail-incomplete');
 }
});
test('presentation fouls survive goal latch and cue obstruction has failure precedence',()=>{
 const {req,t}=small({gameMode:'four',opponentId:4});t.success=true;t.goalLatched=true;
 core.observePhysicalEvent(req,t,contact(4));core.observePhysicalEvent(req,t,{kind:'cue-obstruction'});
 assert.equal(t.fourBallFoul,true);assert.equal(t.cueObstructed,true);assert.deepEqual(t.contacts,[]);
 assert.equal(core.physicalResult(req.options,t,1).failureReason,'cue-obstruction');
});
test('adapter construction does not eagerly query world, positions, impulses or clearance',()=>{
 const lab=new Proxy({}, {get(){throw Error('eager physical query');}});
 assert.doesNotThrow(()=>core.physicalInputs(lab));
});
test('outer-step kiss sampling distinguishes separation and return independently of presentation debounce',()=>{
 const {req,t,input}=small({methodId:undefined,allowKiss:false});let impact=true,separated=false;
 input.sphereIds=()=>[1,2];input.positiveImpulse=()=>impact;input.position=id=>({x:id===1?0:separated?.2:.06,y:.03,z:0});
 core.observePhysicalStep(req,t,input);assert.equal(t.kisses.contacts.length,0);
 impact=false;separated=true;core.observePhysicalStep(req,t,input);
 impact=true;separated=false;core.observePhysicalStep(req,t,input);
 assert.equal(t.kisses.contacts.length,1);assert.equal(t.invalid,true);
});
