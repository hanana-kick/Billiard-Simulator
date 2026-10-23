const {test,expect}=require('@playwright/test');
const fs=require('node:fs');

// Generic CSS viewport sizes, not model-specific device/DPR claims. Touch support
// explicitly exercises coarse-pointer layout at every responsive boundary.
const viewports=[[320,568],[360,780],[384,832],[412,891],[720,680],[768,900],[820,900],[1024,900],[840,650],[900,840],[844,390],[390,844]];
function contained(inner,outer,label){
 expect(inner.width,label+' width').toBeGreaterThan(0);
 expect(inner.height,label+' height').toBeGreaterThan(0);
 expect(inner.x,label+' left').toBeGreaterThanOrEqual(outer.x-1);
 expect(inner.y,label+' top').toBeGreaterThanOrEqual(outer.y-1);
 expect(inner.x+inner.width,label+' right').toBeLessThanOrEqual(outer.x+outer.width+1);
 expect(inner.y+inner.height,label+' bottom').toBeLessThanOrEqual(outer.y+outer.height+1);
}
async function disjointControls(page,selector,label){
 const boxes=await page.locator(selector).evaluateAll(els=>els.filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>{
  const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,name:e.id||e.getAttribute('aria-label')||e.textContent};
 }));
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const a=boxes[i],b=boxes[j];
  // Allow a shared 1px border in segmented controls; never compare ancestor/child rectangles.
  expect(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1,`${label}: ${a.name} overlaps ${b.name}`).toBe(true);
 }
}
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
async function chromeBounds(page,width,height,sidebarOpen){
 const viewport={x:0,y:0,width,height};
 const regions=sidebarOpen?['.toolbox-heading','#panelGroup','#panelScroll','.sidebar-playback']:['.workspace-header','#scene','.stage-toolbar','.scene-tools'];
 for(const selector of regions)contained(await page.locator(selector).boundingBox(),viewport,selector);
 const selectors=sidebarOpen?['.toolbox-heading button','#panelGroup [role=tab]','.sidebar-playback button']:['.workspace-header button','.stage-toolbar button','.scene-tools button','.scene-tools [role=switch]'];
 for(const selector of selectors){
  for(const el of await page.locator(selector+':visible').all()){
   contained(await el.boundingBox(),viewport,await el.getAttribute('aria-label')||selector);
   if(!await el.isDisabled())expect(await el.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&(hit===e||e.contains(hit));}),selector+' unobscured hit target').toBe(true);
  }
  await disjointControls(page,selector,'visible controls');
 }
 for(const selector of sidebarOpen?['.sidebar-playback .hit-target']:['.workspace-header .hit-target','.stage-toolbar .hit-target']){
  await disjointControls(page,selector,'reserved hit regions');
  for(const region of await page.locator(selector+':visible').all()){
   const box=await region.boundingBox();contained(box,viewport,'hit region');
   expect(box.width,'wrapper touch width, not component styling').toBeGreaterThanOrEqual(44);
   expect(box.height,'wrapper touch height, not component styling').toBeGreaterThanOrEqual(44);
  }
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 if(!sidebarOpen)expect((await page.locator('#scene').boundingBox()).height).toBeGreaterThanOrEqual(60);
}
async function expandGameSetup(page){
 const trigger=page.locator('#gameSetup [data-slot=accordion-trigger]');
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
 await expect(page.locator('#gameMode')).toBeVisible();
}
async function reachable(page,selector){
 if(selector==='#gameMode')await expandGameSetup(page);
 const el=page.locator(selector);await page.locator('#panelScroll').evaluate(async e=>{await Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})))});await el.scrollIntoViewIfNeeded();await expect(el).toBeVisible();
 const box=await el.boundingBox(),scroll=await page.locator('#panelScroll').boundingBox();
 contained(box,scroll,selector+' inside inspector scrollport');
 // Visibility alone does not catch another control painted on top of this one.
 if(!await el.isDisabled())await expect.poll(()=>el.evaluate(e=>{
  const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  return {reachable:!!hit&&(e===hit||e.contains(hit)),interceptor:hit?.id||hit?.getAttribute('data-slot')||hit?.tagName||null};
 }),{message:selector+' unobscured center after layout/accordion transitions'}).toMatchObject({reachable:true});
}
async function handlesWithinTable(page){
 await expect(page.locator('.cue-handle:visible')).toHaveCount(2);
 await expect.poll(async()=>{
  const table=await page.locator('#scene').boundingBox();
  const handles=await page.locator('.cue-handle:visible').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));
  return handles.every(r=>r.x>=table.x-1&&r.y>=table.y-1&&r.x+r.width<=table.x+table.width+1&&r.y+r.height<=table.y+table.height+1);
 },{message:'both cue handles stay within the canvas after layout changes'}).toBe(true);
 await disjointControls(page,'.cue-handle:visible','cue handles');
}
async function preserved(page){
 expect(await page.evaluate(()=>({sameWorld:cueLab.lab===savedWorld,sameCanvas:document.getElementById('scene')===savedCanvas,angle:cueLab.state.settings.angle,shots:cueLab.lab.shots,positions:cueLab.lab.objects.map(o=>({...o.body.translation()}))}))).toEqual(await page.evaluate(()=>savedSnapshot));
}

