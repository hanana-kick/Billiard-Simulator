'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
async function sidebar(page,open=true){if((await page.locator('#sidebarTrigger').getAttribute('aria-expanded')==='true')!==open){if(open)await page.locator('#sidebarTrigger').click();else await page.locator('.toolbox-heading').getByRole('button',{name:'설정 패널 닫기',exact:true}).click();}}
async function boot(page,four=false){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.LOCAL_HTML)await page.setContent(fs.readFileSync(process.env.LOCAL_HTML,'utf8'));else await page.goto('./');
 await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
 await sidebar(page);if(four)await page.locator('#gameMode').getByRole('button',{name:'4구',exact:true}).click();
 await page.locator('#tab-routes').click();await expect(page.locator('#nextShotPrecompute')).toBeChecked();
 await page.locator('#routeDetails').click();await page.locator('#routeAlgorithm').click();await page.getByRole('option',{name:'관측 구간 단축 탐색 (실험)',exact:true}).click();await page.locator('#closeRouteDetails').click();
 await page.evaluate(()=>cueLab.option('rate',.25));
 await page.waitForFunction(()=>!cueLab.state.predictionBusy&&cueLab.forecastReceipt?.result.rested,null,{timeout:30000});
 await sidebar(page,false);return errors;
}
for(const four of [false,true])test(`next-shot ${four?'four':'three'}-ball search runs during the first shot and adopts only exact live rest`,async({page},testInfo)=>{
 const errors=await boot(page,four),before=await page.evaluate(()=>({settings:{...cueLab.state.settings},options:{...cueLab.state.routeOptions},game:cueLab.game.snapshot()}));
 await page.evaluate(()=>{
  const c=cueLab,a=globalThis.__restAudit={premature:[],phases:[],startedAt:performance.now()};
  const capture=()=>({selectedId:c.state.selectedId,game:structuredClone(c.game.snapshot()),settings:{...c.state.settings},options:{...c.state.routeOptions},result:structuredClone(c.state.routeResult),routeStatus:c.state.routeStatus,routeError:c.state.routeError,preparation:{...c.state.nextShotPreparation},exact:!!a.job&&NextShotState.snapshotEqual(c.lab.snapshot({trails:false}),a.job.predicted.snapshot),sameJob:c.nextShot.job===a.job,sameOptimizer:c.optimizer===a.optimizer,foreground:!c.optimizer.background,pending:!!c.game.pending,allSleeping:!c.lab.cue&&c.lab.objects.every(o=>o.body.isSleeping())});
  a.unsubscribe=c.subscribe(()=>{
   const phase=c.state.nextShotPreparation.phase;if(a.phases.at(-1)!==phase)a.phases.push(phase);
   if(c.game.pending&&c.state.routeResult!==null)a.premature.push({at:performance.now(),phase,status:c.state.routeStatus});
   if(a.job?.promoted&&['done','error'].includes(c.state.routeStatus)&&!a.terminal)a.terminal={...capture(),at:performance.now()};
  });
  const reconcile=c.nextShot.reconcile;
  c.nextShot.reconcile=function(job){
   const cached=structuredClone(job.result),returned=reconcile.call(this,job);
   if(returned&&!a.adopted){
    a.adopted={...capture(),cached,continuedAtRest:!!job.continuedAtRest,at:job.rest.at};
    // Promotion advances the Worker request epoch. Late messages from the old
    // background epoch must not mutate the adopted job or publish any sentinel.
    const state=()=>JSON.stringify({version:a.optimizer.version,progress:c.state.routeProgress,result:c.state.routeResult,error:c.state.routeError,status:c.state.routeStatus,preparation:c.state.nextShotPreparation});
    const previous=state(),marker={results:[{id:'STALE-BACKGROUND-MUST-NOT-PUBLISH'}]};
    for(const type of ['progress','result','error'])a.workerMessage({data:{type,requestId:a.backgroundRequestId,value:type==='error'?'STALE-BACKGROUND-ERROR':marker}});
    a.staleRejected=previous===state();a.epochAdvanced=a.optimizer.version>a.backgroundRequestId;
   }
   return returned;
  };
 });
 await page.locator('#strike').click();
 await page.waitForFunction(()=>cueLab.game.pending&&cueLab.nextShot.job?.optimizer&&cueLab.nextShot.job?.predicted,null,{timeout:15000});
 const inFlight=await page.evaluate(()=>{
  const c=cueLab,a=__restAudit;a.job=c.nextShot.job;a.optimizer=a.job.optimizer;a.backgroundRequestId=a.optimizer.version;a.workerMessage=a.optimizer.worker.onmessage;
  a.predicted={selectedId:a.job.predicted.selectedId,game:structuredClone(a.job.predicted.game)};
  return{pending:!!c.game.pending,shots:c.lab.shots,settings:c.state.settings,options:c.state.routeOptions,routeResult:c.state.routeResult,workers:a.optimizer.workers.length,background:a.optimizer.background,reusedForecast:a.job.reusedForecast,reusedWarmWorker:a.job.reusedWarmWorker};
 });
 expect(inFlight).toMatchObject({pending:true,shots:1,settings:before.settings,options:before.options,routeResult:null,background:true,reusedForecast:true,reusedWarmWorker:true});expect(inFlight.workers).toBeLessThanOrEqual(1);
 // Ready/suspended are optional intermediate states. At low background duty,
 // healthy work can stay searching until natural rest, then continue foreground.
 // Keep the original quarter-speed playback; never force pressure or a result.
 await page.waitForFunction(()=>!!__restAudit.adopted,null,{timeout:45000});
 const adopted=await page.evaluate(()=>({state:__restAudit.adopted,predicted:__restAudit.predicted,staleRejected:__restAudit.staleRejected,epochAdvanced:__restAudit.epochAdvanced,premature:__restAudit.premature}));
 expect(adopted.state).toMatchObject({selectedId:adopted.predicted.selectedId,game:adopted.predicted.game,settings:before.settings,exact:true,sameJob:true,sameOptimizer:true,foreground:true,pending:false,allSleeping:true,routeError:''});expect(adopted.staleRejected).toBe(true);expect(adopted.epochAdvanced).toBe(true);expect(adopted.premature).toEqual([]);
 expect(adopted.state.options.searchAlgorithm).toBe(before.options.searchAlgorithm);expect(adopted.state.options.mode).toBe(before.options.mode);
 if(adopted.state.cached?.results.length)expect(adopted.state.result).toEqual(adopted.state.cached);
 else if(adopted.state.cached?.continuable){expect(adopted.state.continuedAtRest).toBe(true);expect(['searching','done']).toContain(adopted.state.routeStatus);}
 await page.waitForFunction(()=>!!__restAudit.terminal,null,{timeout:60000});
 const terminal=await page.evaluate(()=>__restAudit.terminal);
 expect(terminal).toMatchObject({routeStatus:'done',routeError:'',exact:true,sameJob:true,sameOptimizer:true,foreground:true,pending:false,allSleeping:true,settings:before.settings,game:adopted.predicted.game});expect(Array.isArray(terminal.result?.results)).toBe(true);
 // A finite unresolved search is an honest terminal result, not success or proof
 // of infeasibility. Preserve its actual outcome in the attached evidence.
 if(terminal.result.results.length===0)expect(terminal.result.continuable===true||terminal.result.domainExhausted===true).toBe(true);
 const evidence=await page.evaluate(()=>({adopted:__restAudit.adopted,terminal:__restAudit.terminal,phases:__restAudit.phases,premature:__restAudit.premature,staleRejected:__restAudit.staleRejected,epochAdvanced:__restAudit.epochAdvanced,restToTerminalMs:__restAudit.terminal.at-__restAudit.adopted.at}));expect(evidence.premature).toEqual([]);expect(errors).toEqual([]);
 await page.evaluate(()=>__restAudit.unsubscribe());
 // Retain cancellation/restart coverage after an actual terminal outcome.
 await sidebar(page);await page.locator('#findRoute').click();await page.waitForFunction(()=>cueLab.state.routeStatus==='searching'&&cueLab.nextShot.job===null);await page.locator('#cancelRoute').click();const version=await page.evaluate(()=>cueLab.optimizer.version);await page.waitForTimeout(200);expect(await page.evaluate(()=>cueLab.optimizer.version)).toBe(version);expect(await page.evaluate(()=>cueLab.state.routeStatus)).toBe('done');expect(errors).toEqual([]);
 const file=testInfo.outputPath('next-shot-playback.json');fs.writeFileSync(file,JSON.stringify({before,inFlight,...evidence},null,2));await testInfo.attach('next-shot-playback',{path:file,contentType:'application/json'});
});
test('next-shot exact-state mismatch discards cached results without changing score or user mode',async({page})=>{
 const errors=await boot(page,true);await page.locator('#strike').click();await page.waitForFunction(()=>cueLab.nextShot.job?.predicted,null,{timeout:15000});
 await page.evaluate(()=>{cueLab.nextShot.job.predicted.snapshot.world[0]^=1;cueLab.option('rate',4);});
 await page.waitForFunction(()=>!cueLab.game.pending,null,{timeout:30000});expect(await page.evaluate(()=>cueLab.state.nextShotPreparation.phase)).toBe('discarded');expect(await page.evaluate(()=>cueLab.state.routeResult)).toBeNull();expect(await page.evaluate(()=>cueLab.state.gameMode)).toBe('four');expect(errors).toEqual([]);
});
for(const action of ['conditions','blur','disable'])test(`next-shot ${action} cancels old generations on narrow screens`,async({page})=>{
 await page.setViewportSize({width:390,height:844});const errors=await boot(page);await page.locator('#strike').click();await page.waitForFunction(()=>cueLab.nextShot.job?.optimizer,null,{timeout:15000});
 if(action==='conditions')await page.evaluate(()=>cueLab.routeOption('maxCushions',4));
 else if(action==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 else {await sidebar(page);await page.getByRole('checkbox',{name:'타격 중 다음 경로 미리 계산',exact:true}).click();}
 const guard=await page.evaluate(()=>({generation:cueLab.nextShot.generation,phase:cueLab.state.nextShotPreparation.phase,result:cueLab.state.routeResult,settings:cueLab.state.settings,mode:cueLab.state.gameMode}));expect(await page.evaluate(()=>cueLab.nextShot.job)).toBeNull();await page.waitForTimeout(500);
 expect(await page.evaluate(()=>({generation:cueLab.nextShot.generation,phase:cueLab.state.nextShotPreparation.phase,result:cueLab.state.routeResult,settings:cueLab.state.settings,mode:cueLab.state.gameMode}))).toEqual(guard);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
});

// Undo/reset deliberately return to an idle, forecastable world. A fresh forecast
// may advance the generation and begin a NEW aiming job. Test old-job isolation,
// not a timing-dependent assumption that the global generation stays constant.
for(const action of ['undo','reset'])test(`next-shot ${action} rejects stale callbacks and allows fresh idle preparation on narrow screens`,async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});const errors=await boot(page);
 await page.evaluate(()=>{globalThis.__cancelAudit={before:cueLab.captureHistory(),events:[]};});
 await page.locator('#strike').click();await page.waitForFunction(()=>cueLab.nextShot.job?.optimizer,null,{timeout:15000});
 await page.evaluate(()=>{
  const a=__cancelAudit,c=cueLab,s=c.nextShot;a.oldJob=s.job;a.oldOptimizer=s.job.optimizer;a.oldGeneration=s.generation;
  a.callbacks={progress:a.oldOptimizer.onProgress,result:a.oldOptimizer.onResult,error:a.oldOptimizer.onError,worker:a.oldOptimizer.worker.onmessage};a.oldRequestId=a.oldOptimizer.version;
  const prepare=s.prepareAim,start=s.start;
  s.prepareAim=function(receipt){const before=this.generation,returned=prepare.call(this,receipt);a.events.push({type:'prepareAim',before,after:this.generation,reason:c.state.nextShotPreparation.reason,receiptMatches:this.forecastMatches(c.captureHistory(),receipt)});return returned;};
  s.start=function(...args){const returned=start.apply(this,args);if(this.job&&this.job!==a.oldJob)a.freshJob=this.job;a.events.push({type:'start',generation:this.generation,newJob:!!a.freshJob});return returned;};
  a.probeStale=()=>{
   const snapshot=()=>JSON.stringify({generation:s.generation,preparation:c.state.nextShotPreparation,result:c.state.routeResult,progress:c.state.routeProgress,error:c.state.routeError,status:c.state.routeStatus,settings:c.state.settings,game:c.game.snapshot(),world:Array.from(c.lab.snapshot({trails:false}).world)});
   const before=snapshot(),job=s.job,marker={results:[{id:'STALE-MUST-NEVER-PUBLISH'}],continuable:false};
   // Deliver at both boundaries: the disposed Worker wrapper and the captured
   // service callbacks. These sentinels must never become accepted physics.
   for(const type of ['progress','result','error'])a.callbacks.worker({data:{type,requestId:a.oldRequestId,value:type==='error'?'STALE-ERROR':marker}});
   a.callbacks.progress({partialResult:marker});a.callbacks.result(marker);a.callbacks.error('STALE-ERROR');
   return {unchanged:before===snapshot(),sameJob:s.job===job,oldDisposed:a.oldOptimizer.disposed,oldWorkerGone:a.oldOptimizer.worker===null,oldNotCurrent:s.job!==a.oldJob};
  };
 });
 await sidebar(page);await page.locator('#'+action).click();
 const immediate=await page.evaluate(()=>{const a=__cancelAudit,c=cueLab;return{probe:a.probeStale(),generation:c.nextShot.generation,oldGeneration:a.oldGeneration,worldRestored:NextShotState.snapshotEqual(c.lab.snapshot({trails:false}),a.before.world),game:c.game.snapshot(),beforeGame:a.before.game,settings:c.state.settings,beforeSettings:a.before.settings,pending:c.game.pending,result:c.state.routeResult,undo:c.undoStack.length,redo:c.redoStack.length};});
 expect(immediate.probe).toEqual({unchanged:true,sameJob:true,oldDisposed:true,oldWorkerGone:true,oldNotCurrent:true});expect(immediate.generation).toBeGreaterThan(immediate.oldGeneration);expect(immediate.worldRestored).toBe(true);expect(immediate.game).toEqual(immediate.beforeGame);expect(immediate.settings).toEqual(immediate.beforeSettings);expect(immediate.pending).toBeNull();expect(immediate.result).toBeNull();expect(immediate.undo).toBe(0);expect(immediate.redo).toBe(action==='undo'?1:0);
 // The receipt and new job are observed, never synthesized. A pressure cancel
 // after creation is legitimate; keep the creation evidence rather than racing
 // an assertion against the job's transient lifetime.
 await page.waitForFunction(()=>__cancelAudit.freshJob?.aimSource&&__cancelAudit.freshJob?.optimizer,null,{timeout:30000});
 const fresh=await page.evaluate(()=>{const a=__cancelAudit,c=cueLab,j=a.freshJob;return{probe:a.probeStale(),events:a.events,newGeneration:j.generation,oldGeneration:a.oldGeneration,newOptimizer:j.optimizer!==a.oldOptimizer,sourceMatches:NextShotState.snapshotEqual(j.aimSource.world,c.lab.snapshot({trails:false})),sourceGameMatches:JSON.stringify(j.aimSource.game)===JSON.stringify(c.game.snapshot()),worldUnchanged:NextShotState.snapshotEqual(c.lab.snapshot({trails:false}),a.before.world),game:c.game.snapshot(),beforeGame:a.before.game,settings:c.state.settings,beforeSettings:a.before.settings,result:c.state.routeResult,pending:c.game.pending};});
 expect(fresh.probe).toEqual({unchanged:true,sameJob:true,oldDisposed:true,oldWorkerGone:true,oldNotCurrent:true});expect(fresh.newGeneration).toBeGreaterThan(fresh.oldGeneration);expect(fresh.newOptimizer).toBe(true);expect(fresh.sourceMatches).toBe(true);expect(fresh.sourceGameMatches).toBe(true);expect(fresh.worldUnchanged).toBe(true);expect(fresh.game).toEqual(fresh.beforeGame);expect(fresh.settings).toEqual(fresh.beforeSettings);expect(fresh.result).toBeNull();expect(fresh.pending).toBeNull();expect(fresh.events.some(e=>e.type==='prepareAim'&&e.after>e.before&&e.reason==='aim-forecast'&&e.receiptMatches)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
 const file=testInfo.outputPath('undo-reset-lifecycle.json');fs.writeFileSync(file,JSON.stringify({action,immediate,fresh},null,2));await testInfo.attach('undo-reset-lifecycle',{path:file,contentType:'application/json'});
});

