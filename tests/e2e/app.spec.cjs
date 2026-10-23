const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const tab=(page,name)=>page.getByRole('tab',{name,exact:true});
async function boot(page){
 page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.LOCAL_HTML)await page.setContent(fs.readFileSync(process.env.LOCAL_HTML,'utf8'));else await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
 await page.evaluate(()=>cueLab.option('predict',false));
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
 await tab(page,'경로').click();await assertOnePanel(page,'routesPanel');
 await tab(page,'전체 설정').click();await assertOnePanel(page,'settingsPanel');
 await select(page,'horizon','16초');await select(page,'speed','0.5×');
 await tab(page,'타격').click();await expect(page.locator('#angle')).toHaveValue('17.23');
 expect(await page.evaluate(()=>({sameWorld:cueLab.lab===savedLab,sameCanvas:document.getElementById('scene')===savedCanvas,positions:cueLab.lab.objects.map(o=>({...o.body.translation()})),horizon:cueLab.state.horizon,rate:cueLab.state.rate}))).toEqual({sameWorld:true,sameCanvas:true,positions,horizon:16,rate:.5});
 await tab(page,'타격').focus();await page.keyboard.press('ArrowRight');
 await expect(tab(page,'경로')).toHaveAttribute('aria-selected','true');
 await assertOnePanel(page,'routesPanel');expect(errors).toEqual([]);
});

test('all settings work through actual Base UI controls',async({page})=>{
 const errors=await boot(page);await tab(page,'전체 설정').click();
 for(const id of ['horizon','speed','step','clearTrails','placement','posX','posZ','posY','height','addBall','addBox','remove','materials','contacts']){
  const el=page.locator('#'+id);await el.scrollIntoViewIfNeeded();await expect(el).toBeVisible();
 }
 for(const [id,key]of [['조준 큐 표시','showCue'],['실제 이동 궤적','paths'],['충돌 형상','debug'],['속도 벡터','vectors']]){
  const before=await page.evaluate(key=>cueLab.state[key],key);await page.getByRole('switch',{name:id,exact:true}).click();expect(await page.evaluate(key=>cueLab.state[key],key)).toBe(!before);await page.getByRole('switch',{name:id,exact:true}).click();
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
  await page.setViewportSize({width,height});await tab(page,'전체 설정').click();
  await page.locator('#p-spinLength').scrollIntoViewIfNeeded();
  const sizes=await page.evaluate(()=>{const table=document.getElementById('scene').getBoundingClientRect(),tabs=document.getElementById('panelGroup').getBoundingClientRect(),s=document.querySelector('#p-spinLength').getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth+1,tableVisible:table.top>=0&&table.bottom<=innerHeight,tableHeight:table.height,tabsVisible:tabs.top>=0&&tabs.bottom<=innerHeight,sliderReachable:s.top>=0&&s.bottom<=innerHeight}});
  expect(sizes.overflow).toBe(false);expect(sizes.tableVisible).toBe(true);expect(sizes.tableHeight).toBeGreaterThan(60);expect(sizes.tabsVisible).toBe(true);expect(sizes.sliderReachable).toBe(true);
  await tab(page,'타격').click();await assertOnePanel(page,'shotPanel');
  await page.screenshot({path:`test-results/screenshots/${width}x${height}.png`});
 }
 expect(errors).toEqual([]);
});

