const {test,expect}=require('@playwright/test');
const fs=require('node:fs');

// Generic CSS viewport sizes, not model-specific device/DPR claims. Touch support
// explicitly exercises coarse-pointer layout at every responsive boundary.
const viewports=[[320,568],[360,780],[384,832],[412,891],[720,680],[840,650],[900,840],[844,390],[390,844]];
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
async function openSidebar(page){
 if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
 await expect(page.locator('#tab-shot')).toBeInViewport({ratio:1});
}
async function closeSidebar(page){
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
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 if(!sidebarOpen)expect((await page.locator('#scene').boundingBox()).height).toBeGreaterThanOrEqual(60);
}
async function reachable(page,selector){
 const el=page.locator(selector);await el.scrollIntoViewIfNeeded();await expect(el).toBeVisible();
 const box=await el.boundingBox(),scroll=await page.locator('#panelScroll').boundingBox();
 contained(box,scroll,selector+' inside inspector scrollport');
 // Visibility alone does not catch another control painted on top of this one.
 expect(await el.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&(e===hit||e.contains(hit));}),selector+' hit-test').toBe(true);
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
   await preserved(page);
  }
  await page.getByRole('tab',{name:'타격',exact:true}).click();
  fs.mkdirSync('test-results/renewal',{recursive:true});
  await page.screenshot({path:`test-results/renewal/${width}x${height}-sidebar.png`});
  await closeSidebar(page);await chromeBounds(page,width,height,false);await handlesWithinTable(page);await preserved(page);
  await page.screenshot({path:`test-results/renewal/${width}x${height}-scene.png`});
  // Opening and closing the mobile Sheet or desktop offcanvas cannot reset the table.
  await openSidebar(page);await expect(page.locator('#angle')).toHaveValue('17.23');await preserved(page);
  await closeSidebar(page);await handlesWithinTable(page);
  // Resize back across the mobile/desktop breakpoint and repeat the access cycle.
  await page.setViewportSize({width:390,height:844});await closeSidebar(page);
  await chromeBounds(page,390,844,false);await handlesWithinTable(page);await preserved(page);
  await openSidebar(page);await chromeBounds(page,390,844,true);await preserved(page);await closeSidebar(page);
  expect(errors).toEqual([]);
 }finally{await context.close();}
});
