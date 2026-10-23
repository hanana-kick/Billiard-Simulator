const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const tab=(page,name)=>page.getByRole('tab',{name,exact:true});
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
async function boot(page){
 page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.LOCAL_HTML)await page.setContent(fs.readFileSync(process.env.LOCAL_HTML,'utf8'));else await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
 await page.evaluate(()=>cueLab.option('predict',false));
 await openSidebar(page);await tab(page,'수동').click();
 return errors;
}
async function select(page,id,label){await page.locator('#'+id).click();await page.getByRole('option',{name:label,exact:true}).click();}
async function assertOnePanel(page,id){await expect(page.locator('[role=tabpanel]:visible')).toHaveCount(1);await expect(page.locator('#'+id)).toBeVisible();}
async function settleInput(page,id,text){await page.locator('#'+id).fill(text);await page.locator('#'+id).press('Tab');}

test('three real Base UI tabs preserve world, settings, focus and mounted canvases',async({page})=>{
 const errors=await boot(page);
 await expect(page).toHaveTitle(/Cue Lab/);
 await expect(page.locator('#panelGroup [role=tab]')).toHaveCount(3);
 await expect(page.locator('#openSettings')).toHaveCount(0);
 await assertOnePanel(page,'shotPanel');
 await settleInput(page,'angle','17.23');
 const positions=await page.evaluate(()=>{globalThis.savedLab=cueLab.lab;globalThis.savedCanvas=document.getElementById('scene');return cueLab.lab.objects.map(o=>({...o.body.translation()}));});
 await tab(page,'경로 탐색').click();await assertOnePanel(page,'routesPanel');
 await tab(page,'설정').click();await assertOnePanel(page,'settingsPanel');
 await select(page,'horizon','16초');await select(page,'speed','0.5×');
 await tab(page,'수동').click();await expect(page.locator('#angle')).toHaveValue('17.23');
 expect(await page.evaluate(()=>({sameWorld:cueLab.lab===savedLab,sameCanvas:document.getElementById('scene')===savedCanvas,positions:cueLab.lab.objects.map(o=>({...o.body.translation()})),horizon:cueLab.state.horizon,rate:cueLab.state.rate}))).toEqual({sameWorld:true,sameCanvas:true,positions,horizon:16,rate:.5});
 await tab(page,'수동').focus();await page.keyboard.press('ArrowLeft');
 await expect(tab(page,'경로 탐색')).toHaveAttribute('aria-selected','true');
 await assertOnePanel(page,'routesPanel');expect(errors).toEqual([]);
});

test('all settings work through actual Base UI controls',async({page})=>{
 const errors=await boot(page);await tab(page,'설정').click();
 for(const id of ['horizon','speed','step','clearTrails','placement','posX','posZ','posY','height','addBall','addBox','remove','materials','contacts','undo','reset']){
  const el=page.locator('#'+id);await el.scrollIntoViewIfNeeded();await expect(el).toBeVisible();
 }
 for(const [id,key]of [['조준 큐 표시','showCue'],['실제 이동 궤적','paths'],['모든 타격 경로 보기','allPaths'],['충돌 형상','debug'],['속도 벡터','vectors']]){
  const before=await page.evaluate(key=>cueLab.state[key],key);await page.getByRole('checkbox',{name:id,exact:true}).click();expect(await page.evaluate(key=>cueLab.state[key],key)).toBe(!before);await page.getByRole('checkbox',{name:id,exact:true}).click();
 }
 await settleInput(page,'posX','-60');expect(await page.evaluate(()=>cueLab.lab.get(cueLab.state.selectedId).body.translation().x)).toBeCloseTo(-.6,4);
 await settleInput(page,'posY','10');expect(await page.evaluate(()=>cueLab.lab.get(cueLab.state.selectedId).body.translation().y)).toBeGreaterThan(.12);await page.locator('#putOnTable').click();
 const count=await page.evaluate(()=>cueLab.lab.objects.length);await page.locator('#addBall').click();expect(await page.evaluate(()=>cueLab.lab.objects.length)).toBe(count+1);await page.locator('#remove').click();await page.locator('#addBox').click();expect(await page.evaluate(()=>cueLab.lab.get(cueLab.state.selectedId).shape)).toBe('box');await page.locator('#remove').click();
 for(const key of ['clothFriction','cushionRestitution','cushionFriction','ballRestitution','ballFriction','tipFriction','gravity','rollingLength','spinLength']){
  const before=await page.evaluate(key=>cueLab.lab.params[key],key);const group=page.locator('#p-'+key);await group.scrollIntoViewIfNeeded();await expect(group.locator('[data-slot=slider-thumb]')).toBeVisible();const track=await group.locator('[data-slot=slider-track]').boundingBox();expect(track.height).toBeGreaterThan(0);const slider=group.getByRole('slider');await slider.focus();await slider.press('ArrowRight');expect(await page.evaluate(key=>cueLab.lab.params[key],key)).not.toBe(before);
 }
 expect(errors).toEqual([]);
});

