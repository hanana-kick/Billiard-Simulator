'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../src/next-shot-service.js'),'utf8');
function harness(){
 const predictions=[],optimizers=[],snapshot={world:Uint8Array.of(1,2,3),time:1,steps:960,dt:1/960,shots:1,nextId:4,revision:0,params:{a:1},events:[],statics:[],objects:[{id:1,pos:{x:1},v:{x:0},w:{x:0}},{id:2},{id:3}]};
 const initialGame={kind:'three',objectIds:[1,2,3],cueIds:[1,2],activeCue:1,scores:{1:0,2:0},pending:null},finalGame={...structuredClone(initialGame),activeCue:2};
 class Predictor{constructor(onResult,onError,options){Object.assign(this,{onResult,onError,options});predictions.push(this);}request(req){this.req=req;}dispose(){this.disposed=true;}}
 class Optimizer{constructor(onProgress,onResult,onError,options){Object.assign(this,{onProgress,onResult,onError,options});this.worker={};optimizers.push(this);}request(req){this.req=req;}suspend(){this.suspended=true;return true;}promoteToForeground(options){this.background=false;this.promotedOptions=options;return true;}dispose(){this.disposed=true;}}
 const c={state:{nextShotPrecompute:true,gameMode:'free',selectedId:1,settings:{angle:0},routeOptions:{targetId:2,secondId:3,searchAlgorithm:'cpu-event-window-inverse',mode:'three'},routeStatus:'stale',routeResult:{results:[{id:99}]}},game:{snapshot:()=>finalGame,pending:null},lab:{cue:null,objects:[{body:{isSleeping:()=>true}}],snapshot:()=>structuredClone(snapshot)},optimizer:{dispose(){this.disposed=true;}},notify(){},invalidate(){},queuePrediction(){},worldStamp:()=>JSON.stringify([c.state.selectedId,snapshot.world])};
 const env={structuredClone,performance,setTimeout,clearTimeout,Worker:class{},navigator:{hardwareConcurrency:8},PredictionService:Predictor,OptimizerService:Optimizer,NextShotOptimizer:Optimizer,LabInversePlanner:{validate(){}},Uint8Array};vm.createContext(env);vm.runInContext(source,env);const service=new env.NextShotService(c);const before={world:{...snapshot,shots:0},selectedId:1,game:initialGame};
 const predict=()=>predictions.at(-1).onResult({rested:true,nextShot:{snapshot:structuredClone(snapshot),game:structuredClone(finalGame),selectedId:2}});
 const rest=()=>{c.state.selectedId=2;c.state.routeOptions={...c.state.routeOptions,targetId:1};return service.settle();};
 return{c,service,predictions,optimizers,before,predict,rest,snapshot,finalGame,env};
}
test('background search cannot publish before verified live rest; cached result promotes immediately',()=>{
 const h=harness(),old=h.c.state.routeResult;h.service.start(h.before);assert.deepEqual(JSON.parse(JSON.stringify(h.predictions[0].options)),{workerOnly:true,background:true});h.predict();const opt=h.optimizers[0];assert.equal(opt.options.background,true);assert.equal(opt.req.selectedId,2);assert.equal(opt.req.options.targetId,1);opt.onProgress({tested:2,partialResult:{results:[{id:1}]}});opt.onResult({results:[{id:1}],continuable:true});assert.equal(h.c.state.routeResult,old);assert.equal(h.c.state.selectedId,1);assert.equal(h.c.state.nextShotPreparation.phase,'ready');assert.equal(h.rest(),true);assert.equal(h.c.state.routeStatus,'done');assert.equal(h.c.state.routeResult.results[0].id,1);assert.equal(h.c.optimizer,opt);assert.equal(opt.background,false);
});
test('in-flight search adopts ordinary callbacks so later explicit searches remain live',()=>{
 const h=harness();h.service.start(h.before);h.predict();assert.equal(h.rest(),true);assert.equal(h.c.state.routeStatus,'searching');const opt=h.c.optimizer;h.service.cancel('new explicit request');opt.onResult({results:[{id:2}]});assert.equal(h.c.state.routeStatus,'done');assert.equal(h.c.state.routeResult.results[0].id,2);
});
test('rest first then delayed full-state prediction still reconciles safely',()=>{const h=harness();h.service.start(h.before);assert.equal(h.rest(),false);assert.notEqual(h.c.state.routeStatus,'searching');h.predict();assert.equal(h.c.state.routeStatus,'searching');assert.equal(h.c.state.nextShotPreparation.matched,true);});
for(const change of ['world','angular','game','settings','mode','options'])test(`exact ${change} mismatch discards without publishing`,()=>{
 const h=harness();h.service.start(h.before);h.predict();h.optimizers[0].onResult({results:[{id:1}]});const old=h.c.state.routeResult;
 if(change==='world')h.snapshot.world[0]++;
 if(change==='angular')h.snapshot.objects[0].w.x=1e-18;
 if(change==='game')h.finalGame.scores[1]++;
 if(change==='settings')h.c.state.settings.angle=1;
 if(change==='mode')h.c.state.gameMode='four';
 if(change==='options')h.c.state.routeOptions.maxCushions=12;
 assert.equal(h.rest(),false);assert.equal(h.c.state.nextShotPreparation.phase,'discarded');assert.equal(h.c.state.routeResult,old);assert.equal(h.optimizers[0].disposed,true);
});
for(const phase of ['predicting','searching','ready'])test(`generation cancellation in ${phase} rejects late callbacks`,()=>{
 const h=harness();h.service.start(h.before);const prediction=h.predictions[0];if(phase!=='predicting')h.predict();if(phase==='ready')h.optimizers[0].onResult({results:[{id:1}]});const old=h.c.state.routeResult;h.service.cancel('reset/undo/settings/interruption');prediction.onResult({rested:true,nextShot:{snapshot:h.snapshot,game:h.finalGame,selectedId:2}});h.optimizers[0]?.onResult({results:[{id:2}]});assert.equal(h.c.state.routeResult,old);assert.equal(h.service.job,null);assert.equal(h.c.state.nextShotPreparation.phase,'idle');assert.equal(h.rest(),false);
});
test('new shot supersedes old prediction even when requests share candidate IDs',()=>{const h=harness();h.service.start(h.before);const old=h.predictions[0];h.service.start(h.before);old.onResult({rested:true,nextShot:{snapshot:h.snapshot,game:h.finalGame,selectedId:2}});assert.equal(h.optimizers.length,0);h.predict();assert.equal(h.optimizers.length,1);});
test('disabled setting declines speculation rather than competing with playback',()=>{const h=harness();h.service.controller.state.nextShotPrecompute=false;h.service.start(h.before);assert.equal(h.predictions.length,0);assert.equal(h.c.state.nextShotPreparation.phase,'unavailable');});

