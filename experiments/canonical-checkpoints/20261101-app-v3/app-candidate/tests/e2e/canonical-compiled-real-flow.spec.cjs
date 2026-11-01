const {test,expect}=require('@playwright/test');
const UI_WAIT=15*60*1000; // test-only: preparation + unchanged-RPC run + visible playback
// This TEST RUNNER budget covers cancel/retry + search + selected replay.
// It does not alter the application's 600000ms RPC or 60s progress watchdog.
test('existing GPU activation, visible search, cancellation/retry and selected replay',async({page},info)=>{
 test.skip(process.env.RUN_CANONICAL_REAL_GPU!=='1','Explicit real app/native qualification only');
 test.setTimeout(40*60*1000);
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().includes('canonical-controller-assets/'))requests.push(r.url());});
 await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
 await expect(page.locator('#startCanonicalPractice')).toBeEnabled();
 await page.locator('#startCanonicalPractice').click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.locator('#cancelCanonicalPractice').click();await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(await page.evaluate(()=>!!cueLab.canonicalPlayback)).toBe(false);
 await page.locator('#startCanonicalPractice').click();await page.locator('#confirmCanonicalPractice').click();
 await page.waitForFunction(()=>!!cueLab.canonicalPlayback&&cueLab.state.canonicalPlayback?.phase==='ready',null,{timeout:UI_WAIT});
 const sidebar=async()=>{if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();};
 await sidebar();await page.locator('#tab-settings').click();
 // A genuine visible setting, not a physics/Worker override: disable unsolicited preview.
 const predict=page.locator('#predict');if(await predict.getAttribute('aria-checked')==='true')await predict.click();
 await page.locator('#tab-shot').click();
 const grid={angles:'-2',speeds:'0.5',elevations:'25',tipXs:'0',tipYs:'0.2'};
 for(const [axis,value]of Object.entries(grid))await page.locator('#canonicalGrid-'+axis).fill(value);
 await page.locator('#applyCanonicalGrid').click();
 const initial=await page.evaluate(()=>({settings:{...cueLab.state.settings},game:cueLab.game.snapshot(),objects:cueLab.state.objects,domain:cueLab.state.canonicalPlayback.searchDomain,committed:cueLab.canonicalPlayback.readCommittedState()}));
 await page.locator('#tab-settings').click();await page.locator('#tab-routes').click();await page.locator('#tab-shot').click();
 for(const [axis,value]of Object.entries(grid))await expect(page.locator('#canonicalGrid-'+axis)).toHaveValue(value);
 expect(await page.evaluate(()=>cueLab.canonicalPlayback.readCommittedState())).toEqual(initial.committed);
 await page.locator('#tab-routes').click();await page.locator('#findRoute').click();
 await expect(page.locator('#cancelRoute')).toBeVisible();
 await page.waitForFunction(()=>cueLab.state.routeProgress?.submittedCommands>0||['error','unavailable'].includes(cueLab.state.routeStatus),null,{timeout:UI_WAIT});
 expect(await page.evaluate(()=>cueLab.state.routeStatus)).toBe('searching');
 await page.locator('#cancelRoute').click();
 await page.waitForFunction(()=>cueLab.state.routeStatus!=='searching',null,{timeout:UI_WAIT});
 expect(await page.evaluate(()=>!!cueLab.state.canonicalPlayback.deviceLost)).toBe(false);
 await expect(page.locator('#findRoute')).toBeEnabled();await page.locator('#findRoute').click();
 await page.waitForFunction(()=>['done','error','unavailable','stale'].includes(cueLab.state.routeStatus),null,{timeout:UI_WAIT});
 const search=await page.evaluate(()=>({status:cueLab.state.routeStatus,error:cueLab.state.routeError,result:cueLab.state.routeResult,progress:cueLab.state.routeProgress}));
 expect(search.status,JSON.stringify(search)).toBe('done');expect(search.result.kind).toBe('canonical-compact-search-v1');
 expect(search.result.tested).toBe(1);expect(search.result.results).toHaveLength(1);
 const row=search.result.results[0];expect(row.settings).toMatchObject({angle:-2,speed:.5,elevation:25,tipX:0,tipY:.2});
 await page.locator('#applyRoute'+row.id).click();expect(await page.evaluate(()=>cueLab.state.settings)).toMatchObject(row.settings);
 await sidebar();await page.locator('#tab-shot').click();await expect(page.locator('#strike')).toBeEnabled();await page.locator('#strike').click();
 await page.waitForFunction(()=>cueLab.state.canonicalPlayback?.scoreAndTurnCommitted===true||!!cueLab.state.canonicalPlayback?.deviceLost,null,{timeout:UI_WAIT});
 const first=await page.evaluate(()=>({state:Array.from(cueLab.canonicalPlayback.readCommittedState()),game:cueLab.game.snapshot(),playback:cueLab.state.canonicalPlayback,shots:cueLab.state.shots}));
 expect(first.playback.deviceLost).toBeFalsy();expect(first.playback.scoreAndTurnCommitted).toBe(true);
 await expect(page.locator('#undo')).toBeEnabled();await page.locator('#undo').click();await expect(page.locator('#redo')).toBeEnabled();await page.locator('#redo').click();
 // Completed-shot redo restores exact owned history, not another GPU run.
 expect(await page.evaluate(()=>Array.from(cueLab.canonicalPlayback.readCommittedState()))).toEqual(first.state);
 await page.locator('#undo').click();await expect(page.locator('#strike')).toBeEnabled();await page.locator('#strike').click();
 // This second visible strike is the genuine recomputation/replay from restored inputs.
 await page.waitForFunction(()=>cueLab.state.canonicalPlayback?.scoreAndTurnCommitted===true||!!cueLab.state.canonicalPlayback?.deviceLost,null,{timeout:UI_WAIT});
 const replay=await page.evaluate(()=>({state:Array.from(cueLab.canonicalPlayback.readCommittedState()),game:cueLab.game.snapshot(),playback:cueLab.state.canonicalPlayback}));
 expect(replay.playback.deviceLost).toBeFalsy();expect(replay.state[0]).not.toBe(first.state[0]); // fresh owned candidate ID
 expect(replay.state.slice(1)).toEqual(first.state.slice(1));expect(replay.game).toEqual(first.game);
 expect(requests.some(u=>u.includes('wasm-gpu-compute-worker.mjs'))).toBe(true);expect(errors).toEqual([]);
 await info.attach('actual-visible-flow.json',{body:JSON.stringify({initial,search,first,replay,requests,errors},null,2),contentType:'application/json'});
});
