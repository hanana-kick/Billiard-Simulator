const {test,expect}=require('@playwright/test');
test('inverse domain selection persists across panels and reaches the actual default service request',async({page})=>{
 await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);await page.evaluate(()=>cueLab.option('predict',false));
 if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
 await page.getByRole('tab',{name:'경로 탐색',exact:true}).click();await page.locator('#routeDetails').click();
 await expect(page.locator('#routeBudget')).toHaveCount(0);await expect(page.locator('#routeInputStrategy')).toHaveCount(0);await expect(page.locator('#inverseMethod')).toContainText('제약식');
 await page.locator('#routeDepth').click();await page.getByRole('option',{name:'4회까지',exact:true}).click();
 await page.locator('#routeKissDepth').click();await page.getByRole('option',{name:'2회까지',exact:true}).click();
 await page.locator('#closeRouteDetails').click();await expect(page.locator('#routeDetails')).toBeFocused();await page.getByRole('tab',{name:'수동',exact:true}).click();await page.getByRole('tab',{name:'경로 탐색',exact:true}).click();await page.locator('#routeDetails').click();
 await expect(page.locator('#routeDepth [data-slot="select-value"]')).toHaveText('4회까지');await expect(page.locator('#routeKissDepth [data-slot="select-value"]')).toHaveText('2회까지');await page.locator('#closeRouteDetails').click();
 await page.evaluate(()=>{cueLab.optimizer.request=req=>{globalThis.__constraintRequest=req.options;};});await page.locator('#findRoute').click();
 await expect.poll(()=>page.evaluate(()=>globalThis.__constraintRequest?.searchAlgorithm)).toBe('inverse-constraints');expect(await page.evaluate(()=>globalThis.__constraintRequest.maxCushions)).toBe(4);expect(await page.evaluate(()=>globalThis.__constraintRequest.maxKisses)).toBe(2);expect(await page.evaluate(()=>globalThis.__constraintRequest.budget)).toBeUndefined();
});