test('completed exact idle forecast is reused without recomputing the first shot',async()=>{
 const h=harness(),receipt={request:{snapshot:structuredClone(h.before.world),selectedId:1,settings:structuredClone(h.c.state.settings),nextShotGame:{snapshot:structuredClone(h.before.game),shotRules:{threeCushion:false}}},result:{rested:true,nextShot:{snapshot:structuredClone(h.snapshot),game:structuredClone(h.finalGame),selectedId:2}}};
 h.service.start(h.before,receipt);assert.equal(h.predictions.length,0);assert.equal(h.service.job.reusedForecast,true);await new Promise(r=>setTimeout(r,10));assert.equal(h.optimizers.length,1);h.service.cancel();
});
test('changed scoring rules or exact source prevent idle forecast reuse',()=>{const h=harness(),receipt={request:{snapshot:structuredClone(h.before.world),selectedId:1,settings:structuredClone(h.c.state.settings),nextShotGame:{snapshot:structuredClone(h.before.game),shotRules:{threeCushion:true}}},result:{rested:true,nextShot:{}}};h.service.start(h.before,receipt);assert.equal(h.predictions.length,1);h.service.cancel();});
test('cancellation before the reused forecast callback cannot create a worker',async()=>{const h=harness(),receipt={request:{snapshot:structuredClone(h.before.world),selectedId:1,settings:structuredClone(h.c.state.settings),nextShotGame:{snapshot:structuredClone(h.before.game),shotRules:{threeCushion:false}}},result:{rested:true,nextShot:{snapshot:h.snapshot,game:h.finalGame,selectedId:2}}};h.service.start(h.before,receipt);h.service.cancel('new shot');await new Promise(r=>setTimeout(r,10));assert.equal(h.optimizers.length,0);});

