'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');

// Guard both cooperative execution and Blob workers, without replacing the
// production solver, physics, worker scheduling, or browser sandbox settings.
function forbidLegacySampling(){
 globalThis.__inverseLegacyCalls=0;
 for(const [api,names] of [[globalThis.LabRouteSampler,['proposals','freeProposals','freeProposalAt','inverseInputSeeds','next']],[globalThis.ShotSearchCore,['proposeCandidate','beginCandidate','createSearch','advanceSearch']],[globalThis.LabOptimizer,['createSearch','createStagedSearch','planWave','advanceSearch']]]){
  if(!api)throw Error('Missing production legacy API guard target');
  for(const name of names){if(typeof api[name]!=='function')throw Error('Missing legacy API: '+name);api[name]=()=>{globalThis.__inverseLegacyCalls++;throw Error('Legacy input sampling is forbidden: '+name);};}
 }
}

test('public default inverse search resumes preserved solutions and scores a live three-cushion shot',async({page},testInfo)=>{
 test.setTimeout(240000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 if(process.env.LOCAL_HTML)await page.setContent(fs.readFileSync(process.env.LOCAL_HTML,'utf8'));else await page.goto('./');
 await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
 if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
 await page.locator('#gameMode').getByRole('button',{name:'3구',exact:true}).click();
 await page.getByRole('tab',{name:'경로 탐색',exact:true}).click();
 await page.evaluate(forbidLegacySampling);
 await page.evaluate(guard=>{
  // OptimizerService concatenates this source into every fresh/resumed worker.
  // Appending a guard changes no physical code and runs before worker messages.
  const source=document.getElementById('source-optimizer-worker');if(!source)throw Error('Worker source unavailable');
  source.textContent+='\n;('+guard+')();\n';
  globalThis.__inverseSourceWorld=cueLab.lab;
  globalThis.__inverseSourceBytes=Array.from(cueLab.lab.world.takeSnapshot());
  globalThis.__inverseInitialSettings={...cueLab.state.settings};
 },forbidLegacySampling.toString());
 const initial=await page.evaluate(()=>({...cueLab.state.routeOptions}));
 expect(initial).toMatchObject({searchAlgorithm:'inverse-constraints',mode:'three',maxCushions:3,maxKisses:1,solveTimeMs:20000,order:'either',allowKiss:true,elevationMode:'search',minElevation:0,maxElevation:85,workers:0});
 expect(initial.methods).toEqual(['any']);expect(initial.budget).toBeUndefined();

 // The observation bound covers all 20-second slices together, not each retry.
 // No topology/root selection, injected solution, candidate cap, or relaxed
 // success criterion is allowed if this public default search does not solve.
 const searchStarted=Date.now(),deadline=searchStarted+150000;let resumes=0;
 await page.locator('#findRoute').click();
 for(;;){
  const remaining=deadline-Date.now();expect(remaining,'Default inverse search must verify a route within the total 150-second observation window').toBeGreaterThan(0);
  await page.waitForFunction(()=>cueLab.state.routeResult?.results?.length>0||['done','error'].includes(cueLab.state.routeStatus),null,{timeout:remaining});
  const state=await page.evaluate(()=>({status:cueLab.state.routeStatus,error:cueLab.state.routeError,count:cueLab.state.routeResult?.results?.length||0,continuable:cueLab.state.routeResult?.continuable}));
  expect(state.status,state.error).not.toBe('error');
  if(state.count)break;
  expect(state.continuable,'An unresolved time slice must retain resumable constraint state').toBe(true);
  await page.locator('#resumeSearch').click();resumes++;
  await expect.poll(()=>page.evaluate(()=>cueLab.state.routeStatus)).toBe('searching');
 }
 if(await page.evaluate(()=>cueLab.state.routeStatus==='searching'))await page.locator('#cancelRoute').click();
 await expect.poll(()=>page.evaluate(()=>cueLab.state.routeStatus)).toBe('done');
 const preserved=await page.evaluate(()=>{
  const r=cueLab.state.routeResult,shot=r.results[0];globalThis.__inversePreservedIdentity=LabRouteRules.successIdentity(shot);
  return {shot,result:{inputStrategy:r.inputStrategy,searchModel:r.searchModel,globalOptimal:r.globalOptimal,exhaustive:r.exhaustive,branches:r.branches,continuable:r.continuable},sourceUnchanged:cueLab.lab===__inverseSourceWorld&&JSON.stringify(Array.from(cueLab.lab.world.takeSnapshot()))===JSON.stringify(__inverseSourceBytes),settingsUnchanged:JSON.stringify(cueLab.state.settings)===JSON.stringify(__inverseInitialSettings),shots:cueLab.lab.shots};
 });
 expect(preserved.sourceUnchanged).toBe(true);expect(preserved.settingsUnchanged).toBe(true);expect(preserved.shots).toBe(0);
 expect(preserved.result).toMatchObject({inputStrategy:'inverse-constraints',searchModel:'topology-constrained-inverse-root-solve',globalOptimal:false,exhaustive:false,continuable:true});
 expect(preserved.shot.success).toBe(true);expect(preserved.shot.searchModel.stage).toBe('inverse-constraint-solution');
 expect(preserved.result.branches.some(b=>b.id===preserved.shot.inverseBranch&&b.status==='verified')).toBe(true);

 // Exercise public pause/resume after success, requiring the same certified
 // route to survive. Numeric row IDs may change when the result list re-sorts.
 await page.locator('#resumeSearch').click();resumes++;
 await expect.poll(()=>page.evaluate(()=>cueLab.state.routeStatus)).toBe('searching');
 expect(await page.evaluate(()=>cueLab.state.routeResult.results.some(s=>LabRouteRules.successIdentity(s)===__inversePreservedIdentity))).toBe(true);
 await page.locator('#cancelRoute').click();
 await expect.poll(()=>page.evaluate(()=>cueLab.state.routeStatus)).toBe('done');
 const chosen=await page.evaluate(()=>cueLab.state.routeResult.results.find(s=>LabRouteRules.successIdentity(s)===__inversePreservedIdentity));
 expect(chosen).toBeTruthy();expect(chosen.settings).toEqual(preserved.shot.settings);
 await page.locator('#applyRoute'+chosen.id).click();
 expect(await page.evaluate(()=>({...cueLab.state.settings}))).toEqual(chosen.settings);
 expect(await page.evaluate(()=>cueLab.lab.shots)).toBe(0);

 await page.evaluate(()=>{
  const lab=cueLab.lab,original=lab.onEvent;globalThis.__inverseLive={contacts:[],cueObstruction:false,offTable:false,worldStep:lab.world.step,originalCalls:0};
  lab.onEvent=function(event){
   // Preserve the real controller/game callback and its receiver, rather than
   // installing a scoring replacement or observing an inverse trial world.
   if(original){__inverseLive.originalCalls++;original.call(this,event);}
   if(event.kind==='cue-obstruction')__inverseLive.cueObstruction=true;
   if(event.kind!=='contact'||!event.a||!event.b)return;
   const cueId=cueLab.state.selectedId,other=event.a.id===cueId?event.b:event.b.id===cueId?event.a:null;if(!other)return;
   if(other.kind==='floor')__inverseLive.offTable=true;
   if(other.kind==='cushion'||other.id!=null)__inverseLive.contacts.push({kind:other.kind==='cushion'?'cushion':'object',id:other.id??null,rail:LabRouteRules.railId(other),time:event.time});
  };
 });
 if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')==='true')await page.locator('.toolbox-heading').getByRole('button',{name:'설정 패널 닫기',exact:true}).click();
 await page.locator('#strike').click();
 // Use the normal animation/physics loop; never invoke lab.step or synthesize
 // contacts from the expected path. Full rest also catches late obstruction.
 await page.waitForFunction(()=>cueLab.lab.shots===1&&!cueLab.lab.cue&&cueLab.lab.objects.every(o=>o.body.isSleeping()),null,{timeout:60000});
 const live=await page.evaluate(shot=>{
  const x=__inverseLive,second=x.contacts.findIndex(c=>c.kind==='object'&&c.id===shot.secondId),throughGoal=second<0?x.contacts:x.contacts.slice(0,second+1);
  return {contacts:throughGoal,evaluation:LabRouteRules.evaluate(throughGoal,{method:shot.method,firstId:shot.firstId,secondId:shot.secondId,minCushions:3}),distinctObjects:[...new Set(throughGoal.filter(c=>c.kind==='object').map(c=>c.id))],rails:throughGoal.filter(c=>c.kind==='cushion').length,cueObstruction:x.cueObstruction,offTable:x.offTable,nativeWorldStep:cueLab.lab.world.step===x.worldStep,settings:{...cueLab.state.settings},shots:cueLab.lab.shots,legacyCalls:__inverseLegacyCalls,seconds:cueLab.lab.time};
 },chosen);
 expect(live.nativeWorldStep).toBe(true);expect(live.settings).toEqual(chosen.settings);expect(live.shots).toBe(1);expect(live.legacyCalls).toBe(0);
 expect(live.cueObstruction).toBe(false);expect(live.offTable).toBe(false);expect(live.distinctObjects).toEqual([chosen.firstId,chosen.secondId]);expect(live.rails).toBeGreaterThanOrEqual(3);expect(live.evaluation.success).toBe(true);
 expect(errors).toEqual([]);
 await testInfo.attach('default-inverse-live-evidence',{body:JSON.stringify({initial,searchObservationLimitMs:150000,resumes,chosen,live},null,2),contentType:'application/json'});
});
