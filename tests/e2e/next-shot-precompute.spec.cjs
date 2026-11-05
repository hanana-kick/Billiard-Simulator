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
 await page.evaluate(()=>{globalThis.__nextFrames=[];let previous=performance.now();const tick=t=>{__nextFrames.push(t-previous);previous=t;if(cueLab.game.pending||cueLab.lab.shots===0)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 await page.locator('#strike').click();
 await page.waitForFunction(()=>cueLab.nextShot.job?.optimizer?.workers.length===1||['ready','suspended'].includes(cueLab.state.nextShotPreparation.phase),null,{timeout:15000});
 const inFlight=await page.evaluate(()=>({pending:!!cueLab.game.pending,shots:cueLab.lab.shots,settings:cueLab.state.settings,options:cueLab.state.routeOptions,routeResult:cueLab.state.routeResult,workers:cueLab.nextShot.job.optimizer.workers.length,background:cueLab.nextShot.job.optimizer.background,reusedForecast:cueLab.nextShot.job.reusedForecast,reusedWarmWorker:cueLab.nextShot.job.reusedWarmWorker}));
 expect(inFlight).toMatchObject({pending:true,shots:1,settings:before.settings,options:before.options,routeResult:null,background:true,reusedForecast:true,reusedWarmWorker:true});expect(inFlight.workers).toBeLessThanOrEqual(1);
 await page.waitForFunction(()=>['ready','suspended'].includes(cueLab.state.nextShotPreparation.phase),null,{timeout:30000});
 expect(await page.evaluate(()=>cueLab.game.pending!==null&&cueLab.state.routeResult===null)).toBe(true);
 const saved=await page.evaluate(()=>({selectedId:cueLab.nextShot.job.predicted.selectedId,game:cueLab.nextShot.job.predicted.game,result:cueLab.nextShot.job.result}));
 await page.evaluate(()=>cueLab.option('rate',4));
 await page.waitForFunction(()=>!cueLab.game.pending&&cueLab.nextShot.job?.promoted===true,null,{timeout:30000});
 const settled=await page.evaluate(()=>({selectedId:cueLab.state.selectedId,game:cueLab.game.snapshot(),result:cueLab.state.routeResult,settings:cueLab.state.settings,options:cueLab.state.routeOptions,exact:NextShotState.snapshotEqual(cueLab.lab.snapshot({trails:false}),cueLab.nextShot.job.predicted.snapshot),frames:__nextFrames,preparation:cueLab.state.nextShotPreparation,continuedAtRest:cueLab.nextShot.job.continuedAtRest,routeStatus:cueLab.state.routeStatus,foreground:!cueLab.optimizer.background}));
 expect(settled).toMatchObject({selectedId:saved.selectedId,game:saved.game,settings:before.settings,exact:true,foreground:true});if(saved.result?.results.length)expect(settled.result).toEqual(saved.result);else if(saved.result?.continuable){expect(settled.continuedAtRest).toBe(true);expect(['searching','done']).toContain(settled.routeStatus);}
 expect(settled.options.searchAlgorithm).toBe(before.options.searchAlgorithm);expect(settled.options.mode).toBe(before.options.mode);expect(errors).toEqual([]);
 if(settled.continuedAtRest){await sidebar(page);if(await page.locator('#cancelRoute').count())await page.locator('#cancelRoute').click();await page.locator('#findRoute').click();await page.waitForFunction(()=>cueLab.state.routeStatus==='searching'&&cueLab.nextShot.job===null);await page.locator('#cancelRoute').click();const version=await page.evaluate(()=>cueLab.optimizer.version);await page.waitForTimeout(200);expect(await page.evaluate(()=>cueLab.optimizer.version)).toBe(version);expect(await page.evaluate(()=>cueLab.state.routeStatus)).toBe('done');}
 const evidence=testInfo.outputPath('next-shot-playback.json');fs.writeFileSync(evidence,JSON.stringify({before,inFlight,settled},null,2));await testInfo.attach('next-shot-playback',{path:evidence,contentType:'application/json'});
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