test('desktop and small-screen layout keeps table and one scrollable panel usable',async({page})=>{
 const errors=await boot(page);fs.mkdirSync('test-results/screenshots',{recursive:true});
 for(const [width,height]of [[320,568],[390,844],[768,1024],[844,390],[1440,900]]){
  await page.setViewportSize({width,height});await openSidebar(page);await tab(page,'설정').click();
  await page.locator('#p-spinLength').scrollIntoViewIfNeeded();
  const sizes=await page.evaluate(()=>{const table=document.getElementById('scene').getBoundingClientRect(),tabs=document.getElementById('panelGroup').getBoundingClientRect(),s=document.querySelector('#p-spinLength').getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth+1,tableVisible:table.top>=0&&table.bottom<=innerHeight,tableHeight:table.height,tabsVisible:tabs.top>=0&&tabs.bottom<=innerHeight,sliderReachable:s.top>=0&&s.bottom<=innerHeight}});
  expect(sizes.overflow).toBe(false);expect(sizes.tableVisible).toBe(true);expect(sizes.tableHeight).toBeGreaterThan(60);expect(sizes.tabsVisible).toBe(true);expect(sizes.sliderReachable).toBe(true);
  await tab(page,'수동').click();await assertOnePanel(page,'shotPanel');
  await closeSidebar(page);await expect(page.locator('#scene')).toBeInViewport();
  await page.screenshot({path:`test-results/screenshots/${width}x${height}.png`});
 }
 expect(errors).toEqual([]);
});

test('touch navigation, fine aim and pinch cancellation work without firing',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const page=await context.newPage();const errors=await boot(page);
 await tab(page,'설정').tap();await assertOnePanel(page,'settingsPanel');await tab(page,'경로 탐색').tap();await assertOnePanel(page,'routesPanel');await tab(page,'수동').tap();await closeSidebar(page);
 const before=await page.evaluate(()=>cueLab.state.settings.angle);const r=await page.locator('#aimPad').boundingBox(),cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+60,y:r.y+r.height/2,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+110,y:r.y+r.height/2,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 expect(await page.evaluate(()=>cueLab.state.settings.angle)).not.toBe(before);expect(await page.evaluate(()=>cueLab.lab.shots)).toBe(0);
 await openSidebar(page);await tab(page,'수동').tap();await page.getByRole('checkbox',{name:'미세 조준',exact:true}).tap();await expect.poll(()=>page.evaluate(()=>cueLab.state.fineAim)).toBe(true);await closeSidebar(page);
 const fineBefore=await page.evaluate(()=>cueLab.state.settings.angle),x=r.x+60,y=r.y+r.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+30,y,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 expect(await page.evaluate(()=>cueLab.state.settings.angle)-fineBefore).toBeCloseTo(.3,2);
 await openSidebar(page);await page.locator('#angle').fill('0');await page.locator('#angle').press('Enter');await closeSidebar(page);
 const ball=await page.evaluate(()=>{const o=cueLab.lab.get(cueLab.state.selectedId),p=o.body.translation(),r=cueLab.canvas.getBoundingClientRect(),q=cueLab.renderer.project(p);return {x:r.left+q.x,y:r.top+q.y,pos:{...p}};});
 const gx=ball.x,gy=ball.y,px=gx+24,py=gy-20;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:gx,y:gy,id:1}]});
 await page.waitForFunction(()=>cueLab.drag?.type==='ball');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:px,y:py,id:1}]});
 await page.waitForFunction(()=>cueLab.drag?.changed);
 const view=await page.locator('#viewport').boundingBox(),tx=view.x+view.width*.8,ty=view.y+view.height*.5;
 const zoom=await page.evaluate(()=>cueLab.renderer.camera.zoom);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:px,y:py,id:1},{x:tx,y:ty,id:2}]});
 await page.waitForFunction(()=>!!cueLab.pinch&&!cueLab.drag);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:px,y:py,id:1},{x:tx+20,y:ty,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 expect(await page.evaluate(()=>cueLab.renderer.camera.zoom)).not.toBe(zoom);
 expect(await page.evaluate(()=>({...cueLab.lab.get(cueLab.state.selectedId).body.translation()}))).toEqual(ball.pos);
 expect(await page.evaluate(()=>cueLab.lab.shots)).toBe(0);
 expect(await page.evaluate(()=>!!cueLab.windup||!!cueLab.drag)).toBe(false);expect(errors).toEqual([]);await context.close();
});

