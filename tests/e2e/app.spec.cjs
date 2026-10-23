const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const tab=(page,name)=>page.getByRole('tab',{name,exact:true});
async function boot(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
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
 for(const id of ['horizon','speed','showCue','paths','wire','vectors','step','clearTrails','placement','posX','posZ','posY','height','addBall','addBox','remove','materials','contacts']){
  const el=page.locator('#'+id);await el.scrollIntoViewIfNeeded();await expect(el).toBeVisible();
 }
 for(const [id,key]of [['showCue','showCue'],['paths','paths'],['wire','debug'],['vectors','vectors']]){
  const before=await page.evaluate(key=>cueLab.state[key],key);await page.locator('#'+id).click();expect(await page.evaluate(key=>cueLab.state[key],key)).toBe(!before);await page.locator('#'+id).click();
 }
 await settleInput(page,'posX','-60');expect(await page.evaluate(()=>cueLab.lab.get(cueLab.state.selectedId).body.translation().x)).toBeCloseTo(-.6,4);
 await settleInput(page,'posY','10');expect(await page.evaluate(()=>cueLab.lab.get(cueLab.state.selectedId).body.translation().y)).toBeGreaterThan(.12);await page.locator('#putOnTable').click();
 const count=await page.evaluate(()=>cueLab.lab.objects.length);await page.locator('#addBall').click();expect(await page.evaluate(()=>cueLab.lab.objects.length)).toBe(count+1);await page.locator('#remove').click();await page.locator('#addBox').click();expect(await page.evaluate(()=>cueLab.lab.get(cueLab.state.selectedId).shape)).toBe('box');await page.locator('#remove').click();
 for(const key of ['clothFriction','cushionRestitution','cushionFriction','ballRestitution','ballFriction','tipFriction','gravity','rollingLength','spinLength']){
  const before=await page.evaluate(key=>cueLab.lab.params[key],key);const slider=page.locator('#p-'+key+' input[type=range]');await slider.scrollIntoViewIfNeeded();await slider.focus();await slider.press('ArrowRight');expect(await page.evaluate(key=>cueLab.lab.params[key],key)).not.toBe(before);
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
 await page.locator('#fineAim').tap();expect(await page.evaluate(()=>cueLab.state.fineAim)).toBe(true);expect(errors).toEqual([]);await context.close();
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
 const external=[];page.on('request',r=>{const url=r.url();if(/^https?:/.test(url)&&!url.startsWith('http://127.0.0.1:8787'))external.push(url);});
 await boot(page);await tab(page,'전체 설정').click();await select(page,'horizon','8초');expect(external).toEqual([]);
});