test('empty continuable cache gets one normal foreground budget after exact rest',()=>{const h=harness();h.service.start(h.before);h.predict();const opt=h.optimizers[0];opt.onResult({results:[],continuable:true});assert.equal(h.rest(),true);assert.equal(h.c.state.routeStatus,'searching');assert.equal(opt.promotedOptions.continueUnresolved,true);assert.equal(h.c.state.nextShotPreparation.continuedAtRest,true);opt.onResult({results:[],continuable:true});assert.equal(h.c.state.routeStatus,'done','one foreground budget, not an automatic endless loop');});

test('empty cached failure cannot continue after state mismatch or cancellation',()=>{for(const cancel of [false,true]){const h=harness();h.service.start(h.before);h.predict();const opt=h.optimizers[0];opt.onResult({results:[],continuable:true});if(cancel)h.service.cancel('new manual search');else h.snapshot.world[0]++;assert.equal(h.rest(),false);assert.equal(opt.promotedOptions,undefined);}});

test('empty exhausted result is published without automatic extra work',()=>{const h=harness();h.service.start(h.before);h.predict();const opt=h.optimizers[0];opt.onResult({results:[],continuable:false});assert.equal(h.rest(),true);assert.equal(h.c.state.routeStatus,'done');assert.equal(opt.promotedOptions.continueUnresolved,false);});

test('playback pressure retains and suspends speculative work until exact rest',()=>{const h=harness();h.service.start(h.before);h.predict();const job=h.service.job,opt=h.optimizers[0];opt.plan={};job.startedAt=performance.now()-1000;h.c.state.paused=false;h.service.observeFrame(95);assert.equal(job.suspended,undefined);h.service.observeFrame(95);assert.equal(job.suspended,undefined);h.service.observeFrame(95);assert.equal(job.suspended,true);assert.equal(opt.suspended,true);assert.equal(h.c.state.nextShotPreparation.phase,'suspended');assert.equal(h.service.job,job);assert.equal(h.rest(),true);assert.equal(h.c.state.routeStatus,'searching');assert.equal(opt.background,false);});
test('ordinary frames and initial strike startup do not suspend preparation',()=>{const h=harness();h.service.start(h.before);h.predict();const job=h.service.job,opt=h.optimizers[0];opt.plan={};h.c.state.paused=false;h.service.observeFrame(400);assert.equal(job.suspended,undefined);job.startedAt=performance.now()-1000;for(let i=0;i<100;i++)h.service.observeFrame(33.4);assert.equal(job.suspended,undefined);h.service.observeFrame(250);assert.equal(job.suspended,true);});

 test('idle warm worker contains no request and survives ordinary input invalidation',()=>{const h=harness();h.c.state.paused=true;h.c.game.pending=null;h.service.warm();const worker=h.service.warmed;assert.ok(worker);assert.equal(worker.req,undefined);h.service.cancel('settings');assert.equal(h.service.warmed,worker);h.service.start(h.before);h.predict();assert.equal(h.optimizers.length,1);assert.equal(h.service.warmed,null);assert.equal(h.service.job.reusedWarmWorker,true);worker.onResult({results:[{id:2}],continuable:true});assert.equal(h.service.job.result.results[0].id,2);h.service.cancel();assert.equal(worker.disposed,true);});
 test('disabled, hidden, moving and canonical play do not prewarm; disable/dispose release idle worker',()=>{for(const key of ['disabled','moving','canonical','hidden']){const h=harness();h.c.state.paused=true;if(key==='disabled')h.c.state.nextShotPrecompute=false;if(key==='moving')h.c.game.pending={};if(key==='canonical')h.c.canonicalPlayback={};if(key==='hidden')h.env.document={hidden:true};h.service.warm();assert.equal(h.optimizers.length,0);}for(const reason of ['disabled','disposed']){const h=harness();h.c.state.paused=true;h.service.warm();const worker=h.service.warmed;h.service.cancel(reason);assert.equal(worker.disposed,true);assert.equal(h.service.warmed,null);}});