test('three-cushion search yields a real candidate, applies and preserves it across tabs',async({page})=>{
 const errors=await boot(page);await tab(page,'경로 탐색').click();expect(await page.evaluate(()=>cueLab.state.routeOptions.mode)).toBe('three');
 await page.locator('#findRoute').click();
 await page.waitForFunction(()=>cueLab.state.routeResult?.results.length>0||cueLab.state.routeStatus==='error',{},{timeout:150000});
 expect(await page.evaluate(()=>cueLab.state.routeStatus)).not.toBe('error');
 await page.locator('.route-result button').first().click();
 expect(await page.evaluate(()=>cueLab.lab.shots)).toBe(0);const setting=await page.evaluate(()=>({...cueLab.state.settings}));
 await tab(page,'설정').click();await tab(page,'수동').click();expect(await page.evaluate(()=>({...cueLab.state.settings}))).toEqual(setting);
 await page.locator('#strike').click();await page.waitForFunction(()=>cueLab.lab.time>.5);expect(await page.evaluate(()=>cueLab.state.previewCueVisible)).toBe(false);expect(await page.evaluate(()=>cueLab.lab.shots)).toBe(1);expect(errors).toEqual([]);
});

test('bundled build has no runtime dependency on external CDNs',async({page})=>{
 const external=[];page.on('request',r=>{const url=r.url();if(/^https?:/.test(url)&&new URL(url).origin!==new URL(process.env.APP_URL||'http://127.0.0.1:8787').origin)external.push(url);});
 await boot(page);await tab(page,'설정').click();await select(page,'horizon','8초');expect(external).toEqual([]);
});

test('direct scene remains usable across sizes without removed fullscreen or cue overlays',async({page})=>{
 const errors=await boot(page);await page.evaluate(()=>{globalThis.focusWorld=cueLab.lab;globalThis.focusCanvas=document.querySelector('#scene');});
 for(const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
  await page.setViewportSize(viewport);await closeSidebar(page);
  await expect(page.locator('#fullscreen,#aimHandle,#gripHandle,.pull-meter')).toHaveCount(0);
  await expect(page.locator('.workspace-header')).toBeVisible();await expect(page.locator('#scene')).toBeInViewport();
  expect(await page.evaluate(()=>!document.fullscreenElement&&cueLab.lab===focusWorld&&document.querySelector('#scene')===focusCanvas)).toBe(true);
  const stage=await page.locator('#stagePreview').boundingBox();expect(stage.height).toBeGreaterThan(60);expect(stage.width).toBeGreaterThan(viewport.width-50);
  await openSidebar(page);await expect(page.locator('#strike')).toBeInViewport();await closeSidebar(page);
 }
 expect(errors).toEqual([]);
});