for(const [width,height]of viewports)test(`coarse-pointer ${width}x${height}: every tab, sidebar reachability and resize recovery`,async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'});
 try{
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  if(process.env.LOCAL_HTML)await page.setContent(fs.readFileSync(process.env.LOCAL_HTML,'utf8'));else await page.goto('./');
  await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
  await page.evaluate(()=>{cueLab.option('predict',false);cueLab.changeSettings({angle:17.23});globalThis.savedWorld=cueLab.lab;globalThis.savedCanvas=document.getElementById('scene');globalThis.savedSnapshot={sameWorld:true,sameCanvas:true,angle:17.23,shots:cueLab.lab.shots,positions:cueLab.lab.objects.map(o=>({...o.body.translation()}))};});
  expect(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches)).toBe(true);
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  
  await page.setViewportSize({width,height});await closeSidebar(page);
  await chromeBounds(page,width,height,false);await handlesWithinTable(page);await openSidebar(page);
  for(const [tab,panel,controls]of [
   ['타격','shotPanel',['#gameMode','#tipDisc','#elevationNumber','#cueSpeed','#angle']],
   ['경로','routesPanel',['#routeTarget','#findRoute','#routeAdvanced [data-slot=accordion-trigger]']],
   ['설정','settingsPanel',['#horizon','#speed','#placementObject','#height','#p-spinLength']]
  ]){
   await page.getByRole('tab',{name:tab,exact:true}).click();
   await expect(page.locator('[role=tabpanel]:visible')).toHaveCount(1);await expect(page.locator('#'+panel)).toBeVisible();
   await chromeBounds(page,width,height,true);
   for(const selector of controls)await reachable(page,selector);
   for(const group of await page.locator(`#${panel} .angle-nudges, #${panel} .action-row, #${panel} .option-group, #${panel} .coordinates, #${panel} .tip-section`).all()){
    // Compare only meaningful sibling fields/buttons/data, not unrelated card wrappers.
    await group.scrollIntoViewIfNeeded();
    const id=await group.evaluate(el=>{el.dataset.overlapProbe='active';return '[data-overlap-probe="active"] > *';});
    await disjointControls(page,id,tab+' sibling controls');await group.evaluate(el=>delete el.dataset.overlapProbe);
   }
   if(panel==='routesPanel'){
    await page.locator('#routeAdvanced [data-slot=accordion-trigger]').click();
    for(const selector of ['#routeOrder','#routeWorkers','#routemaxSpeed'])await reachable(page,selector);
    await page.locator('#routeAdvanced [data-slot=accordion-trigger]').click();
   }
   if(panel==='settingsPanel'){
    await reachable(page,'#speed');await page.locator('#speed').click();
    const option=page.getByRole('option',{name:'1×',exact:true});await option.scrollIntoViewIfNeeded();
    contained(await option.boundingBox(),{x:0,y:0,width,height},'select option');await option.click();
   }
   for(const selector of ['#undo','#reset','.panel-utility button[aria-label="조작 도움말"]'])await reachable(page,selector);
   await disjointControls(page,'.panel-utility button','utility controls');
   await preserved(page);
  }
  await page.getByRole('tab',{name:'타격',exact:true}).click();
  await expect(page.locator('#gameSetup [data-slot=accordion-trigger]')).toHaveAttribute('aria-expanded','true');await expect(page.locator('#gameMode')).toBeVisible();
  fs.mkdirSync('test-results/renewal',{recursive:true});
  await page.screenshot({path:`test-results/renewal/${width}x${height}-sidebar.png`});
  await closeSidebar(page);await chromeBounds(page,width,height,false);await handlesWithinTable(page);await preserved(page);
  await page.screenshot({path:`test-results/renewal/${width}x${height}-scene.png`});
  // Opening and closing the mobile Sheet or desktop offcanvas cannot reset the table.
  await openSidebar(page);await expect(page.locator('#angle')).toHaveValue('17.23');await expect(page.locator('#gameSetup [data-slot=accordion-trigger]')).toHaveAttribute('aria-expanded','true');await preserved(page);
  await closeSidebar(page);await handlesWithinTable(page);
  // Resize back across the mobile/desktop breakpoint and repeat the access cycle.
  await page.setViewportSize({width:390,height:844});await closeSidebar(page);
  await chromeBounds(page,390,844,false);await handlesWithinTable(page);await preserved(page);
  await openSidebar(page);await chromeBounds(page,390,844,true);await preserved(page);await closeSidebar(page);
  expect(errors).toEqual([]);
 }finally{await context.close();}
});

