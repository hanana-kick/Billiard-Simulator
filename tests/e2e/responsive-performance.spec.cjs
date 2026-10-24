const {test,expect}=require('@playwright/test');
async function ready(page){await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);await page.evaluate(()=>cueLab.option('predict',false));}
async function point(page,which='ball'){return page.evaluate(which=>{const c=cueLab,r=c.canvas.getBoundingClientRect(),o=c.lab.get(c.state.selectedId),p=o.body.translation(),a=c.state.settings.angle*Math.PI/180;const world=which==='ball'?p:which==='rear'?c.cuePoints().grip:{x:p.x+.45*Math.cos(a),y:p.y,z:p.z+.45*Math.sin(a)},q=c.renderer.project(world);return{x:r.left+q.x,y:r.top+q.y};},which)}
async function closeSidebar(page){if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')==='true')await page.locator('.toolbox-heading').getByRole('button',{name:'설정 패널 닫기',exact:true}).click();await expect(page.locator('#tab-shot')).not.toBeInViewport();}

test('fold-size and landscape transitions preserve committed world and cancel incomplete placement',async({page})=>{
 await ready(page);await closeSidebar(page);await page.evaluate(()=>{cueLab.changeSettings({angle:17.23,elevation:13.25});globalThis.__responsiveSaved={lab:cueLab.lab,canvas:cueLab.canvas,settings:{...cueLab.state.settings},positions:cueLab.lab.objects.map(o=>({...o.body.translation()})),camera:structuredClone(cueLab.renderer.camera)};});
 for(const size of [{width:344,height:882},{width:768,height:960},{width:844,height:390},{width:320,height:568},{width:1440,height:900}]){
  await page.setViewportSize(size);await expect.poll(()=>page.evaluate(()=>cueLab.viewportBounds.width===cueLab.canvas.getBoundingClientRect().width)).toBe(true);
  expect(await page.evaluate(()=>({sameWorld:cueLab.lab===__responsiveSaved.lab,sameCanvas:cueLab.canvas===__responsiveSaved.canvas,settings:cueLab.state.settings,positions:cueLab.lab.objects.map(o=>({...o.body.translation()})),camera:cueLab.renderer.camera,overflow:document.documentElement.scrollWidth>innerWidth+1}))).toEqual(await page.evaluate(()=>({sameWorld:true,sameCanvas:true,settings:__responsiveSaved.settings,positions:__responsiveSaved.positions,camera:__responsiveSaved.camera,overflow:false})));
  await expect(page.locator('#strike')).toBeInViewport();await expect(page.locator('#fullscreen,#aimHandle,#gripHandle,.pull-meter')).toHaveCount(0);
 }
 const start=await point(page);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+24,start.y-18,{steps:6});await page.waitForFunction(()=>cueLab.drag?.changed);
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>!cueLab.drag);await page.mouse.up();expect(await page.evaluate(()=>cueLab.lab.objects.map(o=>({...o.body.translation()})))).toEqual(await page.evaluate(()=>__responsiveSaved.positions));expect(await page.evaluate(()=>cueLab.undoStack.length)).toBe(0);
});

test('real pointer input timing is reported only after a matching canvas frame',async({page})=>{
 await ready(page);await closeSidebar(page);await page.locator('#viewGroup button').filter({hasText:'상단'}).click();
 const start=await point(page),before=await page.evaluate(()=>cueLab.inputMetrics.presented);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+30,start.y-20,{steps:12});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>cueLab.inputMetrics.presented)).toBeGreaterThan(before);
 const m=await page.evaluate(()=>({input:cueLab.inputMetrics,render:cueLab.renderMetrics,mode:cueLab.snapshot().renderMode}));expect(m.input.lastInputToCanvasMs).toBeGreaterThan(0);expect(m.input.presented).toBeLessThanOrEqual(m.input.events);expect(m.input.lastInputToFrameMs).toBe(m.input.lastInputToCanvasMs);expect(m.render.presentations).toBeGreaterThan(0);expect([30,60]).toContain(m.render.cap);console.log('Actual browser input-to-canvas timing; not physical display latency:',JSON.stringify(m));
});

for(const target of ['line','rear'])test(`${target} pointer cancellation restores fine settings and does not fire`,async({page})=>{
 await ready(page);await closeSidebar(page);await page.evaluate(()=>cueLab.view('top'));const settings=await page.evaluate(()=>({...cueLab.state.settings})),start=await point(page,target);
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+20,start.y+25,{steps:6});await page.waitForFunction(()=>!!cueLab.drag);
 await page.evaluate(()=>cueLab.canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:cueLab.drag.pointer,bubbles:true})));await page.mouse.up();
 expect(await page.evaluate(()=>cueLab.state.settings)).toEqual(settings);expect(await page.evaluate(()=>({drag:cueLab.drag,shots:cueLab.lab.shots}))).toEqual({drag:null,shots:0});
});
