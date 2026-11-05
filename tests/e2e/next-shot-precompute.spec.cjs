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
for(const action of ['undo','reset','conditions','blur','disable'])test(`next-shot ${action} cancels old generations on narrow screens`,async({page})=>{
 await page.setViewportSize({width:390,height:844});const errors=await boot(page);await page.locator('#strike').click();await page.waitForFunction(()=>cueLab.nextShot.job?.optimizer,null,{timeout:15000});
 if(action==='undo'||action==='reset'){await sidebar(page);await page.locator('#'+action).click();}
 else if(action==='conditions')await page.evaluate(()=>cueLab.routeOption('maxCushions',4));
 else if(action==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 else {await sidebar(page);await page.getByRole('checkbox',{name:'타격 중 다음 경로 미리 계산',exact:true}).click();}
 const guard=await page.evaluate(()=>({generation:cueLab.nextShot.generation,phase:cueLab.state.nextShotPreparation.phase,result:cueLab.state.routeResult,settings:cueLab.state.settings,mode:cueLab.state.gameMode}));expect(await page.evaluate(()=>cueLab.nextShot.job)).toBeNull();await page.waitForTimeout(500);
 expect(await page.evaluate(()=>({generation:cueLab.nextShot.generation,phase:cueLab.state.nextShotPreparation.phase,result:cueLab.state.routeResult,settings:cueLab.state.settings,mode:cueLab.state.gameMode}))).toEqual(guard);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
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
