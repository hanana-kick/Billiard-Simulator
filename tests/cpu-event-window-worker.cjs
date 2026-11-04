'use strict';

// Exercise the actual worker entry without importing or initializing physics.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const workerSource=fs.readFileSync(require.resolve('../src/optimizer-worker.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
async function microtasks(){for(let i=0;i<5;i++)await Promise.resolve();}

function harness(options={}){
 const calls=[],sent=[],timers=[];let clock=0,initializations=0;
 const api=(name,hooks={})=>({
  begin(R,req,topology,settings,beginOptions){
   const evaluation={owner:name,req,purpose:beginOptions.purpose,steps:7};
   calls.push({name,method:'begin',R,req,topology,settings,options:beginOptions,evaluation});
   return hooks.begin?hooks.begin(evaluation,beginOptions):evaluation;
  },
  advance(evaluation,budget){calls.push({name,method:'advance',evaluation,budget});return hooks.advance?hooks.advance(evaluation,budget):true;},
  finish(evaluation){calls.push({name,method:'finish',evaluation});return hooks.finish?hooks.finish(evaluation):{owner:name,purpose:evaluation.purpose};},
  dispose(evaluation){calls.push({name,method:'dispose',evaluation});if(hooks.dispose)hooks.dispose(evaluation);}
 });
 const original=api('original',options.originalHooks),window=api('window',options.windowHooks);
 const core={
  beginCandidate(R,job){calls.push({name:'legacy',method:'begin',R,job});return {search:{},trial:{steps:1,lab:{dispose(){calls.push({name:'legacy',method:'dispose'});}}}};},
  stepTrial(search,trial,budget){calls.push({name:'legacy',method:'advance',search,trial,budget});return true;},
  finishCandidate(evaluation){calls.push({name:'legacy',method:'finish',evaluation});return {owner:'legacy'};}
 };
 const context={
  RAPIER:{init(){initializations++;return options.ready||Promise.resolve();}},
  performance:{now:()=>clock+=40},
  setTimeout(callback,delay){timers.push({callback,delay});return timers.length;},
  clearTimeout(){},
  LabInverseEvents:original,
  ShotSearchCore:core,
  self:{postMessage(message){sent.push(message);}}
 };
 if(options.withWindow!==false)context.LabInverseEventsWindow=window;
 if(options.admission)context.LabSourceFinalizationRequest=options.admission;
 vm.createContext(context);
 vm.runInContext(workerSource,context,{filename:'src/optimizer-worker.js'});
 const run=(job={},ids={})=>context.self.onmessage({data:{type:'evaluate',requestId:ids.requestId??11,candidateId:ids.candidateId??17,job:{kind:'inverse-constraint',req:{},topology:{id:'topology'},settings:{angle:1},purpose:'trial',eventPrefixOnly:true,...job}}});
 return {context,calls,sent,timers,original,window,run,initializations:()=>initializations,
  cancel:()=>context.self.onmessage({data:{type:'cancel'}}),
  async releaseTimer(){assert.ok(timers.length,'worker yielded cooperatively');const timer=timers.shift();assert.equal(timer.delay,0);timer.callback();await microtasks();}
 };
}

for(const [label,marker,owner] of [['true',true,'window'],['false',false,'original'],['absent',undefined,'original'],['string','true','original']]){
 test('actual worker uses strict window marker: '+label,async()=>{
  const h=harness(),job=marker===undefined?{}:{prefixMismatchWindow:marker};
  await h.run(job);
  assert.equal(h.initializations(),1);
  assert.deepEqual(h.calls.map(c=>[c.name,c.method]),[[owner,'begin'],[owner,'advance'],[owner,'finish']]);
  const begin=h.calls[0];
  assert.equal(begin.R,h.context.RAPIER);
  assert.deepEqual(plain(begin.options),{purpose:'trial',eventPrefixOnly:true,...(marker===true?{prefixMismatchWindow:true}:{})});
  assert.equal(h.calls[1].budget,64);
  assert.ok(h.calls.slice(1).every(c=>c.evaluation===begin.evaluation));
  assert.deepEqual(plain(h.sent.filter(m=>m.outcome)),[{requestId:11,candidateId:17,outcome:{owner,purpose:'trial'}}]);
  assert.ok(h.sent.every(m=>m.requestId===11&&m.candidateId===17));
  assert.equal(h.sent[0].steps,0);
  assert.equal(h.timers.length,0);
 });
}

test('default original evaluator works without any window global',async()=>{
 const h=harness({withWindow:false});await h.run({eventPrefixOnly:'true'});
 assert.equal(h.calls[0].name,'original');
 assert.deepEqual(plain(h.calls[0].options),{purpose:'trial',eventPrefixOnly:false});
 assert.equal(h.sent.at(-1).outcome.owner,'original');
});

test('window mode forwards all purposes to the selected wrapper, unchanged',async()=>{
 for(const purpose of ['residual','jacobian','trial','verify','evaluate','clearance']){
  const h=harness(),req={tag:purpose},topology={id:purpose},settings={angle:3};
  await h.run({prefixMismatchWindow:true,eventPrefixOnly:false,purpose,req,topology,settings});
  const begin=h.calls[0];
  assert.equal(begin.name,'window');assert.equal(begin.req,req);assert.equal(begin.topology,topology);assert.equal(begin.settings,settings);
  assert.deepEqual(plain(begin.options),{purpose,eventPrefixOnly:false,prefixMismatchWindow:true});
  assert.equal(h.sent.at(-1).outcome.purpose,purpose);
 }
});