async function worldPoint(page,p){return page.evaluate(p=>{const r=cueLab.canvas.getBoundingClientRect(),q=cueLab.renderer.project(p);return {x:r.left+q.x,y:r.top+q.y};},p);}
test('empty-space forward aim, rear shaft drag, automatic ball movement and undo/redo use real pointer coordinates',async({page})=>{
 const errors=await boot(page);await closeSidebar(page);await page.locator('#viewGroup button').filter({hasText:'상단'}).click();
 const initial=await page.evaluate(()=>({...cueLab.lab.get(1).body.translation()}));
 let target=await worldPoint(page,{...initial,x:initial.x+.25,z:initial.z+.25});await page.mouse.click(target.x,target.y);
 expect(await page.evaluate(()=>cueLab.state.settings.angle)).toBeCloseTo(45,0);
 const rear=await page.evaluate(()=>{const p=cueLab.cuePoints().grip,q=cueLab.renderer.project(p),r=cueLab.canvas.getBoundingClientRect();return {x:r.left+q.x,y:r.top+q.y};});
 await page.mouse.move(rear.x,rear.y);await page.mouse.down();await page.waitForFunction(()=>cueLab.drag?.type==='aim');await page.mouse.move(rear.x+20,rear.y+30,{steps:5});await page.mouse.up();
 expect(await page.evaluate(()=>cueLab.lab.shots)).toBe(0);expect(await page.evaluate(()=>cueLab.state.settings.angle)).not.toBeCloseTo(45,0);
 const origin=await worldPoint(page,initial),destination=await worldPoint(page,{...initial,x:initial.x+.15,z:initial.z-.18});
 const canvasBeforeDrag=await page.locator('#scene').boundingBox();await page.mouse.move(origin.x,origin.y);await page.mouse.down();await page.waitForFunction(()=>cueLab.drag?.type==='ball');await expect(page.locator('#cancelGesture')).toBeVisible();expect(await page.locator('#scene').boundingBox()).toEqual(canvasBeforeDrag);await page.mouse.move(destination.x,destination.y,{steps:15});await page.mouse.up();
 const moved=await page.evaluate(()=>({...cueLab.lab.get(1).body.translation()}));expect(moved.x).toBeCloseTo(initial.x+.15,2);expect(moved.z).toBeCloseTo(initial.z-.18,2);expect(await page.evaluate(()=>cueLab.undoStack.length)).toBe(1);
 await openSidebar(page);await page.locator('#undo').click();expect(await page.evaluate(()=>({...cueLab.lab.get(1).body.translation()}))).toEqual(initial);await page.locator('#redo').click();expect(await page.evaluate(()=>({...cueLab.lab.get(1).body.translation()}))).toEqual(moved);
 await closeSidebar(page);const at=await worldPoint(page,moved);await page.mouse.move(at.x,at.y);await page.mouse.down();await page.mouse.move(at.x+15,at.y+20,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();expect(await page.evaluate(()=>({...cueLab.lab.get(1).body.translation()}))).toEqual(moved);
 await expect.poll(()=>page.evaluate(()=>cueLab.inputMetrics.lastInputToFrameMs)).toBeGreaterThan(0);
 const inputMetrics=await page.evaluate(()=>cueLab.inputMetrics);console.log('Real coordinate input to render submission (not presentation):',JSON.stringify(inputMetrics));expect(inputMetrics.events).toBeGreaterThan(10);expect(inputMetrics.maxHandlerMs).toBeLessThan(200);
 expect(errors).toEqual([]);
});

// Deterministic single-search fixture uses the actual physics optimizer, not
// fabricated success objects. Worker-count performance is tested separately.
test('all three physically verified baseline candidates are accessible, not a top-two subset',async({page})=>{
 const errors=await boot(page);await tab(page,'경로 탐색').click();
 const count=await page.evaluate(()=>{
  const req={snapshot:cueLab.lab.snapshot({trails:false}),selectedId:1,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0},options:{mode:'three',methods:['any'],order:'either',targetId:2,secondId:3,budget:48,horizon:16,spin:true,objective:'shortest',allowKiss:true,inputStrategy:'hybrid'}};
  const search=LabOptimizer.createSearch(RAPIER,req);try{while(!LabOptimizer.advanceSearch(search,960));const result=LabOptimizer.finishSearch(search);cueLab.routeStamp=cueLab.worldStamp();cueLab.state.routeResult=result;cueLab.state.routeStatus='done';cueLab.notify();return result.results.length;}finally{LabOptimizer.disposeSearch(search);}
 });
 expect(count).toBeGreaterThanOrEqual(3);
 while(await page.locator('#moreRoutes').count())await page.locator('#moreRoutes').click();
 await expect(page.locator('.route-result')).toHaveCount(count);await expect(page.locator('#routePageCount')).toHaveText(`${count}개 중 ${count}개 표시`);
 const ids=await page.evaluate(()=>cueLab.state.routeResult.results.map(r=>r.id));for(const id of ids){const button=page.locator('#applyRoute'+id);await button.scrollIntoViewIfNeeded();await expect(button).toBeVisible();}
 await tab(page,'수동').click();await tab(page,'경로 탐색').click();await expect(page.locator('.route-result')).toHaveCount(count);
 expect(await page.evaluate(()=>cueLab.lab.shots)).toBe(0);expect(errors).toEqual([]);
});