async function readableControl(locator,label){
 await expect(locator).toBeVisible();
 const clipping=await locator.evaluate(el=>{
  const bounds=el.getBoundingClientRect(),walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  const clipped=[];let node;
  while((node=walker.nextNode())){
   if(!node.textContent.trim())continue;
   const parent=node.parentElement,style=getComputedStyle(parent);
   if(!parent.getClientRects().length||style.visibility==='hidden'||parent.closest('.sr-only'))continue;
   const range=document.createRange();range.selectNodeContents(node);
   for(const r of range.getClientRects())if(r.left<bounds.left-1||r.right>bounds.right+1||r.top<bounds.top-1||r.bottom>bounds.bottom+1)clipped.push(node.textContent.trim());
  }
  // Scroll extents include the official Tabs underline pseudo-element. Text ranges above test actual clipping.
  const ownStyle=getComputedStyle(el);return {horizontalOverflow:['hidden','clip'].includes(ownStyle.overflowX)&&el.scrollWidth>el.clientWidth+1,verticalOverflow:['hidden','clip'].includes(ownStyle.overflowY)&&el.scrollHeight>el.clientHeight+1,clipped};
 });
 expect(clipping,label+' readable without clipped text').toEqual({horizontalOverflow:false,verticalOverflow:false,clipped:[]});
}

for(const width of [768,820,1024])test(`200% root text at ${width}px preserves readable sidebar controls and the world`,async({browser})=>{
 const height=1000,context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});
 try{
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  if(process.env.LOCAL_HTML)await page.setContent(fs.readFileSync(process.env.LOCAL_HTML,'utf8'));else await page.goto('./');
  await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
  await expect(page.locator('#sidebarTrigger')).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#tab-shot')).not.toBeInViewport();
  const baseFont=await page.locator('html').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  await page.evaluate(()=>{cueLab.option('predict',false);cueLab.changeSettings({angle:17.23});globalThis.savedWorld=cueLab.lab;globalThis.savedCanvas=document.getElementById('scene');globalThis.savedSnapshot={sameWorld:true,sameCanvas:true,angle:17.23,shots:cueLab.lab.shots,positions:cueLab.lab.objects.map(o=>({...o.body.translation()}))};document.documentElement.style.fontSize='200%';});
  expect(await page.locator('html').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(baseFont*2,2);
  await chromeBounds(page,width,height,false);await handlesWithinTable(page);
  await openSidebar(page);
  for(const [name,controls]of [
   ['타격',['#fineAim','#tipDisc','#angle','#cueSpeed','#gameMode']],
   ['경로',['#routeTarget','#findRoute','#routeAdvanced [data-slot=accordion-trigger]']],
   ['설정',['#speed','#placementObject','#p-spinLength']]
  ]){
   await page.getByRole('tab',{name,exact:true}).click();await chromeBounds(page,width,height,true);
   for(const tab of await page.locator('#panelGroup [role=tab]').all())await readableControl(tab,'tab');
   for(const selector of controls){await reachable(page,selector);if(await page.locator(selector).evaluate(el=>el.matches('button')))await readableControl(page.locator(selector),selector);}
   for(const selector of ['#undo','#reset']){await reachable(page,selector);await readableControl(page.locator(selector),selector);}
   await disjointControls(page,'.panel-utility button','200% utility actions');
   await preserved(page);
  }
  await closeSidebar(page);await chromeBounds(page,width,height,false);await handlesWithinTable(page);await preserved(page);
  await openSidebar(page);await preserved(page);await closeSidebar(page);
  fs.mkdirSync('test-results/renewal',{recursive:true});await page.screenshot({path:`test-results/renewal/${width}-text-200.png`});
  expect(errors).toEqual([]);
 }finally{await context.close();}
});

