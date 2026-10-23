const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
test('neutral UI and fold-style resizing preserve the live world and readable controls',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:2});const page=await context.newPage();
 await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__);await page.evaluate(()=>{cueLab.option('predict',false);cueLab.changeSettings({angle:17.23});globalThis.savedWorld=cueLab.lab;});
 await expect(page.locator('html')).not.toHaveClass(/dark/);expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('oklch(1 0 0)');
 fs.mkdirSync('test-results/renewal',{recursive:true});
 // Generic CSS viewport sweeps, NOT claims about model-specific CSS pixels/DPR.
 for(const [width,height]of [[320,568],[360,780],[384,832],[412,891],[720,680],[840,650],[900,840],[844,390],[390,844]]){
  await page.setViewportSize({width,height});await page.getByRole('tab',{name:'타격',exact:true}).click();
  expect(await page.evaluate(()=>cueLab.lab===savedWorld&&cueLab.state.settings.angle===17.23)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const table=await page.locator('#scene').boundingBox(),panel=await page.locator('#toolbox').boundingBox();expect(table.height).toBeGreaterThanOrEqual(60);expect(table.width).toBeGreaterThan(100);expect(table.y+table.height).toBeLessThanOrEqual(height+1);expect(panel.y+panel.height).toBeLessThanOrEqual(height+1);
  for(const id of ['#strike','#tab-shot','#gameMode']){const el=page.locator(id);await el.scrollIntoViewIfNeeded();const b=await el.boundingBox();expect(b.height,id+' touch height').toBeGreaterThanOrEqual(44);}
  const handles=await page.locator('.cue-handle:visible').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}}));
  if(handles.length===2){const[a,b]=handles;expect(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y).toBe(true);}
  if(width<640&&height>500){const before=await page.locator('#panelScroll').boundingBox();await page.locator('#togglePreview').click();const after=await page.locator('#panelScroll').boundingBox();expect(after.height).toBeGreaterThan(before.height+150);await page.locator('#cueSpeed').scrollIntoViewIfNeeded();await expect(page.locator('#cueSpeed')).toBeVisible();await page.locator('#togglePreview').click();expect(await page.evaluate(()=>cueLab.lab===savedWorld)).toBe(true);}
  await page.screenshot({path:`test-results/renewal/${width}x${height}.png`});
 }
 await context.close();
});
