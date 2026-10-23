const {test,expect}=require('@playwright/test');
async function openSidebar(page){
 if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
 await expect(page.locator('#tab-shot')).toBeInViewport({ratio:1});
}
async function closeSidebar(page){
 if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')==='true')await page.locator('.toolbox-heading').getByRole('button',{name:'설정 패널 닫기',exact:true}).click();
 await expect(page.locator('#tab-shot')).not.toBeInViewport();
}
async function boot(page){await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__);await page.evaluate(()=>cueLab.option('predict',false));}
async function four(page){await openSidebar(page);await page.locator('#gameMode').click();await page.getByRole('option',{name:'한국 4구 · 연습 규칙',exact:true}).click();}
for(const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
 test(`four ball responsive ${viewport.width}x${viewport.height}`,async({page})=>{await page.setViewportSize(viewport);await boot(page);await four(page);await expect(page.getByLabel('4구 점수')).toBeVisible();expect(await page.evaluate(()=>cueLab.lab.objects.length)).toBe(4);await expect(page.locator('#ballChoices').getByRole('button')).toHaveCount(2);await page.getByRole('tab',{name:'설정',exact:true}).click();await page.getByRole('tab',{name:'타격',exact:true}).click();expect(await page.evaluate(()=>cueLab.lab.objects.length)).toBe(4);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('#panelGroup')).toBeInViewport();await closeSidebar(page);const canvas=await page.locator('#scene').boundingBox();expect(canvas.width).toBeGreaterThan(100);expect(canvas.height).toBeGreaterThan(60);expect(canvas.x).toBeGreaterThanOrEqual(0);expect(canvas.y+canvas.height).toBeLessThanOrEqual(viewport.height+1);await openSidebar(page);await page.locator('#reset').click();expect(await page.evaluate(()=>cueLab.lab.objects.length)).toBe(4);expect(await page.evaluate(()=>Object.values(cueLab.game.scores))).toEqual([0,0]);});
}
test('worker rendering presents frames and cleanly falls back on worker failure',async({page})=>{await boot(page);const worker=await page.evaluate(()=>cueLab.renderer.workerMode);test.skip(!worker,'OffscreenCanvas WebGL unavailable in this browser');await page.waitForFunction(()=>cueLab.renderer.metrics.frames>0);await page.evaluate(()=>{cueLab.renderer.fail('test failure');cueLab.dirty=true;});await page.waitForFunction(()=>cueLab.renderer.isFallback);await expect(page.locator('#scene')).toBeVisible();});
