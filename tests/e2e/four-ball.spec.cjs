const {test,expect}=require('@playwright/test');
async function settleSidebarLayout(page){
 // matchMedia updates synchronously; React's useIsMobile switches branches later.
 await expect.poll(()=>page.evaluate(()=>{
  const mobile=matchMedia('(max-width: 767px)').matches;
  const desktopBranch=!!document.querySelector('[data-slot="sidebar"][data-state]:not([data-mobile])');
  return mobile?!desktopBranch:desktopBranch;
 }),{message:'React Sidebar branch matches the resized CSS viewport'}).toBe(true);
}
async function openSidebar(page){
 await settleSidebarLayout(page);
 if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
 await expect(page.locator('#tab-shot')).toBeInViewport({ratio:1});
}
async function closeSidebar(page){
 await settleSidebarLayout(page);
 if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')==='true')await page.locator('.toolbox-heading').getByRole('button',{name:'설정 패널 닫기',exact:true}).click();
 await expect(page.locator('#tab-shot')).not.toBeInViewport();
}
async function boot(page){await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__);await page.evaluate(()=>cueLab.option('predict',false));}
async function four(page){await openSidebar(page);await page.getByRole('tab',{name:'경로 탐색',exact:true}).click();await expect(page.locator('#gameMode')).toBeInViewport();await page.locator('#gameMode').getByRole('button',{name:'4구',exact:true}).click();await expect(page.locator('#gameMode').getByRole('button',{name:'4구',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('tab',{name:'수동',exact:true}).click();}

for(const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
 test(`four ball responsive ${viewport.width}x${viewport.height}`,async({page})=>{await page.setViewportSize(viewport);await boot(page);await four(page);await expect(page.getByLabel('4구 점수')).toBeVisible();expect(await page.evaluate(()=>cueLab.lab.objects.length)).toBe(4);await expect(page.locator('#ballChoices').getByRole('button')).toHaveCount(2);await page.getByRole('tab',{name:'설정',exact:true}).click();await page.getByRole('tab',{name:'수동',exact:true}).click();expect(await page.evaluate(()=>cueLab.lab.objects.length)).toBe(4);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('#panelGroup')).toBeInViewport();await closeSidebar(page);const canvas=await page.locator('#scene').boundingBox();expect(canvas.width).toBeGreaterThan(100);expect(canvas.height).toBeGreaterThan(60);expect(canvas.x).toBeGreaterThanOrEqual(0);expect(canvas.y+canvas.height).toBeLessThanOrEqual(viewport.height+1);await openSidebar(page);await page.locator('#reset').scrollIntoViewIfNeeded();await page.locator('#reset').click();expect(await page.evaluate(()=>cueLab.lab.objects.length)).toBe(4);expect(await page.evaluate(()=>Object.values(cueLab.game.scores))).toEqual([0,0]);});
}
test('worker rendering presents frames and cleanly falls back on worker failure',async({page})=>{await boot(page);const worker=await page.evaluate(()=>cueLab.renderer.workerMode);test.skip(!worker,'OffscreenCanvas WebGL unavailable in this browser');await page.waitForFunction(()=>cueLab.renderer.metrics.frames>0);await page.evaluate(()=>{cueLab.renderer.fail('test failure');cueLab.dirty=true;});await page.waitForFunction(()=>cueLab.renderer.isFallback);await expect(page.locator('#scene')).toBeVisible();});
test('four-ball opens a valid unrestricted two-ball search and preserves its targets',async({page})=>{
 await page.setViewportSize({width:390,height:844});await boot(page);await four(page);await page.getByRole('tab',{name:'경로 탐색',exact:true}).click();
 expect(await page.evaluate(()=>cueLab.state.routeOptions.mode)).toBe('carom');
 const targets=await page.evaluate(()=>[cueLab.state.routeOptions.targetId,cueLab.state.routeOptions.secondId]);
 expect(await page.evaluate(ids=>ids.every(id=>cueLab.game.redIds.includes(id)),targets)).toBe(true);
 await page.locator('#routeDetails').click();
 await page.getByRole('checkbox',{name:'키스 허용',exact:true}).uncheck();
 expect(await page.evaluate(()=>cueLab.state.routeOptions.allowKiss)).toBe(false);await page.locator('#closeRouteDetails').click();
 await page.locator('#findRoute').click();
 await page.waitForFunction(()=>['done','error'].includes(cueLab.state.routeStatus),{},{timeout:150000});
 expect(await page.evaluate(()=>cueLab.state.routeStatus)).toBe('done');
 expect(await page.evaluate(()=>cueLab.state.routeResult.options.mode)).toBe('carom');
 expect(await page.evaluate(()=>cueLab.state.routeResult.options.allowKiss)).toBe(false);
 expect(await page.evaluate(()=>cueLab.state.routeResult.results.every(r=>!r.kissContacts?.some(k=>k.time<=r.seconds)))).toBe(true);
 expect(await page.evaluate(()=>cueLab.lab.shots)).toBe(0);
});

test('visible game modes reset the world once and show the actual turn even while inspecting a red ball',async({page})=>{
 await page.setViewportSize({width:320,height:568});await boot(page);await openSidebar(page);
 const modes=page.locator('#gameMode');await expect(modes.getByRole('button',{name:'3구',exact:true})).toHaveAttribute('aria-pressed','true');await expect(modes.getByRole('button')).toHaveCount(2);await expect(modes).toBeInViewport();await expect(page.locator('#gameSetup')).toHaveCount(0);
 await four(page);await expect(page.getByLabel('4구 점수')).toContainText('현재 차례 흰 수구');
 await page.evaluate(()=>cueLab.select(cueLab.game.redIds[0]));await expect(page.getByLabel('4구 점수')).toContainText('현재 차례 흰 수구');
 await page.locator('#ballChoices').getByRole('button',{name:'노란 수구',exact:true}).click();expect(await page.evaluate(()=>cueLab.state.selectedId)).toBe(await page.evaluate(()=>cueLab.game.cueIds[1]));
 await page.getByRole('tab',{name:'경로 탐색',exact:true}).click();expect(await page.evaluate(()=>[cueLab.state.routeOptions.targetId,cueLab.state.routeOptions.secondId].every(id=>cueLab.game.redIds.includes(id)))).toBe(true);
 await page.getByRole('tab',{name:'경로 탐색',exact:true}).click();await modes.getByRole('button',{name:'3구',exact:true}).click();
 // Three-ball now owns turn/scoring rules too; switching modes must not remove them.
 expect(await page.evaluate(()=>({balls:cueLab.lab.objects.length,game:cueLab.game.snapshot(),shots:cueLab.lab.shots,selectedId:cueLab.state.selectedId}))).toMatchObject({balls:3,game:{kind:'three',cueIds:[1,2],objectIds:[1,2,3],activeCue:1,scores:{1:0,2:0},pending:null},shots:0,selectedId:1});
 await page.getByRole('tab',{name:'수동',exact:true}).click();
 await expect(page.getByLabel('3구 점수')).toContainText('현재 차례 수구');
 await page.evaluate(()=>cueLab.select(3));await expect(page.getByLabel('3구 점수')).toContainText('현재 차례 수구');
 await four(page);expect(await page.evaluate(()=>Object.values(cueLab.game.scores))).toEqual([0,0]);expect(await page.evaluate(()=>cueLab.game.activeCue)).toBe(1);
});

test('four-ball physical foul updates turn and score, and visible undo/redo restores both',async({page})=>{
 await boot(page);await four(page);await closeSidebar(page);await page.locator('#strike').click();
 await page.waitForFunction(()=>!cueLab.game.pending&&!cueLab.lab.cue&&cueLab.lab.shots===1,{},{timeout:60000});
 await openSidebar(page);await expect(page.getByLabel('4구 점수')).toContainText('흰 수구 -1');await expect(page.getByLabel('4구 점수')).toContainText('현재 차례 노란 수구');
 await page.locator('#undo').click();await expect(page.getByLabel('4구 점수')).toContainText('흰 수구 0');await expect(page.getByLabel('4구 점수')).toContainText('현재 차례 흰 수구');
 await page.locator('#redo').click();await expect(page.getByLabel('4구 점수')).toContainText('흰 수구 -1');await expect(page.getByLabel('4구 점수')).toContainText('현재 차례 노란 수구');
});
