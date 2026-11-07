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
 optimizer:{version:c.optimizer?.version,active:!!c.optimizer?.latest,workers:c.optimizer?.workers?.length,busy:c.optimizer?.busy?.size},notice:s.notice,activePanel:s.activePanel,rate:s.rate,paths:s.paths,fineAim:s.fineAim};});
(async()=>{let browser;try{
 browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});report.browserVersion=browser.version();
 for(const arm of [{name:'baseline65536',port:8793},{name:'candidate8192',port:8794}])for(const viewport of [{width:1280,height:850},{width:390,height:844}]){
  const id=`${arm.name}-${viewport.width}`,r={id,arm:arm.name,viewport,steps:[],failures:[],screenshots:[],pageErrors:[],consoleErrors:[]};report.cases.push(r);
  const context=await browser.newContext({viewport,deviceScaleFactor:1});const page=await context.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(30000);
  page.on('pageerror',e=>r.pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')r.consoleErrors.push(m.text());});
  const step=async(name,fn)=>{const start=Date.now();try{const details=await fn();r.steps.push({name,ok:true,ms:Date.now()-start,details});return true;}catch(e){const failure={name,error:String(e)};r.failures.push(failure);r.steps.push({...failure,ok:false,ms:Date.now()-start});return false;}};
  const shot=async(name)=>{const file=`${id}-${name}.png`;await page.screenshot({path:path.join(out,file),fullPage:true});r.screenshots.push(file);};
  const tab=async(name)=>{await page.locator('#tab-'+name).click();assert.equal(await page.locator('#tab-'+name).getAttribute('aria-selected'),'true');};
  const settleLayout=async()=>{
   const evidence=await page.evaluate(async()=>{
    const start=performance.now(),budget=3000,samples=[],animationWaits=[],mobile=matchMedia('(max-width: 767px)').matches;
    let last=null,stable=0;
    const result=(ok,reason)=>({ok,reason,mobile,budgetMs:budget,elapsedMs:performance.now()-start,samples,animationWaits});
    const bounded=promise=>new Promise(resolve=>{const remaining=budget-(performance.now()-start);if(remaining<=0)return resolve(false);const timer=setTimeout(()=>resolve(false),remaining);promise.then(()=>{clearTimeout(timer);resolve(true);},()=>{clearTimeout(timer);resolve(true);});});
    const frame=()=>bounded(new Promise(resolve=>requestAnimationFrame(resolve)));
    const identity=el=>el?{tag:el.tagName,id:el.id,attributes:Object.fromEntries([...el.attributes].map(a=>[a.name,a.value]))}:null;
    const describe=a=>({type:a.constructor.name,playState:a.playState,pending:a.pending,currentTime:a.currentTime,property:a.transitionProperty||null,target:identity(a.effect?.target)});
    const zeroTranslate=value=>value==='none'||value.trim().split(/\s+/).every(x=>/^[-+]?0(?:\.0+)?(?:px|%)?$/.test(x));
    const zeroTransform=value=>{try{return value==='none'||new DOMMatrixReadOnly(value).isIdentity;}catch{return false;}};
    while(performance.now()-start<budget){
     // Require the wrapper's actual DOM slot. A missing mobile popup is not zero animations.
     const matches=[...document.querySelectorAll('[data-sidebar="sidebar"][data-mobile="true"]')];
     const tabs=[...document.querySelectorAll('[role=tab]')],popup=mobile?matches[0]:null;
     if(mobile&&matches.length!==1){samples.push({elapsedMs:performance.now()-start,matchCount:matches.length,matches:matches.map(identity)});return result(false,'Expected exactly one actual mobile sidebar popup');}
     if(tabs.length!==3){samples.push({elapsedMs:performance.now()-start,tabCount:tabs.length});return result(false,'Expected three inspector tabs');}
     const style=popup?getComputedStyle(popup):null;
     const computed=style?{translate:style.translate,transform:style.transform,opacity:style.opacity,visibility:style.visibility,display:style.display,transitionProperty:style.transitionProperty,transitionDuration:style.transitionDuration,transitionDelay:style.transitionDelay}:null;
     const openState={triggerExpanded:document.querySelector('#sidebarTrigger')?.getAttribute('aria-expanded'),dataOpen:popup?.hasAttribute('data-open')??null,dataClosed:popup?.hasAttribute('data-closed')??null,starting:popup?.hasAttribute('data-starting-style')??null,ending:popup?.hasAttribute('data-ending-style')??null,dataState:popup?.getAttribute('data-state')??null};
     // Include animations on the popup AND any ancestor affecting tab geometry.
     const relevant=document.getAnimations().filter(a=>{const target=a.effect?.target;return target instanceof Element&&(tabs.some(t=>target===t||target.contains(t))||(popup&&(target===popup||popup.contains(target))));});
     const active=relevant.filter(a=>a.pending||a.playState==='running');
     const bounds=tabs.map(x=>{const b=x.getBoundingClientRect();return {id:x.id,left:b.left,right:b.right,top:b.top,width:b.width,height:b.height};});
     const openingComplete=openState.triggerExpanded==='true'&&(!mobile||(!openState.starting&&!openState.ending&&!openState.dataClosed&&openState.dataState!=='closed'&&zeroTranslate(computed.translate)&&zeroTransform(computed.transform)&&Number(computed.opacity)===1&&computed.visibility==='visible'&&computed.display!=='none'));
     const unchanged=last&&last.length===bounds.length&&bounds.every((b,i)=>b.id===last[i].id&&['left','right','top','width','height'].every(k=>Math.abs(b[k]-last[i][k])<.01));
     stable=openingComplete&&!active.length&&unchanged?stable+1:0;
     samples.push({elapsedMs:performance.now()-start,matchCount:matches.length,popup:identity(popup),openState,computed,bounds,animations:relevant.map(describe),openingComplete,stableFrames:stable});
     last=openingComplete&&!active.length?bounds:null;
     if(stable>=3)return result(true,'Opening complete and bounds stable across four rendered frames');
     if(active.length){
      const record={atMs:performance.now()-start,animations:active.map(describe),finished:false,cancellations:0};animationWaits.push(record);
      const completed=await bounded(Promise.all(active.map(a=>a.finished.catch(()=>{record.cancellations++;}))));record.finished=completed;record.completedAtMs=performance.now()-start;
      if(!completed)return result(false,'Timed out awaiting actual animation finished promises');
      last=null;stable=0;
     }
     if(!await frame())return result(false,'Timed out awaiting rendered frame');
    }
    return result(false,'Opening state or geometry failed to settle within 3 seconds');
   });
   (r.layoutSettlements??=[]).push(evidence);assert(evidence.ok,'Drawer animation/bounds did not settle within 3 seconds: '+JSON.stringify(evidence));
  };
  const layout=async()=>{await settleLayout();const data=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,canvas:(()=>{const x=document.querySelector('#scene'),b=x.getBoundingClientRect();return {width:b.width,height:b.height,pixels:[x.width,x.height]};})(),tabs:[...document.querySelectorAll('[role=tab]')].map(x=>{const b=x.getBoundingClientRect();return {id:x.id,left:b.left,right:b.right,width:b.width};})}));assert(data.scrollWidth<=data.width+2,JSON.stringify(data));assert(data.canvas.width>100&&data.canvas.height>100,JSON.stringify(data));for(const b of data.tabs){assert(b.width>20&&b.left>=-2&&b.right<=data.width+2,JSON.stringify(b));}return data;};
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
   await step('manual angle edit and actual Resume stamp refusal without computation',async()=>{
    const previous=await snapshot(page);assert(previous.result?.count>0,'No retained route available');await tab('shot');
    const angle=page.locator('#angle'),target=previous.stable.settings.angle>=179?0:Number((previous.stable.settings.angle+1).toFixed(2));await angle.fill(String(target));await angle.press('Enter');
    const edited=await snapshot(page);r.afterManualEdit=edited;assert.equal(edited.stable.settings.angle,target);assert.equal(edited.stable.shots,previous.stable.shots);assert.equal(edited.activeStroke,false);assert.deepEqual(edited.stable.positions,previous.stable.positions);
    await tab('routes');const beforeResume=await snapshot(page);assert.equal(beforeResume.status,'done');assert.equal(beforeResume.optimizer.active,false);assert.equal(beforeResume.optimizer.workers,0);assert.equal(beforeResume.optimizer.busy,0);
    await page.locator('#resumeSearch').click();await page.getByText('배치나 조건이 바뀌었습니다. 새로 계산하세요.',{exact:true}).waitFor();
    r.refusedResumeSamples=[];
    for(let i=0;i<4;i++){
     const refused=await snapshot(page);r.refusedResumeSamples.push(refused);assert.equal(refused.status,'done');assert.deepEqual(refused.optimizer,beforeResume.optimizer,'Resume must not increment optimizer version or start work');assert.deepEqual(refused.stable,beforeResume.stable);assert.equal(refused.activeStroke,false);assert.equal(await page.locator('#cancelRoute').count(),0);if(i<3)await page.waitForTimeout(100);
    }
    await shot('resume-refused-after-edit');
   });
   await step('actual route option invalidates retained candidate controls',async()=>{
    await tab('routes');const previous=await snapshot(page);assert.equal(previous.stable.routeOptions.order,'either');assert(previous.result?.count>0);
    await page.locator('#routeDetails').click();await page.getByRole('combobox',{name:'목적구 순서',exact:true}).click();await page.getByRole('option',{name:'A → B 고정',exact:true}).click();
    const stale=await snapshot(page);r.afterRouteOptionEdit=stale;assert.equal(stale.stable.routeOptions.order,'fixed');assert.equal(stale.status,'stale');assert.equal(stale.result.continuable,false);assert.equal(stale.applied,null);assert.equal(stale.stable.shots,previous.stable.shots);assert.equal(stale.activeStroke,false);assert.deepEqual(stale.stable.positions,previous.stable.positions);assert.deepEqual(stale.stable.settings,previous.stable.settings);
    assert.equal(await page.locator('#resumeSearch').count(),0);const buttons=page.locator('[id^="applyRoute"]');assert(await buttons.count()>0);for(let i=0;i<await buttons.count();i++)assert(await buttons.nth(i).isDisabled(),'Stale candidate Apply must be disabled');await shot('stale-after-route-option');
   });
   await step('real settings persist across all tabs and drawer',async()=>{
    const stable=(await snapshot(page)).stable;await tab('settings');const paths=page.getByRole('checkbox',{name:'실제 이동 궤적',exact:true}),old=await paths.getAttribute('aria-checked');await paths.click();const changed=await paths.getAttribute('aria-checked');assert.notEqual(changed,old);
    await page.getByRole('combobox',{name:'재생 속도',exact:true}).click();await page.getByRole('option',{name:'0.5×',exact:true}).click();assert.equal((await snapshot(page)).rate,.5);
    await tab('shot');await page.getByRole('checkbox',{name:'미세 조준',exact:true}).click();const fine=await page.getByRole('checkbox',{name:'미세 조준',exact:true}).getAttribute('aria-checked');await tab('routes');await tab('shot');assert.equal(await page.getByRole('checkbox',{name:'미세 조준',exact:true}).getAttribute('aria-checked'),fine);await tab('settings');assert.equal(await page.getByRole('checkbox',{name:'실제 이동 궤적',exact:true}).getAttribute('aria-checked'),changed);assert.equal((await snapshot(page)).rate,.5);assert.deepEqual((await snapshot(page)).stable,stable,'Tab/settings reset world or shot settings');
    await layout();await shot('settings');await page.locator('button[aria-label="설정 패널 닫기"]:not(#sidebarTrigger)').click();await page.locator('#sidebarTrigger').click();await page.locator('#settingsPanel').waitFor();await settleLayout();assert.equal(await page.getByRole('checkbox',{name:'실제 이동 궤적',exact:true}).getAttribute('aria-checked'),changed);assert.equal((await snapshot(page)).rate,.5);assert.deepEqual((await snapshot(page)).stable,stable,'Drawer reopen reset world or settings');await tab('shot');assert.equal(await page.getByRole('checkbox',{name:'미세 조준',exact:true}).getAttribute('aria-checked'),fine);await tab('routes');await layout();await shot('final-routes');
   });
  }catch(e){r.failures.push({name:'case setup or cleanup',error:String(e)});}
  finally{await step('final diagnostics',async()=>{r.final=await snapshot(page);await shot('final');assert.equal(r.pageErrors.length,0,JSON.stringify(r.pageErrors));});await context.close();r.ok=r.failures.length===0;fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify(r,null,2));report.failures.push(...r.failures.map(f=>({case:id,...f})));fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2));}
 }
}catch(e){report.failures.push({name:'fatal',error:String(e)});}finally{if(browser)await browser.close();report.finishedAt=new Date().toISOString();report.ok=report.cases.length===4&&report.failures.length===0;fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;}
})();