test('touch navigation, fine aim and pinch cancellation work without firing',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const page=await context.newPage();const errors=await boot(page);
 await tab(page,'전체 설정').tap();await assertOnePanel(page,'settingsPanel');await tab(page,'경로').tap();await assertOnePanel(page,'routesPanel');await tab(page,'타격').tap();
 const before=await page.evaluate(()=>cueLab.state.settings.angle);const r=await page.locator('#aimPad').boundingBox(),cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+60,y:r.y+r.height/2,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+110,y:r.y+r.height/2,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 expect(await page.evaluate(()=>cueLab.state.settings.angle)).not.toBe(before);expect(await page.evaluate(()=>cueLab.lab.shots)).toBe(0);
 await page.getByRole('switch',{name:'미세',exact:true}).tap();expect(await page.evaluate(()=>cueLab.state.fineAim)).toBe(true);
 const fineBefore=await page.evaluate(()=>cueLab.state.settings.angle),x=r.x+60,y=r.y+r.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+30,y,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 expect(await page.evaluate(()=>cueLab.state.settings.angle)-fineBefore).toBeCloseTo(.3,2);
 await page.locator('#angle').fill('0');await page.locator('#angle').press('Enter');
 await expect(page.locator('#gripHandle')).toBeVisible();
 const grip=await page.locator('#gripHandle').boundingBox(),gx=grip.x+grip.width/2,gy=grip.y+grip.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:gx,y:gy,id:1}]});
 await page.waitForFunction(()=>cueLab.drag?.type==='stroke');
 const axis=await page.evaluate(()=>cueLab.drag.axis);
 const px=gx-axis.x*12,py=gy-axis.y*12;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:px,y:py,id:1}]});
 await page.waitForFunction(()=>cueLab.state.cuePull>.015);
 const view=await page.locator('#viewport').boundingBox(),tx=view.x+view.width*.8,ty=view.y+view.height*.5;
 const zoom=await page.evaluate(()=>cueLab.renderer.camera.zoom);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:px,y:py,id:1},{x:tx,y:ty,id:2}]});
 await page.waitForFunction(()=>!!cueLab.pinch&&cueLab.state.cuePull===0);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:px,y:py,id:1},{x:tx+20,y:ty,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 expect(await page.evaluate(()=>cueLab.renderer.camera.zoom)).not.toBe(zoom);
 expect(await page.evaluate(()=>cueLab.lab.shots)).toBe(0);
 expect(await page.evaluate(()=>!!cueLab.windup||!!cueLab.drag)).toBe(false);expect(errors).toEqual([]);await context.close();
});

test('three-cushion search yields a real candidate, applies and preserves it across tabs',async({page})=>{
 const errors=await boot(page);await tab(page,'경로').click();await page.locator('#routeMode button').filter({hasText:'3쿠션'}).click();
 await page.locator('#findRoute').click();
 await page.waitForFunction(()=>cueLab.state.routeResult?.results.length>0||cueLab.state.routeStatus==='error',{},{timeout:150000});
 expect(await page.evaluate(()=>cueLab.state.routeStatus)).not.toBe('error');
 await page.locator('.route-result button').first().click();
 expect(await page.evaluate(()=>cueLab.lab.shots)).toBe(0);const setting=await page.evaluate(()=>({...cueLab.state.settings}));
 await tab(page,'전체 설정').click();await tab(page,'타격').click();expect(await page.evaluate(()=>({...cueLab.state.settings}))).toEqual(setting);
 await page.locator('#strike').click();await page.waitForFunction(()=>cueLab.lab.time>.5);expect(await page.evaluate(()=>cueLab.state.previewCueVisible)).toBe(false);expect(await page.evaluate(()=>cueLab.lab.shots)).toBe(1);expect(errors).toEqual([]);
});

test('bundled build has no runtime dependency on external CDNs',async({page})=>{
 const external=[];page.on('request',r=>{const url=r.url();if(/^https?:/.test(url)&&new URL(url).origin!==new URL(process.env.APP_URL||'http://127.0.0.1:8787').origin)external.push(url);});
 await boot(page);await tab(page,'전체 설정').click();await select(page,'horizon','8초');expect(external).toEqual([]);
});

test('full-screen keeps settings popovers in the rendered document',async({page})=>{
 const errors=await boot(page);await page.locator('#fullscreen').click();
 await page.waitForFunction(()=>document.fullscreenElement===document.documentElement||document.querySelector('.app-shell').dataset.fullWindow==='true');
 await page.getByRole('tab',{name:'전체 설정',exact:true}).click();await page.locator('#speed').click();
 await expect(page.getByRole('option',{name:'2×',exact:true})).toBeVisible();await page.getByRole('option',{name:'2×',exact:true}).click();
 expect(await page.evaluate(()=>cueLab.state.rate)).toBe(2);await page.locator('#fullscreen').click();
 await page.waitForFunction(()=>!document.fullscreenElement&&document.querySelector('.app-shell').dataset.fullWindow!=='true');expect(errors).toEqual([]);
});