test('window marker never redirects a non-inverse candidate',async()=>{
 const h=harness({withWindow:false});await h.run({kind:'candidate',prefixMismatchWindow:true});
 assert.deepEqual(h.calls.map(c=>[c.name,c.method]),[['legacy','begin'],['legacy','advance'],['legacy','finish']]);
 assert.equal(h.sent.at(-1).outcome.owner,'legacy');
});

test('requesting a missing wrapper fails instead of falling back',async()=>{
 const h=harness({withWindow:false});await h.run({prefixMismatchWindow:true});
 assert.equal(h.calls.length,0);assert.equal(h.sent.length,1);
 assert.match(h.sent[0].error,/Requested inverse evaluator unavailable/);
 assert.equal(h.sent[0].requestId,11);assert.equal(h.sent[0].candidateId,17);
 assert.equal(h.sent.some(m=>m.outcome),false);
});

test('cancel while initialization is pending cannot begin stale evaluation',async()=>{
 const gate=deferred(),h=harness({ready:gate.promise});
 const pending=h.run({prefixMismatchWindow:true});await h.cancel();gate.resolve();await pending;
 assert.deepEqual(h.calls,[]);assert.deepEqual(h.sent,[]);
});

test('new generation supersedes an initialization-blocked job',async()=>{
 const gate=deferred(),h=harness({ready:gate.promise});
 const old=h.run({prefixMismatchWindow:true},{requestId:1,candidateId:1});
 const fresh=h.run({prefixMismatchWindow:false},{requestId:2,candidateId:2});
 gate.resolve();await Promise.all([old,fresh]);
 assert.ok(h.calls.every(c=>c.name==='original'));
 assert.equal(h.calls.filter(c=>c.method==='begin').length,1);
 assert.ok(h.sent.length>0&&h.sent.every(m=>m.requestId===2&&m.candidateId===2));
});

test('cancel disposes through captured evaluator after the global changes',async()=>{
 const h=harness({windowHooks:{advance:()=>false}});
 const pending=h.run({prefixMismatchWindow:true});await microtasks();
 const evaluation=h.calls[0].evaluation;
 assert.equal(h.timers.length,1);
 h.context.LabInverseEventsWindow=h.original;
 await h.cancel();const messagesBeforeResume=h.sent.length;await h.releaseTimer();await pending;
 assert.deepEqual(h.calls.map(c=>[c.name,c.method]),[['window','begin'],['window','advance'],['window','dispose']]);
 assert.equal(h.calls.at(-1).evaluation,evaluation);
 assert.equal(h.sent.length,messagesBeforeResume);assert.equal(h.sent.some(m=>m.outcome||m.error),false);
});

test('new job publishes its result while the stale yielded job only disposes',async()=>{
 const h=harness({windowHooks:{advance:()=>false}});
 const old=h.run({prefixMismatchWindow:true},{requestId:1,candidateId:3});await microtasks();
 await h.run({prefixMismatchWindow:false},{requestId:2,candidateId:4});
 await h.releaseTimer();await old;
 assert.equal(h.calls.filter(c=>c.name==='window'&&c.method==='dispose').length,1);
 assert.equal(h.calls.filter(c=>c.name==='window'&&c.method==='finish').length,0);
 assert.deepEqual(plain(h.sent.filter(m=>m.outcome)),[{requestId:2,candidateId:4,outcome:{owner:'original',purpose:'trial'}}]);
 assert.equal(h.sent.some(m=>m.error),false);
});

for(const method of ['advance','finish']){
 test('captured window evaluator disposes after '+method+' fails',async()=>{
  let h;
  h=harness({windowHooks:{[method](){h.context.LabInverseEventsWindow=h.original;throw Error('mock '+method+' failure');}}});
  await h.run({prefixMismatchWindow:true});
  assert.equal(h.calls.at(-1).name,'window');assert.equal(h.calls.at(-1).method,'dispose');
  assert.equal(h.calls.at(-1).evaluation,h.calls[0].evaluation);
  assert.equal(h.calls.some(c=>c.name==='original'),false);
  assert.match(h.sent.at(-1).error,new RegExp('mock '+method+' failure'));
  assert.equal(h.sent.some(m=>m.outcome),false);
 });
}

test('finalization admission reaches selected wrapper with the same token',async()=>{
 const token={},admissions=[],h=harness({admission:{needsAdmission(req,purpose){admissions.push([req,purpose]);return purpose==='verify';},admit:async()=>token}});
 const req={finalization:{policy:'source-gameplay-finalization-v1'}};
 await h.run({req,purpose:'verify',prefixMismatchWindow:true});
 assert.equal(admissions.length,1);assert.equal(admissions[0][0],req);assert.equal(admissions[0][1],'verify');
 assert.equal(h.calls[0].name,'window');assert.equal(h.calls[0].options.finalizationAdmission,token);
 assert.equal(h.calls[0].options.prefixMismatchWindow,true);
});

test('cancel during finalization admission never begins or publishes old work',async()=>{
 const gate=deferred(),h=harness({admission:{needsAdmission:()=>true,admit:()=>gate.promise}});
 const pending=h.run({req:{finalization:{}},purpose:'verify',prefixMismatchWindow:true});await microtasks();
 await h.cancel();gate.resolve({});await pending;
 assert.deepEqual(h.calls,[]);assert.deepEqual(h.sent,[]);
});