async function clickHitRegion(page,button,{padding=true,expectedClicks=1}={}){
 await button.scrollIntoViewIfNeeded();
 await button.evaluate(el=>{document.querySelectorAll('[data-hit-probe]').forEach(e=>e.removeAttribute('data-hit-probe'));el.setAttribute('data-hit-probe','true');globalThis.hitProbeClicks=0;});
 if(padding){
  const region=button.locator('..');await expect(region).toHaveClass(/hit-target/);
  const box=await region.boundingBox(),point={x:box.x+2,y:box.y+2};
  expect(await region.evaluate((el,p)=>document.elementFromPoint(p.x,p.y)===el,point),'padding belongs to this wrapper, not a neighboring control').toBe(true);
  await page.mouse.click(point.x,point.y);
 }else await button.click();
 expect(await page.evaluate(()=>hitProbeClicks),'one activation, no bubbled duplicate').toBe(expectedClicks);
}

for(const viewport of [{width:390,height:844},{width:844,height:650}])test(`reserved touch padding activates controls exactly once at ${viewport.width}px`,async({browser})=>{
 const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:'reduce'});
 try{
  const page=await context.newPage();
  if(process.env.LOCAL_HTML)await page.setContent(fs.readFileSync(process.env.LOCAL_HTML,'utf8'));else await page.goto('./');
  await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
  await page.evaluate(()=>{cueLab.option('predict',false);document.addEventListener('click',e=>{if(e.target.closest?.('[data-hit-probe]'))globalThis.hitProbeClicks++;},true);});
  await closeSidebar(page);
  await clickHitRegion(page,page.locator('#sidebarTrigger'));await expect(page.locator('#sidebarTrigger')).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#tab-shot')).toBeInViewport({ratio:1});
  await page.getByRole('tab',{name:'타격',exact:true}).click();
  await page.evaluate(()=>cueLab.changeSettings({tipX:.12,tipY:.08}));
  await clickHitRegion(page,page.locator('#centerTip'));expect(await page.evaluate(()=>[cueLab.state.settings.tipX,cueLab.state.settings.tipY])).toEqual([0,0]);
  const paused=await page.evaluate(()=>cueLab.state.paused);
  await clickHitRegion(page,page.locator('#pause'));expect(await page.evaluate(()=>cueLab.state.paused)).toBe(!paused);
  await clickHitRegion(page,page.locator('#pause'),{padding:false});expect(await page.evaluate(()=>cueLab.state.paused)).toBe(paused);
  await closeSidebar(page);
  const zoom=await page.evaluate(()=>cueLab.renderer.camera.zoom);
  await clickHitRegion(page,page.getByRole('button',{name:'축소',exact:true}));
  expect(await page.evaluate(()=>cueLab.renderer.camera.zoom)).toBeCloseTo(Math.max(.6,Math.min(2.5,zoom*1.12)),6);
  const zoomOut=await page.evaluate(()=>cueLab.renderer.camera.zoom);
  await clickHitRegion(page,page.getByRole('button',{name:'확대',exact:true}));
  expect(await page.evaluate(()=>cueLab.renderer.camera.zoom)).toBeCloseTo(Math.max(.6,Math.min(2.5,zoomOut/1.12)),6);
  await clickHitRegion(page,page.locator('#fit'));
  await clickHitRegion(page,page.locator('#fullscreen'));await expect(page.locator('#fullscreen')).toHaveAttribute('aria-pressed','true');
  await clickHitRegion(page,page.locator('#fullscreen'),{padding:false});await expect(page.locator('#fullscreen')).toHaveAttribute('aria-pressed','false');
  await openSidebar(page);await expect(page.locator('#strike')).toBeEnabled();
  const shots=await page.evaluate(()=>cueLab.lab.shots);
  await clickHitRegion(page,page.locator('#strike'));await expect.poll(()=>page.evaluate(()=>cueLab.lab.shots)).toBe(shots+1);
 }finally{await context.close();}
});
