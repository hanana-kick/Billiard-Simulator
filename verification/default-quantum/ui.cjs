'use strict';
// Run once in the GitHub Chrome sandbox. Servers must already listen on 8793/8794.
// APP_DIR locates Playwright dependencies; OUT_DIR controls evidence destination.
// No injected policy, fixture, controller mutation, retries, or alternate search.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const app=process.env.APP_DIR||process.cwd();
const {chromium}=require(require.resolve('playwright',{paths:[app]}));
const out=process.env.OUT_DIR||path.resolve('ui-results');fs.mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),searchSliceBudgetMs:20000,totalSearchBudgetMs:65000,maxSearchSlices:3,caseRetries:0,cases:[],failures:[]};
const snapshot=page=>page.evaluate(()=>{const c=globalThis.cueLab,s=c.lastSnapshot,r=s.routeResult;return {
 stable:{settings:s.settings,routeOptions:s.routeOptions,selectedId:s.selectedId,shots:c.lab.shots,positions:c.lab.objects.map(o=>({id:o.id,pos:{...o.body.translation()}})),gameMode:s.gameMode},
 status:s.routeStatus,error:s.routeError,applied:s.routeApplied,activeStroke:s.activeStroke,requestGoal:c.optimizer?.latest?.options?.searchGoal,
 result:r?{count:r.results?.length||0,ids:(r.results||[]).map(x=>x.id),partial:r.partial,continuable:r.continuable,terminationReason:r.terminationReason,found:r.found}:null,
 activePanel:s.activePanel,rate:s.rate,paths:s.paths,fineAim:s.fineAim};});