function pressureHarness(){const h=harness();let now=1000;h.env.performance={now:()=>now};h.service.start(h.before);h.predict();h.service.job.startedAt=0;h.c.state.paused=false;const opt=h.optimizers[0];opt.plan={};opt.recoveries=0;opt.retainedState={backgroundRecoverable:true};opt.resumeBackground=()=>{opt.recoveries++;opt.suspended=false;return true;};h.frame=(delta=25,elapsed=delta)=>{now+=elapsed;h.service.observeFrame(delta);};h.healthy=()=>{for(let i=0;i<31;i++)h.frame();};return h;}
test('750 ms of continuous healthy playback recovers without promotion or replacement, then resuspends immediately',()=>{const h=pressureHarness(),job=h.service.job,opt=h.optimizers[0];h.frame(121);for(let i=0;i<30;i++)h.frame();assert.equal(opt.recoveries,0);h.frame();assert.equal(opt.recoveries,1);assert.equal(job.suspended,false);assert.equal(h.service.job,job);assert.equal(job.optimizer,opt);assert.equal(opt.promotedOptions,undefined);assert.equal(job.pressureSuspensions,1);assert.equal(job.pressureRecoveries,1);h.frame(121);assert.equal(job.suspended,true);h.healthy();assert.equal(opt.recoveries,2);assert.equal(job.pressureSuspensions,2);assert.equal(job.pressureRecoveries,2);assert.ok(job.lastRecoveryAt>job.lastPressureAt);});
test('pressure, paused/hidden frames and missed observation reset healthy recovery interval',()=>{for(const interrupt of ['late','paused','hidden','gap']){const h=pressureHarness(),opt=h.optimizers[0];h.frame(121);for(let i=0;i<20;i++)h.frame();if(interrupt==='late')h.frame(41);if(interrupt==='gap')h.frame(25,1000);if(interrupt==='paused'){h.c.state.paused=true;h.frame();h.c.state.paused=false;}if(interrupt==='hidden'){h.env.document={hidden:true};h.frame();h.env.document.hidden=false;}for(let i=0;i<30;i++)h.frame();assert.equal(opt.recoveries,0,interrupt);h.frame();assert.equal(opt.recoveries,1,interrupt);}});
test('cancel, dispose, completed result and promotion prevent automatic recovery',()=>{for(const action of ['cancel','dispose','result','promote']){const h=pressureHarness(),opt=h.optimizers[0];h.frame(121);if(action==='cancel')h.service.cancel();if(action==='dispose')h.service.dispose();if(action==='result')opt.onResult({results:[],continuable:true});if(action==='promote')h.rest();h.healthy();assert.equal(opt.recoveries,0,action);}});

test('unsupported retained planners are not automatically resumed',()=>{const h=pressureHarness();h.frame(121);h.optimizers[0].retainedState={backgroundRecoverable:false};h.healthy();assert.equal(h.optimizers[0].recoveries,0);assert.equal(h.service.job.suspended,true);});

