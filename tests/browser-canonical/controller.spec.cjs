const {test,expect}=require('@playwright/test');
const {createHash}=require('node:crypto');
const {waitForPretendard}=require('../e2e/font-helper.cjs');

// Required real-browser smoke. No authored scene injection, fake GPU, selected-shot
// candidate loop, CPU dynamics oracle, or native fallback replaces the UI flow.
test('real GPU entry dialog searches nine candidates, applies one and commits exact undo/redo',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
 await page.evaluate(()=>cueLab.option('predict',false));
 const manifestResponse=await page.request.get('./canonical-controller-assets/manifest.json');
 expect(manifestResponse.ok(),'Build with --canonical-controller-assets before this explicit qualification').toBe(true);
 const manifest=await manifestResponse.json();expect(manifest.activation).toBe(false);expect(manifest.searchSourceSealed).toBe(true);
 expect(manifest.sharedSourceBytesVerified).toBe(true);
 const bundleResponse=await page.request.get('./canonical-controller-assets/canonical-controller.mjs');expect(bundleResponse.ok()).toBe(true);
 expect(createHash('sha256').update(await bundleResponse.body()).digest('hex')).toBe(manifest.sha256);
 await testInfo.attach('canonical-assets-manifest',{body:JSON.stringify(manifest,null,2),contentType:'application/json'});
 try {
  await page.evaluate(()=>{
   const c=cueLab,legacy=c.lab;
   if(!c.state.paused||legacy.cue||legacy.anyMotion()||c.drag||c.windup||c.game?.pending||c.undoStack.length||c.redoStack.length)
    throw Error('Real default app must be idle, paused and empty-history before entry');
   const evidence=globalThis.__canonicalBrowserTest={adapterRequests:0,deviceRequests:0,adapters:[],gpuErrors:[],deviceLoss:[],legacyCalls:[],canvas:c.canvas,initialLab:legacy};
   // Observe REAL calls and retain original native methods. No adapter/device is substituted.
   if(navigator.gpu){const requestAdapter=navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter=async(...args)=>{evidence.adapterRequests++;const adapter=await requestAdapter(...args);if(!adapter)return adapter;
     const info=adapter.info;evidence.adapters.push(info?{vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description}:null);
     const requestDevice=adapter.requestDevice.bind(adapter);adapter.requestDevice=async(...options)=>{evidence.deviceRequests++;const device=await requestDevice(...options);
      device.addEventListener('uncapturederror',event=>evidence.gpuErrors.push(event.error.message));device.lost.then(info=>evidence.deviceLoss.push({reason:info.reason,message:info.message}));return device;};return adapter;};}
   for(const method of ['strike','step','restore'])legacy[method]=()=>{evidence.legacyCalls.push(method);throw Error('Forbidden legacy dynamics: '+method);};
  });
  const entry=page.locator('#startCanonicalPractice');await expect(entry).toBeVisible();await expect(entry).toBeEnabled();
  await entry.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('현재 배치와 점수를 새 4구 연습 배치로 교체');
  await expect(dialog).toContainText('9개 타격 조합');await expect(dialog).toContainText('쿠션 충돌은 미지원');
  await page.locator('#cancelCanonicalPractice').click();await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(()=>({requests:__canonicalBrowserTest.adapterRequests,active:!!cueLab.canonicalPlayback,sameLab:cueLab.lab===__canonicalBrowserTest.initialLab})))
   .toEqual({requests:0,active:false,sameLab:true});
  await entry.click();await page.locator('#confirmCanonicalPractice').click();
  await page.waitForFunction(()=>!!cueLab.canonicalPlayback||!!document.querySelector('#canonicalPracticeError'),{},{timeout:30000});
  const activation=await page.evaluate(()=>({active:!!cueLab.canonicalPlayback,error:document.querySelector('#canonicalPracticeError')?.textContent,
   implementation:cueLab.canonicalPlayback?.implementation,profile:cueLab.state.canonicalPlayback?.selectedWorldProfile,
   presentationOnly:cueLab.lab.presentationOnly,searchEnabled:cueLab.state.canonicalPlayback?.searchEnabled,total:cueLab.state.canonicalPlayback?.searchDomain?.total}));
  expect(activation.active,activation.error||'Real browser GPU is required; no fallback').toBe(true);
  expect(activation).toMatchObject({implementation:'webgpu-selected-controller',profile:'mmq1-ball-ball',presentationOnly:true,searchEnabled:true,total:9});
  await expect(dialog).not.toBeVisible();
  await page.evaluate(()=>{__canonicalBrowserTest.initialGame=cueLab.game.snapshot();});
  if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
  // Author through the real existing Manual coordinate control; restore the preset
  // before the known nine-candidate flow. No fixture/store writes or CPU physics.
  await page.getByRole('tab',{name:'수동',exact:true}).click();
  await expect(page.locator('#canonicalPlacementScope')).toContainText('Q24');
  const initialPositions=await page.evaluate(()=>cueLab.state.objects.map(({id,pos})=>({id,pos})));
  const selected=await page.evaluate(()=>cueLab.state.selectedId);
  await page.locator('#posX').fill('-60');await page.locator('#posX').press('Enter');
  const expectedX=Math.round(-.6*16777216)/16777216;
  await expect.poll(()=>page.evaluate(id=>cueLab.state.objects.find(o=>o.id===id).pos.x,selected)).toBe(expectedX);
  const editedPositions=await page.evaluate(()=>cueLab.state.objects.map(({id,pos})=>({id,pos})));
  expect(editedPositions).not.toEqual(initialPositions);
  await page.locator('#undo').click();expect(await page.evaluate(()=>cueLab.state.objects.map(({id,pos})=>({id,pos})))).toEqual(initialPositions);
  await page.locator('#redo').click();expect(await page.evaluate(()=>cueLab.state.objects.map(({id,pos})=>({id,pos})))).toEqual(editedPositions);
  await page.locator('#undo').click();expect(await page.evaluate(()=>cueLab.state.objects.map(({id,pos})=>({id,pos})))).toEqual(initialPositions);
  expect(await page.evaluate(()=>cueLab.game.snapshot())).toEqual(await page.evaluate(()=>__canonicalBrowserTest.initialGame));
  await page.getByRole('tab',{name:'경로 탐색',exact:true}).click();
  await expect(page.locator('#canonicalSearchScope')).toBeVisible();await page.locator('#findRoute').click();
  await page.waitForFunction(()=>['done','error','stale'].includes(cueLab.state.routeStatus),{},{timeout:300000});
  const search=await page.evaluate(()=>({status:cueLab.state.routeStatus,error:cueLab.state.routeError,result:cueLab.state.routeResult}));
  expect(search.status,search.error).toBe('done');expect(search.result.kind).toBe('canonical-compact-search-v1');
  expect(search.result.total).toBe(9);expect(search.result.tested).toBe(9);expect(search.result.results.length).toBeGreaterThan(0);
  const chosen=search.result.results[0];expect(chosen.compact).toEqual([chosen.id,1,0,1]);
  expect(await page.locator('.route-result').count()).toBeGreaterThan(0);
  await page.locator('#applyRoute'+chosen.id).click();
  expect(await page.evaluate(()=>({settings:cueLab.state.settings,applied:cueLab.state.routeApplied}))).toEqual({settings:chosen.settings,applied:chosen.id});
  // Execute with the real retained button. A selected preview is not the scored shot.
  if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')==='true')
   await page.locator('.toolbox-heading').getByRole('button',{name:'설정 패널 닫기',exact:true}).click();
  await page.locator('#strike').click();
  await page.waitForFunction(()=>cueLab.canonicalPlayback.readCommittedState()||cueLab.state.canonicalPlayback.phase==='refused',{},{timeout:300000});
  const final=await page.evaluate(()=>({words:Array.from(cueLab.canonicalPlayback.readCommittedState()||[]),status:cueLab.state.canonicalPlayback,
   game:cueLab.game.snapshot(),selectedId:cueLab.state.selectedId}));
  expect(final.words,'Chosen PASS must reach complete owned physical REST').toHaveLength(256);expect(final.words[1]).toBe(9);
  expect(final.status.scoreAndTurnCommitted).toBe(true);expect(final.game.pending).toBe(null);
  expect(final.game.activeCue).toBe(50);expect(final.selectedId).toBe(50);expect(final.game.scores).toEqual({'19':0,'50':1});
  await page.evaluate(()=>{document.activeElement?.blur();document.body.focus();});await page.keyboard.press('Control+z');
  expect(await page.evaluate(()=>({state:cueLab.canonicalPlayback.readCommittedState(),game:cueLab.game.snapshot()})))
   .toEqual(await page.evaluate(()=>({state:null,game:__canonicalBrowserTest.initialGame})));
  await page.keyboard.press('Control+y');expect(await page.evaluate(()=>Array.from(cueLab.canonicalPlayback.readCommittedState()||[]))).toEqual(final.words);
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:844});
   await expect.poll(()=>page.evaluate(()=>{const mobile=matchMedia('(max-width: 767px)').matches;const desktop=!!document.querySelector('[data-slot="sidebar"][data-state]:not([data-mobile])');return mobile?!desktop:desktop;})).toBe(true);
   if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
   await page.getByRole('tab',{name:'설정',exact:true}).click();await expect(page.locator('#settingsPanel')).toBeVisible();
   await page.getByRole('tab',{name:'수동',exact:true}).click();await expect(page.locator('#shotPanel')).toBeVisible();
   expect(await page.evaluate(()=>Array.from(cueLab.canonicalPlayback.readCommittedState()||[]))).toEqual(final.words);
   expect(await page.evaluate(()=>cueLab.canvas===__canonicalBrowserTest.canvas)).toBe(true);
   await waitForPretendard(page);await page.screenshot({path:testInfo.outputPath(`canonical-${width}.png`),fullPage:true});
  }
  const refusal=await page.evaluate(()=>({height:cueLab.setHeight(1),words:Array.from(cueLab.canonicalPlayback.readCommittedState()||[])}));
  expect(refusal).toEqual({height:false,words:final.words});
  await expect(page.locator('#reset')).toBeEnabled();await page.locator('#reset').click();
  expect(await page.evaluate(()=>cueLab.state.objects.map(({id,pos})=>({id,pos})))).toEqual(initialPositions);
  expect(await page.evaluate(()=>cueLab.game.snapshot())).toEqual(await page.evaluate(()=>__canonicalBrowserTest.initialGame));
  expect(await page.evaluate(()=>({state:cueLab.canonicalPlayback.readCommittedState(),undo:cueLab.undoStack.length,redo:cueLab.redoStack.length,total:cueLab.state.canonicalPlayback.searchDomain.total})))
   .toEqual({state:null,undo:0,redo:0,total:9});expect(errors).toEqual([]);
  await testInfo.attach('canonical-committed-before-reset',{body:JSON.stringify(final,null,2),contentType:'application/json'});
  expect(await page.evaluate(()=>({errors:__canonicalBrowserTest.gpuErrors,loss:__canonicalBrowserTest.deviceLoss,legacy:__canonicalBrowserTest.legacyCalls,requests:__canonicalBrowserTest.deviceRequests})))
   .toEqual({errors:[],loss:[],legacy:[],requests:1});
  await testInfo.attach('canonical-search-result',{body:JSON.stringify(search.result,null,2),contentType:'application/json'});
 } finally {
  const evidence=await page.evaluate(()=>{const t=globalThis.__canonicalBrowserTest;return {installed:!!cueLab.canonicalPlayback,
   adapters:t?.adapters,adapterRequests:t?.adapterRequests,deviceRequests:t?.deviceRequests,physicalHardwareVerified:false,userAgent:navigator.userAgent,
   state:Array.from(cueLab.canonicalPlayback?.readCommittedState()||[]),status:cueLab.state.canonicalPlayback,
   gpuErrors:t?.gpuErrors,deviceLoss:t?.deviceLoss,legacyCalls:t?.legacyCalls};}).catch(error=>({evidenceError:error.message}));
  await testInfo.attach('canonical-browser-evidence',{body:JSON.stringify({...evidence,pageErrors:errors},null,2),contentType:'application/json'});
  await page.evaluate(()=>cueLab.dispose()).catch(()=>{});
 }
});
