const {test,expect}=require('@playwright/test');
test('explicit input strategy selection persists across panels and reaches the search service',async({page})=>{
 await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);await page.evaluate(()=>cueLab.option('predict',false));
 if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
 await page.getByRole('tab',{name:'경로 탐색',exact:true}).click();
 await page.locator('#routeDetails').click();
 await expect(page.locator('#routeInputStrategy [data-slot="select-value"]')).toHaveText('혼합 탐색');await page.locator('#routeInputStrategy').click();await page.getByRole('option',{name:'직접식 입력 추정',exact:true}).click();
 await page.getByRole('button',{name:'입력 계산 방식 설명',exact:true}).click();await expect(page.getByText('실제 마찰·쿠션·큐 접촉 전체의 정확한 단일식 해는 아닙니다.',{exact:false})).toBeVisible();await page.keyboard.press('Escape');
 await page.locator('#closeRouteDetails').click();await expect(page.locator('#routeDetails')).toBeFocused();await page.getByRole('tab',{name:'수동',exact:true}).click();await page.getByRole('tab',{name:'경로 탐색',exact:true}).click();await page.locator('#routeDetails').click();await expect(page.locator('#routeInputStrategy [data-slot="select-value"]')).toHaveText('직접식 입력 추정');await page.locator('#closeRouteDetails').click();
 await page.evaluate(()=>{cueLab.optimizer.request=req=>{globalThis.__strategyRequest=req.options;};});await page.locator('#findRoute').click();await expect.poll(()=>page.evaluate(()=>globalThis.__strategyRequest?.inputStrategy)).toBe('analytic');
});