function aimingHarness(){
 const h=harness(),timers=new Map();let id=0;
 h.env.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id;};h.env.clearTimeout=i=>timers.delete(i);
 Object.assign(h.c.state,{paused:true,predict:true});h.c.game.snapshot=()=>structuredClone(h.before.game);h.c.lab.snapshot=()=>structuredClone(h.before.world);
 h.receipt={request:{snapshot:structuredClone(h.before.world),selectedId:1,settings:structuredClone(h.c.state.settings),nextShotGame:{snapshot:structuredClone(h.before.game),shotRules:{threeCushion:false}}},result:{rested:true,nextShot:{snapshot:structuredClone(h.snapshot),game:structuredClone(h.finalGame),selectedId:2}}};h.c.forecastReceipt=h.receipt;
 h.runTimer=ms=>{const entry=[...timers].find(([,t])=>t.ms===ms);assert.ok(entry,`timer ${ms}`);timers.delete(entry[0]);entry[1].fn();};
 h.begin=()=>{h.service.prepareAim(h.receipt);assert.equal(h.optimizers.length,0);h.runTimer(750);h.runTimer(0);};return h;
}
test('stable aiming starts only after 750ms, transfers same worker and waits for real rest',()=>{
 const h=aimingHarness(),old=h.c.state.routeResult;h.begin();const job=h.service.job,opt=h.optimizers[0];opt.onResult({results:[{id:77}],continuable:true});assert.equal(h.c.state.routeResult,old);
 const prepared=h.service.takePrepared(h.before,h.receipt);assert.equal(prepared,job);h.service.cancel('fire normal cancel');h.c.state.paused=false;h.service.start(h.before,h.receipt,prepared);assert.equal(h.service.job,job);assert.equal(h.optimizers.length,1);assert.equal(h.c.state.routeResult,old);
 h.c.lab.snapshot=()=>structuredClone(h.snapshot);h.c.game.snapshot=()=>h.finalGame;assert.equal(h.rest(),true);assert.equal(h.c.state.routeResult.results[0].id,77);
});
test('changing aim cancels before debounce and late results do not publish',()=>{const h=aimingHarness();h.service.prepareAim(h.receipt);h.service.cancel('settings');assert.equal(h.service.aimTimer,null);assert.equal(h.optimizers.length,0);h.begin();const opt=h.optimizers[0],old=h.c.state.routeResult;h.service.cancel('settings');opt.onResult({results:[{id:2}]});assert.equal(h.c.state.routeResult,old);assert.equal(opt.disposed,true);});
for(const type of ['settings','world','game','options','receipt'])test(`prestrike ${type} mismatch cannot adopt`,()=>{const h=aimingHarness();h.begin();if(type==='settings')h.c.state.settings.angle++;if(type==='world')h.before.world.world[0]++;if(type==='game')h.before.game.scores[1]++;if(type==='options')h.c.state.routeOptions.maxCushions=6;const receipt=type==='receipt'?structuredClone(h.receipt):h.receipt;assert.equal(h.service.takePrepared(h.before,receipt),null);h.service.cancel();});
test('incomplete rest forecast never starts idle search',()=>{const h=aimingHarness();h.receipt.result.rested=false;h.service.prepareAim(h.receipt);assert.equal(h.service.job,null);assert.equal(h.service.aimTimer,undefined);});
test('idle pressure retains one frontier through repeated slow frames and budget expiry',()=>{
 const h=aimingHarness();h.begin();const job=h.service.job,opt=job.optimizer,old=h.c.state.routeResult;opt.plan={};let suspends=0;opt.suspend=()=>{suspends++;return true;};
 for(let i=0;i<100;i++)h.service.observeFrame(45);
 assert.equal(h.service.job,job);assert.equal(opt.disposed,undefined);assert.equal(suspends,1);assert.equal(job.suspended,true);assert.equal(h.c.state.nextShotPreparation.aiming,true);assert.equal(h.c.state.routeResult,old);
 h.runTimer(5000);assert.equal(h.service.job,job);assert.equal(suspends,1);assert.equal(job.aimBudgetSuspended,true);
 let resumes=0;opt.resumeBackground=()=>{resumes++;return true;};const prepared=h.service.takePrepared(h.before,h.receipt);h.service.start(h.before,h.receipt,prepared);assert.equal(h.service.job,job);assert.equal(resumes,1);assert.equal(job.suspended,false);assert.equal(job.aiming,false);assert.equal(h.c.state.nextShotPreparation.phase,'searching');h.service.cancel();
});
test('suspended idle work is invalidated by changed input and stale completion cannot publish',()=>{
 const h=aimingHarness();h.begin();const job=h.service.job,opt=job.optimizer,old=h.c.state.routeResult;opt.plan={};h.service.observeFrame(150);h.c.state.settings.angle++;assert.equal(h.service.takePrepared(h.before,h.receipt),null);h.service.cancel('settings');opt.onResult({results:[{id:99}]});assert.equal(h.c.state.routeResult,old);assert.equal(opt.disposed,true);assert.equal(h.service.job,null);
});
test('unsupported idle suspension still releases work safely',()=>{const h=aimingHarness();h.begin();h.service.job.optimizer.plan={};h.optimizers[0].suspend=()=>false;h.service.observeFrame(45);assert.equal(h.service.job,null);assert.equal(h.optimizers[0].disposed,true);});
test('five-second idle budget suspends a retained frontier, without a new search deadline',()=>{const h=aimingHarness();h.begin();h.runTimer(5000);assert.equal(h.service.job.suspended,true);assert.equal(h.service.job.aimBudgetSuspended,true);assert.equal(h.optimizers.length,1);h.service.cancel();});

for(const kind of ['disabled','settings','world','receipt'])test(`toggle-on pending aim rejects ${kind} before worker creation`,()=>{
 const h=aimingHarness();h.service.prepareAim(h.receipt);
 if(kind==='disabled')h.service.cancel('disabled');
 else if(kind==='settings')h.c.state.settings.angle++;
 else if(kind==='world')h.before.world.world[0]++;
 else h.c.forecastReceipt=structuredClone(h.receipt);
 if(kind!=='disabled')h.runTimer(750);
 assert.equal(h.optimizers.length,0);assert.equal(h.service.job,null);h.service.cancel();
});
