/* Speculation never owns gameplay. Only exact full-rest reconciliation may publish. */
(function(G){
'use strict';
const copy=value=>structuredClone(value);
const stable=value=>value&&typeof value==='object'?Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
function snapshotEqual(a,b){
 if(!a||!b||a.world?.length!==b.world?.length)return false;
 for(let i=0;i<a.world.length;i++)if(a.world[i]!==b.world[i])return false;
 // Trails and distance/maxHeight are presentation history, not simulation inputs.
 const semantic=s=>({time:s.time,steps:s.steps,dt:s.dt,shots:s.shots,nextId:s.nextId,revision:s.revision,params:s.params,lastStroke:s.lastStroke,strokeSubsteps:s.strokeSubsteps,events:s.events,statics:s.statics.map(body),objects:s.objects.map(body)});
 const body=o=>{const {trail,distance,maxHeight,lastPos,...state}=o;return state;};
 return JSON.stringify(stable(semantic(a)))===JSON.stringify(stable(semantic(b)));
}
function repairedOptions(options,game,selectedId,snapshot){
 const ids=game.kind==='three'?game.objectIds.filter(id=>id!==selectedId):game.redIds;
 const present=ids.filter(id=>snapshot.objects.some(o=>o.id===id));
 const targetId=present.includes(options.targetId)?options.targetId:(present[0]??0);
 const secondId=present.includes(options.secondId)&&options.secondId!==targetId?options.secondId:(present.find(id=>id!==targetId)??0);
 return{...options,targetId,secondId};
}
class NextShotService{
 constructor(controller){this.controller=controller;this.generation=0;this.job=null;this.warmed=null;}
 warm(){
  const c=this.controller;if(this.warmed||c.disposed||c.canonicalPlayback||G.document?.hidden||!c.state.nextShotPrecompute||!c.state.paused||c.game?.pending||typeof G.Worker!=='function'||Number(G.navigator?.hardwareConcurrency||2)<2)return;
  // Parse the bundled planner and initialize WASM while the player is aiming,
  // never spend that startup work on the strike/playback path when avoidable.
  const worker=new G.NextShotOptimizer(()=>{},()=>{},()=>{if(this.warmed===worker)this.warmed=null;worker.dispose();});
  if(worker.worker)this.warmed=worker;else worker.dispose();
 }
 inputStamp(selectedId=this.controller.state.selectedId,options=this.controller.state.routeOptions){const s=this.controller.state;return JSON.stringify([s.gameMode,selectedId,s.settings,options]);}
 status(phase,extra={}){this.controller.state.nextShotPreparation={phase,...extra};}
 current(job){return this.job===job&&job.generation===this.generation&&!this.controller.disposed;}
 cancel(reason='canceled'){
  this.generation++;const job=this.job;this.job=null;if(reason==='disabled'||reason==='disposed'){this.warmed?.dispose();this.warmed=null;}
  clearTimeout(job?.timer);job?.predictor?.dispose();if(job&&!job.promoted)job.optimizer?.dispose();
  this.status('idle',{reason});
 }
 start(before,forecastReceipt=null){
  this.cancel('new-shot');const c=this.controller;
  if(!c.state.nextShotPrecompute||c.canonicalPlayback||!before?.game||typeof G.Worker!=='function'||Number(G.navigator?.hardwareConcurrency||2)<2){this.status('unavailable');return;}
  const job={generation:this.generation,inputStamp:this.inputStamp(),options:copy(c.state.routeOptions),settings:copy(c.state.settings),gameMode:c.state.gameMode,startedAt:performance.now(),rest:null,predicted:null,promoted:false,progress:null,result:null};this.job=job;
  this.status('predicting');
  const onPrediction=result=>{
   if(!this.current(job))return;job.predictor?.dispose();job.predictor=null;
   if(!result.rested||!result.nextShot){this.cancel('full-rest-unavailable');this.status('unavailable');c.notify(false);return;}
   job.predicted=result.nextShot;
   const options=repairedOptions(job.options,job.predicted.game,job.predicted.selectedId,job.predicted.snapshot);
   job.expectedStamp=JSON.stringify([job.gameMode,job.predicted.selectedId,job.settings,options]);
   if(this.inputStamp()!==(job.rest?job.expectedStamp:job.inputStamp)){this.cancel('input-changed');c.notify(false);return;}
   const gameRules=job.gameMode==='four'?{gameMode:'four',opponentId:job.predicted.game.cueIds.find(id=>id!==job.predicted.selectedId)}:{gameMode:'free',opponentId:null};
   const req={snapshot:job.predicted.snapshot,selectedId:job.predicted.selectedId,settings:job.settings,options:{...options,...gameRules}};
   try{G.LabInversePlanner.validate(req);}catch{this.cancel('unsupported-search');this.status('unavailable');c.notify(false);return;}
   const onProgress=progress=>{
    if(!this.current(job))return;job.progress=progress;
    if(job.promoted){c.state.routeProgress=progress;if(progress.partialResult)c.state.routeResult=progress.partialResult;c.notify(false);}
   },onResult=result=>{
    if(!this.current(job))return;job.result=result;
    this.status(job.promoted?'used':'ready',{elapsedMs:performance.now()-job.startedAt});
    if(job.promoted){c.state.routeStatus='done';c.state.routeResult=result;c.state.routeProgress=result;c.queuePrediction();}c.notify(false);
   },onError=error=>{
    if(!this.current(job))return;
    if(job.promoted){c.state.routeStatus='error';c.state.routeError=error;}
    this.cancel(error);this.status('unavailable');c.notify(false);
   };
   job.reusedWarmWorker=!!this.warmed;job.optimizer=this.warmed||new G.NextShotOptimizer(onProgress,onResult,onError,{background:true});this.warmed=null;
   Object.assign(job.optimizer,{onProgress,onResult,onError});
   job.searchStartedAt=performance.now();this.status('searching');job.optimizer.request(req);
   if(this.current(job)&&job.rest)this.reconcile(job);c.notify(false);
  };
  const previous=forecastReceipt?.request;
  if(forecastReceipt?.result?.rested&&forecastReceipt.result.nextShot&&previous?.selectedId===before.selectedId&&JSON.stringify(previous.settings)===JSON.stringify(job.settings)&&JSON.stringify(previous.nextShotGame?.snapshot)===JSON.stringify(before.game)&&previous.nextShotGame?.shotRules?.threeCushion===!!job.options.fourBallThreeCushion&&snapshotEqual(previous.snapshot,before.world)){
   job.reusedForecast=true;job.timer=setTimeout(()=>onPrediction(forecastReceipt.result),0);return;
  }
  job.predictor=new G.PredictionService(onPrediction,error=>{if(!this.current(job))return;this.cancel(error);this.status('unavailable');c.notify(false);},{workerOnly:true,background:true});
  job.predictor.request({snapshot:before.world,selectedId:before.selectedId,settings:job.settings,horizon:30,nextShotGame:{kind:before.game.kind==='three'?'three':'four',snapshot:before.game,shotRules:{threeCushion:!!job.options.fourBallThreeCushion}}});
 }
 observeFrame(deltaMs){
  const job=this.job,c=this.controller;
  if(!job||job.promoted||job.suspended||c.state.paused||!job.optimizer?.plan||performance.now()-job.startedAt<250)return;
  const now=performance.now();job.lateFrames=(job.lateFrames||[]).filter(t=>now-t<1200);
  if(deltaMs>40)job.lateFrames.push(now);
  if(deltaMs>120||job.lateFrames.length>=3){if(job.optimizer.suspend()){job.suspended=true;this.status('suspended',{reason:'playback-pressure'});c.notify(false);}}
 }
 settle(){
  const job=this.job,c=this.controller;if(!job||job.promoted)return false;
  if(c.lab.cue||c.game?.pending||!c.lab.objects.every(o=>o.body.isSleeping()))return false;
  job.rest={snapshot:c.lab.snapshot({trails:false}),game:c.game.snapshot(),selectedId:c.state.selectedId,at:performance.now()};
  return job.predicted?this.reconcile(job):false;
 }
 reconcile(job){
  const c=this.controller;if(!this.current(job)||job.promoted||!job.rest||!job.predicted||!job.optimizer)return false;
  const match=!c.lab.cue&&!c.game?.pending&&c.lab.objects.every(o=>o.body.isSleeping())&&this.inputStamp()===job.expectedStamp&&c.state.selectedId===job.predicted.selectedId&&JSON.stringify(c.game.snapshot())===JSON.stringify(job.predicted.game)&&snapshotEqual(c.lab.snapshot({trails:false}),job.predicted.snapshot);
  if(!match){this.cancel('rest-mismatch');this.status('discarded',{reason:'rest-mismatch'});c.notify(false);return false;}
  job.promoted=true;c.optimizer?.dispose();c.optimizer=job.optimizer;
  // Once adopted, this becomes the ordinary foreground service, including later
  // new requests and resume. Its callbacks must not retain speculative epochs.
  c.optimizer.onProgress=progress=>{c.state.routeProgress=progress;if(progress.partialResult)c.state.routeResult=progress.partialResult;c.notify(false);};
  c.optimizer.onResult=result=>{if(this.current(job))this.status('used',{matched:true,headStartMs:Math.max(0,job.rest.at-job.searchStartedAt),waitAfterRestMs:Math.max(0,performance.now()-job.rest.at)});c.state.routeStatus='done';c.state.routeResult=result;c.state.routeProgress=result;c.notify();c.queuePrediction();};
  c.optimizer.onError=error=>{c.state.routeStatus='error';c.state.routeError=error;c.notify();c.queuePrediction();};
  c.routeStamp=c.worldStamp();c.routeRequestStamp=JSON.stringify([c.state.routeOptions,c.state.settings]);c.routeFinalizationStamp=null;c.routeFinalizationOptionsStamp=null;
  const continueUnresolved=!!job.result&&job.result.results?.length===0&&job.result.continuable===true;job.continuedAtRest=continueUnresolved;
  c.state.routeStatus=job.result&&!continueUnresolved?'done':'searching';c.state.routeError='';c.state.routeApplied=null;c.state.routeResult=job.result||job.progress?.partialResult||null;c.state.routeProgress=job.result||job.progress||{tested:0,evaluated:0,found:0};
  c.invalidate();this.status(job.result&&!continueUnresolved?'used':'searching',{matched:true,continuedAtRest:continueUnresolved,headStartMs:Math.max(0,job.rest.at-job.searchStartedAt)});const resumed=c.optimizer.promoteToForeground({continueUnresolved});if(continueUnresolved&&resumed===false&&c.state.routeStatus==='searching'){c.state.routeStatus='done';this.status('used',{matched:true});}c.notify();return true;
 }
 dispose(){this.cancel('disposed');}
}
G.NextShotService=NextShotService;G.NextShotState={snapshotEqual,repairedOptions};
})(globalThis);
