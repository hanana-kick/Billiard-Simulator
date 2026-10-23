const {test,expect}=require('@playwright/test');
test('default route preset uses the global worker-independent plan and retains numerical correction',async({page})=>{
 await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
 await page.evaluate(()=>cueLab.option('predict',false));
 if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
 await expect(page.locator('#tab-routes')).toHaveAttribute('aria-selected','true');
 await page.locator('#findRoute').click();
 await page.waitForFunction(()=>['done','error'].includes(cueLab.state.routeStatus),{},{timeout:150000});
 const actual=await page.evaluate(()=>({status:cueLab.state.routeStatus,result:cueLab.state.routeResult,shots:cueLab.lab.shots}));
 expect(actual.status).toBe('done');expect(actual.shots).toBe(0);
 const r=actual.result;expect(r.tested).toBe(48);expect(r.total).toBe(48);expect(r.workerFallbackReason).toBe(null);expect(r.workerCount).toBe(r.workerPlan.requestedWorkers);expect(r.executionMode).toMatch(/^worker/);
 expect(r.candidatePlan.workerIndependent).toBe(true);expect(r.candidatePlan.committed).toBe(48);expect(r.solverStats.steps).toBeGreaterThan(0);expect(r.results.length).toBe(4);expect(r.resultLimit).toBe(null);expect(r.physicsSteps).toBe(352867);
 await expect(page.locator('[id^=applyRoute]')).toHaveCount(4);await page.locator('#applyRoute4').click();await expect(page.locator('#applyRoute4')).toHaveText('적용됨');
 expect(await page.evaluate(()=>cueLab.state.settings.angle)).toBeCloseTo(r.results[3].settings.angle,8);expect(await page.evaluate(()=>cueLab.lab.shots)).toBe(0);
});