(async()=>{let browser;try{
 browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});report.browserVersion=browser.version();
 for(const arm of [{name:'baseline65536',port:8793},{name:'candidate8192',port:8794}])for(const viewport of [{width:1280,height:850},{width:390,height:844}]){
  const id=`${arm.name}-${viewport.width}`,r={id,arm:arm.name,viewport,steps:[],failures:[],screenshots:[],pageErrors:[],consoleErrors:[]};report.cases.push(r);
  const context=await browser.newContext({viewport,deviceScaleFactor:1});const page=await context.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(30000);
  page.on('pageerror',e=>r.pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')r.consoleErrors.push(m.text());});
  const step=async(name,fn)=>{const start=Date.now();try{const details=await fn();r.steps.push({name,ok:true,ms:Date.now()-start,details});return true;}catch(e){const failure={name,error:String(e)};r.failures.push(failure);r.steps.push({...failure,ok:false,ms:Date.now()-start});return false;}};
  const shot=async(name)=>{const file=`${id}-${name}.png`;await page.screenshot({path:path.join(out,file),fullPage:true});r.screenshots.push(file);};
  const tab=async(name)=>{await page.locator('#tab-'+name).click();assert.equal(await page.locator('#tab-'+name).getAttribute('aria-selected'),'true');};
  const layout=async()=>{const data=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,canvas:(()=>{const x=document.querySelector('#scene'),b=x.getBoundingClientRect();return {width:b.width,height:b.height,pixels:[x.width,x.height]};})(),tabs:[...document.querySelectorAll('[role=tab]')].map(x=>{const b=x.getBoundingClientRect();return {id:x.id,left:b.left,right:b.right,width:b.width};})}));assert(data.scrollWidth<=data.width+2,JSON.stringify(data));assert(data.canvas.width>100&&data.canvas.height>100,JSON.stringify(data));for(const b of data.tabs){assert(b.width>20&&b.left>=-2&&b.right<=data.width+2,JSON.stringify(b));}return data;};
  try{
   const ready=await step('load actual app and Korean font',async()=>{await page.goto(`http://127.0.0.1:${arm.port}/`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>globalThis.cueLab?.state.ready===true,{},{timeout:30000});await page.getByRole('heading',{name:'당구 연습',exact:true}).waitFor();const font=await page.evaluate(async()=>{await document.fonts.load('16px "Pretendard Variable"','당구 연습');await document.fonts.ready;return {loaded:[...document.fonts].some(f=>f.family.includes('Pretendard')&&f.status==='loaded'),check:document.fonts.check('16px "Pretendard Variable"','당구 연습'),body:getComputedStyle(document.body).fontFamily};});r.font=font;assert(font.loaded&&font.check,'Pretendard Variable not actually loaded');});
   // Font failure remains recorded; proceed with functional evidence where possible.
   await step('open persistent inspector',async()=>{if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();await tab('routes');});
   await step('initial layout',async()=>{const l=await layout();await shot('initial-routes');return l;});
   let before,first;
   await step('untouched default first verified search, at most three UI slices / 65 seconds',async()=>{
    before=await snapshot(page);r.initial=before;assert.equal(before.status,'idle');assert(!before.stable.routeOptions.searchGoal,'Default must not be set by test');
    const start=Date.now();r.searchSlices=[];await page.locator('#findRoute').click();
    for(let slice=0;slice<3;slice++){
     // The app owns its 20 s slice budget. Permit result delivery overhead, within 65 s total.
     const remaining=65000-(Date.now()-start);assert(remaining>0,'Total search budget exhausted');
     await page.waitForFunction(()=>globalThis.cueLab.state.routeStatus!=='searching',{},{timeout:Math.min(22000,remaining)});
     first=await snapshot(page);r.searchSlices.push({slice:slice+1,elapsedMs:Date.now()-start,...first});
     if(first.result?.count||first.status!=='done'||!first.result?.continuable||slice===2)break;
     await page.locator('#resumeSearch').click({timeout:Math.max(1,Math.min(3000,65000-(Date.now()-start)))});
    }
    r.first={...first,elapsedMs:Date.now()-start};
    assert.equal(first.status,'done');assert(first.result?.count>0,'No verified default candidate returned within bounded run');assert.equal(first.result.terminationReason,'first-verified-paused');assert.equal(first.result.continuable,true);assert.deepEqual(first.stable,before.stable,'Search changed world/settings');
    await page.locator('#resumeSearch').waitFor();await page.getByText('첫 경로를 검증했습니다. 나머지 계산은 이어서 할 수 있습니다.',{exact:true}).waitFor();assert(await page.locator('[id^="applyRoute"]').first().isEnabled());await shot('first-verified');
   });
   // Stop a timed-out search through its actual button. This is not a second search.
   await step('stop or resume then stop through UI',async()=>{
    const current=await snapshot(page);r.beforeStop=current;
    if(current.status==='searching'){r.stopMode='bounded-initial-search';await page.locator('#cancelRoute').click();}
    else if(current.result?.count&&current.result.continuable){r.stopMode='resume';await page.locator('#resumeSearch').click();await page.locator('#cancelRoute').waitFor({timeout:3000});await page.locator('#cancelRoute').click();}
    else throw Error('Resume/Stop not exercised: no active search or resumable verified candidate');
    await page.waitForFunction(()=>globalThis.cueLab.state.routeStatus!=='searching',{},{timeout:3000});r.afterStop=await snapshot(page);assert.equal(r.afterStop.status,'done');assert.equal(r.afterStop.result.partial,true);if(current.result?.count){for(const id of current.result.ids)assert(r.afterStop.result.ids.includes(id),'Stop lost verified candidate '+id);}await shot('stopped');
   });
   await step('apply verified route through actual button without striking',async()=>{
    const previous=await snapshot(page);assert(previous.result?.count>0,'No verified candidate available to apply');
    const expected=await page.evaluate(()=>{const row=globalThis.cueLab.state.routeResult.results[0];return {id:row.id,settings:row.settings};});r.applyExpected=expected;
    await page.locator('[id^="applyRoute"]').first().click();const applied=await snapshot(page);r.afterApply=applied;
    assert.equal(applied.applied,expected.id);assert.equal(applied.stable.settings.angle,expected.settings.angle);assert.notEqual(applied.stable.settings.angle,previous.stable.settings.angle,'Default verified route should change aim angle');
    assert.equal(applied.stable.shots,previous.stable.shots,'Apply must not strike');assert.equal(applied.activeStroke,false);assert.deepEqual(applied.stable.positions,previous.stable.positions,'Apply moved balls');assert.deepEqual(applied.stable.routeOptions,previous.stable.routeOptions,'Apply changed search options');
    await shot('applied');
   });
   await step('manual angle edit invalidates retained candidate controls',async()=>{
    const previous=await snapshot(page);assert(previous.result?.count>0,'No retained route to invalidate');await tab('shot');
    const angle=page.locator('#angle'),target=previous.stable.settings.angle>=179?0:Number((previous.stable.settings.angle+1).toFixed(2));await angle.fill(String(target));await angle.press('Enter');
    const stale=await snapshot(page);r.afterManualEdit=stale;assert.equal(stale.stable.settings.angle,target);assert.equal(stale.status,'stale');assert.equal(stale.result.continuable,false);assert.equal(stale.applied,null);assert.equal(stale.stable.shots,previous.stable.shots);assert.deepEqual(stale.stable.positions,previous.stable.positions);
    await tab('routes');assert.equal(await page.locator('#resumeSearch').count(),0);const buttons=page.locator('[id^="applyRoute"]');assert(await buttons.count()>0);for(let i=0;i<await buttons.count();i++)assert(await buttons.nth(i).isDisabled(),'Stale candidate Apply must be disabled');await shot('stale-after-edit');
   });
   await step('real settings persist across all tabs and drawer',async()=>{
    const stable=(await snapshot(page)).stable;await tab('settings');const paths=page.locator('#paths'),old=await paths.getAttribute('aria-checked');await paths.click();const changed=await paths.getAttribute('aria-checked');assert.notEqual(changed,old);
    await page.locator('#speed').click();await page.getByRole('option',{name:'0.5×',exact:true}).click();assert.equal((await snapshot(page)).rate,.5);
    await tab('shot');await page.locator('#fineAim').click();const fine=await page.locator('#fineAim').getAttribute('aria-checked');await tab('routes');await tab('shot');assert.equal(await page.locator('#fineAim').getAttribute('aria-checked'),fine);await tab('settings');assert.equal(await page.locator('#paths').getAttribute('aria-checked'),changed);assert.equal((await snapshot(page)).rate,.5);assert.deepEqual((await snapshot(page)).stable,stable,'Tab/settings reset world or shot settings');
    await layout();await shot('settings');await page.locator('button[aria-label="설정 패널 닫기"]:not(#sidebarTrigger)').click();await page.locator('#sidebarTrigger').click();await page.locator('#settingsPanel').waitFor();assert.equal(await page.locator('#paths').getAttribute('aria-checked'),changed);await tab('routes');await layout();await shot('final-routes');
   });
  }catch(e){r.failures.push({name:'case setup or cleanup',error:String(e)});}
  finally{await step('final diagnostics',async()=>{r.final=await snapshot(page);await shot('final');assert.equal(r.pageErrors.length,0,JSON.stringify(r.pageErrors));});await context.close();r.ok=r.failures.length===0;fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify(r,null,2));report.failures.push(...r.failures.map(f=>({case:id,...f})));fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2));}
 }
}catch(e){report.failures.push({name:'fatal',error:String(e)});}finally{if(browser)await browser.close();report.finishedAt=new Date().toISOString();report.ok=report.cases.length===4&&report.failures.length===0;fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;}
})();
