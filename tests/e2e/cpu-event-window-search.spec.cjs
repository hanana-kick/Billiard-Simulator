'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
async function open(page){if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();}
async function close(page){if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')==='true')await page.locator('.toolbox-heading').getByRole('button',{name:'설정 패널 닫기',exact:true}).click();}
async function boot(page,game){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.LOCAL_HTML)await page.setContent(fs.readFileSync(process.env.LOCAL_HTML,'utf8'));else await page.goto('./');
 await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
 expect(await page.evaluate(()=>cueLab.state.routeOptions.searchAlgorithm)).toBe('inverse-constraints');
 await open(page);await page.locator('#gameMode').getByRole('button',{name:game==='four'?'4구':'3구',exact:true}).click();
 await page.locator('#tab-routes').click();await page.locator('#routeDetails').click();
 await page.locator('#routeAlgorithm').click();await page.getByRole('option',{name:'관측 구간 단축 탐색 (실험)',exact:true}).click();
 expect(await page.evaluate(()=>cueLab.state.routeOptions.searchAlgorithm)).toBe('cpu-event-window-inverse');
 await page.locator('#closeRouteDetails').click();return errors;
}
for(const game of ['three','four'])test(`experimental CPU probe-window ${game} search uses the real Worker and scores the applied shot`,async({page},testInfo)=>{
 const errors=await boot(page,game);
 const original=await page.evaluate(()=>({world:Array.from(cueLab.lab.world.takeSnapshot()),settings:{...cueLab.state.settings}}));
 const start=Date.now();await page.locator('#findRoute').click();
 await page.waitForFunction(()=>['done','error'].includes(cueLab.state.routeStatus),null,{timeout:45000});
 const found=await page.evaluate(()=>({status:cueLab.state.routeStatus,error:cueLab.state.routeError,result:cueLab.state.routeResult,workers:cueLab.optimizer.workers.length,world:Array.from(cueLab.lab.world.takeSnapshot()),settings:{...cueLab.state.settings},shots:cueLab.lab.shots}));
 expect(found.status,found.error).toBe('done');expect(found.result.results.length).toBeGreaterThan(0);
 expect(found.result).toMatchObject({inputStrategy:'cpu-event-window-inverse',executionMode:'worker',workerCount:1,workerFallbackReason:null,terminationReason:'first-feasible-shot',continuable:true,exhaustive:false,globalOptimal:false});
 expect(found.workers).toBe(0);expect(found.world).toEqual(original.world);expect(found.settings).toEqual(original.settings);expect(found.shots).toBe(0);
 const searchMs=Date.now()-start,shot=found.result.results[0];await page.locator('#applyRoute'+shot.id).click();
 expect(await page.evaluate(()=>({...cueLab.state.settings}))).toEqual(shot.settings);
 await page.locator('#tab-shot').click();await page.locator('#tab-settings').click();await page.locator('#tab-routes').click();
 expect(await page.evaluate(()=>({...cueLab.state.settings}))).toEqual(shot.settings);
 await page.evaluate(()=>{
  const lab=cueLab.lab,original=lab.onEvent,selected=cueLab.state.selectedId;
  globalThis.__cpuEventLive={selected,contacts:[],foul:false,obstruction:false,worldStep:lab.world.step};
  lab.onEvent=function(event){
   if(original)original.call(this,event);
   if(event.kind==='cue-obstruction')__cpuEventLive.obstruction=true;
   if(event.kind!=='contact'||!event.a||!event.b)return;
   const other=event.a.id===selected?event.b:event.b.id===selected?event.a:null;if(!other)return;
   if(other.kind==='floor'||cueLab.state.gameMode==='four'&&cueLab.game.cueIds.includes(other.id)&&other.id!==selected)__cpuEventLive.foul=true;
   if(other.kind==='cushion'||other.id!=null)__cpuEventLive.contacts.push({kind:other.kind==='cushion'?'cushion':'object',id:other.id??null,rail:LabRouteRules.railId(other),time:event.time});
  };
 });
 await close(page);await page.locator('#strike').click();
 await page.waitForFunction(()=>cueLab.lab.shots===1&&!cueLab.lab.cue&&!cueLab.game.pending&&cueLab.lab.objects.every(o=>o.body.isSleeping()),null,{timeout:60000});
 const live=await page.evaluate(shot=>{
  const x=__cpuEventLive,end=x.contacts.findIndex(c=>c.kind==='object'&&c.id===shot.secondId),contacts=end<0?x.contacts:x.contacts.slice(0,end+1);
  return{score:cueLab.game.scores[x.selected],native:cueLab.lab.world.step===x.worldStep,foul:x.foul,obstruction:x.obstruction,contacts,rule:LabRouteRules.evaluate(contacts,{method:shot.method,firstId:shot.firstId,secondId:shot.secondId,minCushions:cueLab.state.gameMode==='three'?3:0})};
 },shot);
 expect(live).toMatchObject({score:1,native:true,foul:false,obstruction:false});expect(live.rule.success).toBe(true);
 expect(live.contacts.length).toBe(shot.contacts.length);
 for(let i=0;i<live.contacts.length;i++){expect(live.contacts[i].kind).toBe(shot.contacts[i].kind);expect(live.contacts[i].time).toBeCloseTo(shot.contacts[i].time,8);if(live.contacts[i].kind==='object')expect(live.contacts[i].id).toBe(shot.contacts[i].id);}
 expect(errors).toEqual([]);await testInfo.attach('cpu-event-window-live',{body:JSON.stringify({searchMs,shot,live},null,2),contentType:'application/json'});
});
test('experimental CPU probe-window search cancels, resumes and rejects changed inputs on a narrow screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});const errors=await boot(page,'four');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.locator('#findRoute').click();await page.locator('#cancelRoute').click();
 await expect.poll(()=>page.evaluate(()=>cueLab.state.routeStatus)).toBe('done');
 expect(await page.evaluate(()=>cueLab.optimizer.workers.length)).toBe(0);
 await page.locator('#resumeSearch').click();await page.waitForFunction(()=>['done','error'].includes(cueLab.state.routeStatus),null,{timeout:45000});
 const first=await page.evaluate(()=>({status:cueLab.state.routeStatus,result:cueLab.state.routeResult}));expect(first.status).toBe('done');expect(first.result.results.length).toBeGreaterThan(0);
 const identity=await page.evaluate(()=>LabRouteRules.successIdentity(cueLab.state.routeResult.results[0]));
 await page.locator('#resumeSearch').click();await page.locator('#cancelRoute').click();
 expect(await page.evaluate(identity=>cueLab.state.routeResult.results.some(r=>LabRouteRules.successIdentity(r)===identity),identity)).toBe(true);
 await page.locator('#findRoute').click();await page.locator('#tab-shot').click();await page.locator('#angle').fill('17.23');await page.locator('#angle').press('Tab');
 await expect.poll(()=>page.evaluate(()=>cueLab.state.routeStatus)).not.toBe('searching');
 const changed=await page.evaluate(()=>({status:cueLab.state.routeStatus,angle:cueLab.state.settings.angle,version:cueLab.optimizer.version,workers:cueLab.optimizer.workers.length,shots:cueLab.lab.shots}));
 expect(changed.angle).toBe(17.23);expect(changed.workers).toBe(0);expect(changed.shots).toBe(0);
 await page.waitForTimeout(1200);expect(await page.evaluate(()=>({status:cueLab.state.routeStatus,angle:cueLab.state.settings.angle,version:cueLab.optimizer.version,workers:cueLab.optimizer.workers.length,shots:cueLab.lab.shots}))).toEqual(changed);
 await page.locator('#tab-routes').click();if(await page.locator('#resumeSearch').count()){await page.locator('#resumeSearch').click();expect(await page.evaluate(()=>cueLab.state.routeStatus)).not.toBe('searching');}
 expect(errors).toEqual([]);
});