test('real playback pressure suspends retained background work and resumes only at exact rest',async({page})=>{
 const errors=await boot(page);await page.locator('#strike').click();await page.waitForFunction(()=>cueLab.nextShot.job?.optimizer?.plan,null,{timeout:15000});await page.waitForTimeout(850);
 // Inject one real long browser frame, not a replacement physics/planner result.
 await page.evaluate(()=>{const until=performance.now()+300;while(performance.now()<until){};});
 await page.waitForFunction(()=>cueLab.state.nextShotPreparation.phase==='suspended');
 expect(await page.evaluate(()=>({pending:!!cueLab.game.pending,workers:cueLab.nextShot.job.optimizer.workers.length,result:cueLab.state.routeResult,suspended:cueLab.nextShot.job.suspended}))).toEqual({pending:true,workers:0,result:null,suspended:true});
 await page.evaluate(()=>cueLab.option('rate',4));await page.waitForFunction(()=>!cueLab.game.pending&&cueLab.nextShot.job?.promoted,null,{timeout:30000});
 await page.waitForFunction(()=>cueLab.state.routeProgress?.cooperativeRetention?.continuedInPlace===true);
 expect(await page.evaluate(()=>({background:cueLab.optimizer.background,exact:NextShotState.snapshotEqual(cueLab.lab.snapshot({trails:false}),cueLab.nextShot.job.predicted.snapshot),nestedWorkers:cueLab.state.routeProgress.cooperativeRetention.nestedWorkersCreated,retained:cueLab.state.routeProgress.cooperativeRetention.promotionSteps}))).toMatchObject({background:false,exact:true,nestedWorkers:0});
 await page.evaluate(()=>cueLab.stopSearch());const guard=await page.evaluate(()=>({version:cueLab.optimizer.version,status:cueLab.state.routeStatus}));await page.waitForTimeout(200);expect(await page.evaluate(()=>({version:cueLab.optimizer.version,status:cueLab.state.routeStatus}))).toEqual(guard);expect(errors).toEqual([]);
});

