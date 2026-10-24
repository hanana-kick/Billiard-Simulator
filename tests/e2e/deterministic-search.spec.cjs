const {test,expect}=require('@playwright/test');
test('historical explicit fixed-angle baseline uses the global worker-independent plan and retains numerical correction',async({page})=>{
 await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
 await page.evaluate(()=>{cueLab.option('predict',false);cueLab.state.routeOptions={...cueLab.state.routeOptions,searchAlgorithm:'legacy-reference',budget:48};});
 if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
 await expect(page.locator('#tab-routes')).toHaveAttribute('aria-selected','true');
 await page.locator('#routeDetails').click();await page.locator('#routeElevation').click();await page.getByRole('option',{name:/현재.*고정/}).click();await page.locator('#closeRouteDetails').click();
 await page.locator('#findRoute').click();
 await page.waitForFunction(()=>['done','error'].includes(cueLab.state.routeStatus),{},{timeout:150000});
 const actual=await page.evaluate(()=>({status:cueLab.state.routeStatus,result:cueLab.state.routeResult,shots:cueLab.lab.shots}));
 expect(actual.status).toBe('done');expect(actual.shots).toBe(0);
 const r=actual.result;expect(r.tested).toBe(48);expect(r.total).toBe(48);expect(r.workerFallbackReason).toBe(null);expect(r.workerCount).toBe(r.workerPlan.requestedWorkers);expect(r.executionMode).toMatch(/^worker/);
 expect(r.candidatePlan.workerIndependent).toBe(true);expect(r.candidatePlan.committed).toBe(48);expect(r.solverStats.steps).toBeGreaterThan(0);expect(r.results.length).toBe(4);expect(r.resultLimit).toBe(null);expect(r.physicsSteps).toBe(352867);
 await expect(page.locator('[id^=applyRoute]')).toHaveCount(4);await page.locator('#applyRoute4').click();await expect(page.locator('#applyRoute4')).toHaveText('적용됨');
 expect(await page.evaluate(()=>cueLab.state.settings.angle)).toBeCloseTo(r.results[3].settings.angle,8);expect(await page.evaluate(()=>cueLab.lab.shots)).toBe(0);
});

test('default all-angle four-ball search applies a verified red-only shot and scores it with the same rules',async({page})=>{
 test.setTimeout(240000);
 await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);await page.evaluate(()=>cueLab.option('predict',false));
 if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
 await page.locator('#gameMode').getByRole('button',{name:'4구',exact:true}).click();await page.locator('#findRoute').click();
 // Inverse solving pauses with its state preserved; the observation window
 // covers all slices together and still requires an actual verified solution.
 const deadline=Date.now()+150000;
 for(;;){
  await page.waitForFunction(()=>cueLab.state.routeResult?.results?.length>0||['done','error'].includes(cueLab.state.routeStatus),{},{timeout:Math.max(1,deadline-Date.now())});
  const status=await page.evaluate(()=>({status:cueLab.state.routeStatus,found:cueLab.state.routeResult?.results?.length||0,continuable:cueLab.state.routeResult?.continuable}));
  expect(status.status).not.toBe('error');if(status.found)break;
  expect(Date.now()).toBeLessThan(deadline);expect(status.continuable).toBe(true);await page.locator('#resumeSearch').click();
 }
 if(await page.evaluate(()=>cueLab.state.routeStatus==='searching'))await page.locator('#cancelRoute').click();
 const r=await page.evaluate(()=>cueLab.state.routeResult);expect(r).toBeTruthy();expect(r.options.gameMode).toBe('four');expect(r.options.elevationMode).toBe('search');expect(r.options.minElevation).toBe(0);expect(r.options.maxElevation).toBe(85);expect(r.options.fourBallThreeCushion).toBe(false);expect(r.results.length).toBeGreaterThan(0);
 expect(await page.evaluate(()=>[cueLab.state.routeResult.options.targetId,cueLab.state.routeResult.options.secondId].every(id=>cueLab.game.redIds.includes(id)))).toBe(true);
 await page.locator('#applyRoute1').click();const cue=await page.evaluate(()=>cueLab.state.selectedId);
 if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')==='true')await page.locator('.toolbox-heading').getByRole('button',{name:'설정 패널 닫기',exact:true}).click();
 await page.locator('#strike').click();await page.waitForFunction(()=>cueLab.lab.shots===1&&!cueLab.game.pending&&!cueLab.lab.cue,{},{timeout:60000});
 expect(await page.evaluate(id=>cueLab.game.scores[id],cue)).toBe(1);expect(await page.evaluate(()=>cueLab.game.activeCue)).toBe(cue);
});
