'use strict';
// Run once in the GitHub Chrome sandbox. Servers must already listen on 8793/8794.
// APP_DIR locates Playwright dependencies; OUT_DIR controls evidence destination.
// No injected policy, fixture, controller mutation, retries, or alternate search.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const app=process.env.APP_DIR||process.cwd();
const {chromium}=require(require.resolve('playwright',{paths:[app]}));
const out=process.env.OUT_DIR||path.resolve('ui-results');fs.mkdirSync(out,{recursive:true});
const EXPECTED_HASHES={"controller": "17f84814544c658a21da6e71d01ba2925edffaa69dfb0c6d6d432ceb44d89906", "optimizer-service": "0f3b7e94bc30ca1b30011aefd97b7f17f469f0f189acd0427f1513e6b5574312", "baseline65536": "ef07c9761ef1e098aa5519e2f193517e729826b9b06b4b206da2ff7a9feaa938", "candidate8192": "a5ef61e10de6ed0364736dbc8ff90e362b5ff5882ee452237ae6bd34bd7d8f12"};
const report={instrumentation:'Read-only interval samples, not exact event tracing; CPU instrumentation overhead makes timings non-comparable to earlier 96 runs.',startedAt:new Date().toISOString(),searchSliceBudgetMs:20000,totalSearchBudgetMs:120000,initialDiagnosticLimitMs:65000,additionalResumeLimitMs:45000,maxSearchSlices:3,caseRetries:0,cases:[],failures:[]};
const hashValue=value=>require('node:crypto').createHash('sha256').update(JSON.stringify(value)).digest('hex');
const snapshot=page=>page.evaluate(()=>{const c=globalThis.cueLab,s=c.lastSnapshot,r=s.routeResult;return {
 stable:{settings:s.settings,routeOptions:s.routeOptions,selectedId:s.selectedId,shots:c.lab.shots,positions:c.lab.objects.map(o=>({id:o.id,pos:{...o.body.translation()}})),gameMode:s.gameMode},
 status:s.routeStatus,error:s.routeError,applied:s.routeApplied,activeStroke:s.activeStroke,requestGoal:c.optimizer?.latest?.options?.searchGoal,
 result:r?{count:r.results?.length||0,ids:(r.results||[]).map(x=>x.id),identities:(r.results||[]).map(x=>globalThis.LabRouteRules.successIdentity(x)),partial:r.partial,continuable:r.continuable,terminationReason:r.terminationReason,found:r.found}:null,
 optimizer:{version:c.optimizer?.version,active:!!c.optimizer?.latest,workers:c.optimizer?.workers?.length,busy:c.optimizer?.busy?.size},notice:s.notice,predict:s.predict,nextShotPrecompute:s.nextShotPrecompute,activePanel:s.activePanel,rate:s.rate,paths:s.paths,fineAim:s.fineAim};});
(async()=>{let browser;try{
 browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});report.browserVersion=browser.version();
 const cases=[];for(let repeat=0;repeat<4;repeat++){
  const baseline={name:'baseline65536',port:8793,width:390,height:844},narrow={name:'candidate8192',port:8794,width:390,height:844},desktop={name:'candidate8192',port:8794,width:1280,height:850};
  for(const arm of (repeat===0||repeat===3?[baseline,narrow,desktop]:[desktop,narrow,baseline]))cases.push({arm,repeat});
 }
 const browserCDP=await browser.newBrowserCDPSession();
 for(const {arm,repeat} of cases){const viewport={width:arm.width,height:arm.height};
  const id=`${arm.name}-${viewport.width}-r${repeat}`,r={id,repeat,arm:arm.name,viewport,steps:[],failures:[],screenshots:[],pageErrors:[],consoleErrors:[],telemetry:[],checkpoints:[],waveTransitions:[]};report.cases.push(r);
  const context=await browser.newContext({viewport,deviceScaleFactor:1});const page=await context.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(30000);
  page.on('pageerror',e=>r.pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')r.consoleErrors.push(m.text());});
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');let telemetryOn=false,telemetryTask=null,phase='initial',lastSample=null;
  const sample=async()=>{
   const requestedAt=Date.now();
   const state=await page.evaluate(()=>{
    const c=globalThis.cueLab;if(!c)return null;const o=c.optimizer,s=o?.search;
    const job=j=>({id:j.id,wave:j.wave,branchId:j.branchId,purpose:j.purpose});
    return {now:performance.now(),status:c.state.routeStatus,version:o?.version,optimizerActive:!!o?.latest,firstVerifiedTarget:o?.firstVerifiedTarget,workers:o?.workers?.length,busy:[...(o?.busy?.values()||[])].map(t=>({...job(t.job),steps:t.steps})),outcomes:[...(o?.outcomes?.keys()||[])],queue:(o?.queue||[]).map(job),jobs:(o?.jobs||[]).map(job),wave:s?.wave,deadline:s?.deadline,deadlineOverrunMs:s?Math.max(0,performance.now()-s.deadline):0,pending:(s?.pending||[]).map(job),active:(s?.active||[]).map(e=>({branchId:e.branch?.id,phase:e.state?.phase,status:e.state?.status,serviceSteps:e.serviceSteps})),finished:s?.finished,paused:s?.paused,evaluations:s?.evaluations,physicsSteps:s?.physicsSteps,interrupted:o?.firstVerifiedPause,retryOverhead:o?.retryOverhead,resultCount:c.state.routeResult?.results?.length||0,background:{predictionBusy:c.state.predictionBusy,predictionWorkerPresent:!!c.predictor?.worker,aimTimerScheduled:!!c.nextShot?.aimTimer,nextShot:c.state.nextShotPreparation,generation:c.nextShot?.generation,jobPresent:!!c.nextShot?.job,optimizerVersion:c.nextShot?.job?.optimizer?.version,optimizerActive:!!c.nextShot?.job?.optimizer?.latest,optimizerWorkerPresent:!!c.nextShot?.job?.optimizer?.worker,optimizerSuspended:c.nextShot?.job?.suspended,warmed:!!c.nextShot?.warmed},predict:c.state.predict,nextShotPrecompute:c.state.nextShotPrecompute};
   });
   const readCompletedAt=Date.now();const cpu={};
   try{cpu.pageMetrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));}catch(e){cpu.pageError=String(e);}
   try{cpu.processes=(await browserCDP.send('SystemInfo.getProcessInfo')).processInfo.map(x=>({id:x.id,type:x.type,cpuTime:x.cpuTime}));}catch(e){cpu.processError=String(e);}
   const row={phase,requestedAt,readCompletedAt,completedAt:Date.now(),heartbeatRoundTripMs:readCompletedAt-requestedAt,heartbeatIntervalMs:lastSample?readCompletedAt-lastSample.readCompletedAt:null,state,cpu};r.telemetry.push(row);
   if(state&&lastSample?.state){const prev=lastSample.state,interval=[prev.now,state.now];
    if(prev.version!==state.version)r.waveTransitions.push({type:'version-change-or-cancel',interval,from:prev.version,to:state.version,phase});
    if(prev.wave!==state.wave)r.waveTransitions.push({type:'observed-wave-change',interval,from:prev.wave,to:state.wave,version:state.version,phase});
    const prior=new Set(prev.busy.map(x=>x.id)),done=new Set(prev.outcomes);
    for(const job of state.busy)if(!prior.has(job.id)||prev.version!==state.version)r.waveTransitions.push({type:'observed-job-dispatch',interval,version:state.version,job,phase});
    for(const id of state.outcomes)if(!done.has(id)&&prev.version===state.version)r.waveTransitions.push({type:'observed-job-completion',interval,version:state.version,id,phase});
   }lastSample=row;return row;
  };
  const startTelemetry=()=>{telemetryOn=true;telemetryTask=(async()=>{while(telemetryOn){const at=Date.now();try{await sample();}catch(e){r.telemetry.push({phase,error:String(e),at:Date.now()});}if(telemetryOn)await new Promise(resolve=>setTimeout(resolve,Math.max(0,100-(Date.now()-at))));}})();};
  const stopTelemetry=async()=>{telemetryOn=false;if(telemetryTask)await telemetryTask;};
  const observeNatural=async(limitMs,label)=>{const start=Date.now();let last;while(Date.now()-start<limitMs){last=await snapshot(page);if(last.status!=='searching')return {natural:true,elapsedMs:Date.now()-start,last};await page.waitForTimeout(Math.min(100,Math.max(1,limitMs-(Date.now()-start))));}last=await snapshot(page);return {natural:last.status!=='searching',elapsedMs:Date.now()-start,last,label};};
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
   let before,first,sourceValid=false;
   await step('verify embedded runtime hashes and untouched default flags',async()=>{
    const sources=await page.evaluate(()=>Object.fromEntries(['controller','optimizer-service','inverse-planner'].map(k=>[k,document.getElementById('source-'+k)?.textContent])));
    r.sourceHashes={};for(const [key,value] of Object.entries(sources)){assert.equal(typeof value,'string','Missing embedded source '+key);const actual=require('node:crypto').createHash('sha256').update(value.replace(/^\n+|\n+$/g,'')).digest('hex');const expected=EXPECTED_HASHES[key==='inverse-planner'?arm.name:key];r.sourceHashes[key]={actual,expected};assert.equal(actual,expected,'Runtime hash mismatch '+key);}
    before=await snapshot(page);assert.equal(before.predict,true);assert.equal(before.nextShotPrecompute,true);assert.equal(before.status,'idle');assert(!before.stable.routeOptions.searchGoal);r.initial=before;
    r.initialInput=await page.evaluate(()=>{const c=cueLab,snapshot=c.lab.snapshot({trails:false});return {snapshot:{...snapshot,world:Array.from(snapshot.world)},settings:{...c.state.settings},options:{...c.state.routeOptions},selectedId:c.state.selectedId};});r.initialInput.snapshotSHA256=hashValue(r.initialInput.snapshot);r.initialInput.settingsOptionsSHA256=hashValue([r.initialInput.settings,r.initialInput.options]);sourceValid=true;
   });
   if(!sourceValid)throw Error('Refusing searches against unverified runtime/defaults');
   startTelemetry();
   await step('default search with original 22-second checkpoint and separate diagnostic observation',async()=>{
    phase='first-search';const start=Date.now();r.searchSlices=[];await page.locator('#findRoute').click();
    r.submittedInput=await page.evaluate(()=>{const c=cueLab,req=c.optimizer.search?.req||c.optimizer.latest;if(!req)throw Error('Actual submitted foreground request not available');return {snapshot:{...req.snapshot,world:Array.from(req.snapshot.world)},settings:req.settings,options:req.options,selectedId:req.selectedId,savedGoalPresent:Object.hasOwn(c.state.routeOptions,'searchGoal'),savedGoal:c.state.routeOptions.searchGoal};});
    r.submittedInput.snapshotSHA256=hashValue(r.submittedInput.snapshot);r.submittedInput.settingsOptionsSHA256=hashValue([r.submittedInput.settings,r.submittedInput.options]);r.initialSubmittedSnapshotEqual=r.initialInput.snapshotSHA256===r.submittedInput.snapshotSHA256;
    assert.equal(r.submittedInput.options.searchGoal,'first-verified');assert.equal(r.submittedInput.savedGoalPresent,false);
    for(let slice=0;slice<3;slice++){
     const sliceStart=Date.now(),remaining=120000-(sliceStart-start);assert(remaining>0,'Total 120 s search observation budget exhausted');
     const initial=await observeNatural(Math.min(22000,remaining),'original-22s');
     const checkpoint={slice:slice+1,limitMs:22000,naturalWithinCheckpoint:initial.natural&&initial.elapsedMs<=22000,elapsedMs:Date.now()-sliceStart,state:initial.last};r.checkpoints.push(checkpoint);
     if(!checkpoint.naturalWithinCheckpoint)r.failures.push({name:'original 22-second natural-slice checkpoint',slice:slice+1,error:'No natural slice termination within original 22-second checkpoint; diagnostic continuation is not a pass.'});
     let diagnostic=initial;
     if(!initial.natural){phase='first-search-overrun-diagnostic';const allowance=Math.min(65000-(Date.now()-sliceStart),120000-(Date.now()-start));if(allowance>0)diagnostic=await observeNatural(allowance,'separate-65s-natural-slice-diagnostic');}
     first=await snapshot(page);if(first.result?.count&&!r.firstVerifiedObservedAt)r.firstVerifiedObservedAt=Date.now();r.searchSlices.push({slice:slice+1,elapsedMs:Date.now()-sliceStart,totalElapsedMs:Date.now()-start,natural:diagnostic.natural,state:first});
     if(!diagnostic.natural){await page.locator('#cancelRoute').click();throw Error('Natural slice did not terminate within diagnostic observation bound; stopped through UI');}
     if(first.result?.count||first.status!=='done'||!first.result?.continuable||slice===2)break;
     assert(120000-(Date.now()-start)>0,'No time remaining for no-result Resume');phase='first-search-no-result-resume';await page.locator('#resumeSearch').click();
    }
    r.first={...first,elapsedMs:Date.now()-start};r.firstRecall=!!first?.result?.count;r.firstResultIdentities=first?.result?.identities||[];
    assert.equal(first.status,'done');assert(first.result?.count>0,'No first verified route within fixed diagnostic budget');assert.equal(first.result.terminationReason,'first-verified-paused');assert.equal(first.result.continuable,true);assert.deepEqual(first.stable,before.stable);
    await page.locator('#resumeSearch').waitFor();await page.getByText('첫 경로를 검증했습니다. 나머지 계산은 이어서 할 수 있습니다.',{exact:true}).waitFor();if(repeat!==0)await shot('first-verified');
   });
   await step('one explicit Resume seeks additional identity, then actual Stop if needed',async()=>{
    const current=await snapshot(page);r.beforeAdditionalResume=current;assert(current.result?.count>0&&current.result.continuable,'No resumable verified first candidate');const oldIdentities=current.result.identities;phase='pre-resume-timing';
    const targetBefore=await page.evaluate(()=>cueLab.optimizer.firstVerifiedTarget);assert.equal(targetBefore,current.result.count,'Resume success-count target must start at existing verified count');
    const timingStart=Date.now(),timingBudget=repeat===0?0:repeat===1?3000:5000;
    r.resumeTiming={condition:['immediate','forecast-started','forecast-completed-and-aim-timer-scheduled','aim-or-precompute-active'][repeat],budgetMs:timingBudget,matched:false,observations:[]};
    do{
     const condition=await page.evaluate(repeat=>{const c=cueLab,job=c.nextShot?.job;const flags={predictionBusy:c.state.predictionBusy,aimTimerScheduled:!!c.nextShot?.aimTimer,jobPresent:!!job,jobAiming:!!job?.aiming,suspended:!!job?.suspended,phase:c.state.nextShotPreparation?.phase,optimizerWorkerPresent:!!job?.optimizer?.worker};return {at:performance.now(),flags,matched:repeat===0||repeat===1&&flags.predictionBusy||repeat===2&&!flags.predictionBusy&&flags.aimTimerScheduled||repeat===3&&flags.jobPresent&&!flags.suspended&&['predicting','searching'].includes(flags.phase)};},repeat);
     r.resumeTiming.observations.push(condition);if(condition.matched){r.resumeTiming.matched=true;break;}if(Date.now()-timingStart>=timingBudget)break;await page.waitForTimeout(Math.min(50,timingBudget-(Date.now()-timingStart)));
    }while(Date.now()-timingStart<timingBudget);
    r.resumeTiming.waitElapsedMs=Date.now()-timingStart;r.resumeTiming.clickRequestedAt=Date.now();r.resumeTiming.firstVerifiedObservedToClickMs=r.firstVerifiedObservedAt?Date.now()-r.firstVerifiedObservedAt:null;r.resumeTiming.immediateWithin140ms=repeat===0?r.resumeTiming.firstVerifiedObservedToClickMs<140:null;
    // Unmet timing predicates are recorded, never manufactured by changing settings or timers.
    await page.locator('#resumeSearch').click();r.resumeTiming.clickCompletedAt=Date.now();phase='additional-resume';const outcome=await observeNatural(45000,'one-additional-resume-slice');r.additionalResume=outcome;
    const observed=await snapshot(page);r.additionalIdentities=observed.result.identities.filter(x=>!oldIdentities.includes(x));r.additionalIdentityCount=r.additionalIdentities.length;r.additionalIdentityRecall=r.additionalIdentityCount>0;r.additionalResumeOutcome=r.additionalIdentityRecall?'new-identity':outcome.natural?'natural-budget-or-domain-stop':'still-searching-at-45s';
    for(const identity of oldIdentities)assert(observed.result.identities.includes(identity),'Resume lost existing identity');
    const targetAfter=await page.evaluate(()=>cueLab.optimizer.firstVerifiedTarget);r.targetCounts={before:targetBefore,after:targetAfter};assert.equal(targetAfter,r.additionalIdentityRecall?observed.result.count:targetBefore,'First-verified count target mismatch');
    if(observed.status==='searching'){await page.locator('#cancelRoute').click();r.usedStop=true;}else r.usedStop=false;
    phase='post-stop-or-natural-pause';r.afterStop=await snapshot(page);assert.equal(r.afterStop.status,'done');for(const identity of oldIdentities)assert(r.afterStop.result.identities.includes(identity));
    // Fixed observation window, not a retry or search extension, captures idle/background CPU.
    await page.waitForTimeout(2000);await shot('after-additional-resume');
   });
   // A failed first-result step must not leave background foreground work running.
   if((await snapshot(page)).status==='searching'){await page.locator('#cancelRoute').click();r.cleanupStoppedSearch=true;}
   phase='ui-controls';
   await step('apply verified route through actual button without striking',async()=>{
    const previous=await snapshot(page);assert(previous.result?.count>0,'No verified candidate available to apply');
    const expected=await page.evaluate(()=>{const row=globalThis.cueLab.state.routeResult.results[0];return {id:row.id,settings:row.settings};});r.applyExpected=expected;
    await page.locator('[id^="applyRoute"]').first().click();const applied=await snapshot(page);r.afterApply=applied;
    assert.equal(applied.applied,expected.id);for(const [key,value] of Object.entries(expected.settings))assert.equal(applied.stable.settings[key],value,'Applied setting mismatch '+key);assert.equal(applied.stable.settings.angle,expected.settings.angle);assert.notEqual(applied.stable.settings.angle,previous.stable.settings.angle,'Default verified route should change aim angle');
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
  finally{await stopTelemetry();await step('final diagnostics',async()=>{await shot('final');r.final=await snapshot(page);assert.equal(r.pageErrors.length,0,JSON.stringify(r.pageErrors));});r.cpuByPhase={};for(const phaseName of [...new Set(r.telemetry.map(x=>x.phase))]){const rows=r.telemetry.filter(x=>x.phase===phaseName&&x.state&&x.cpu?.pageMetrics);if(!rows.length)continue;const a=rows[0],b=rows.at(-1),duration=(b.completedAt-a.completedAt)/1000;r.cpuByPhase[phaseName]={samples:rows.length,wallSeconds:duration,pageTaskSeconds:b.cpu.pageMetrics.TaskDuration-a.cpu.pageMetrics.TaskDuration,pageScriptSeconds:b.cpu.pageMetrics.ScriptDuration-a.cpu.pageMetrics.ScriptDuration,maxHeartbeatRoundTripMs:Math.max(...rows.map(x=>x.heartbeatRoundTripMs)),maxHeartbeatIntervalMs:Math.max(...rows.map(x=>x.heartbeatIntervalMs||0)),foregroundActiveSamples:rows.filter(x=>x.state.optimizerActive).length,predictionBusySamples:rows.filter(x=>x.state.background.predictionBusy).length,nextShotPresentSamples:rows.filter(x=>x.state.background.jobPresent).length,processCPUSeconds:(b.cpu.processes||[]).map(x=>({id:x.id,type:x.type,delta:x.cpuTime-(a.cpu.processes||[]).find(y=>y.id===x.id)?.cpuTime})),attribution:'Page TaskDuration excludes worker CPU; process deltas are shared-browser totals, not attributed to foreground/background services.'};}
   r.backgroundForegroundOverlap=r.telemetry.filter(x=>x.state?.optimizerActive&&(x.state.background.predictionBusy||x.state.background.jobPresent&&!x.state.background.optimizerSuspended&&['predicting','searching'].includes(x.state.background.nextShot?.phase))).map(x=>({requestedAt:x.requestedAt,now:x.state.now,phase:x.phase,foregroundVersion:x.state.version,foregroundBusy:x.state.busy,background:x.state.background}));r.overlapScope='Observed overlap only. Absence in interval samples does not prove no overlap; worker presence alone does not prove CPU activity.';
   r.waveObservations=[];const waves=new Map();for(const row of r.telemetry){const t=row.state;if(!t?.pending?.length)continue;const key=JSON.stringify([t.version,t.wave,t.pending.map(j=>j.id)]);let w=waves.get(key);if(!w){w={version:t.version,wave:t.wave,pending:t.pending,firstObservedNow:t.now,lastObservedNow:t.now,maxDeadlineOverrunMs:0,maxReportedBusySteps:0};waves.set(key,w);}w.lastObservedNow=t.now;w.maxDeadlineOverrunMs=Math.max(w.maxDeadlineOverrunMs,t.deadlineOverrunMs);w.maxReportedBusySteps=Math.max(w.maxReportedBusySteps,...t.busy.map(j=>j.steps||0));}for(const w of waves.values())r.waveObservations.push({...w,observedDurationLowerBoundMs:w.lastObservedNow-w.firstObservedNow,timestampScope:'Interval-sampled bounds; may miss complete short waves.'});
   await context.close();r.ok=r.failures.length===0;fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify(r,null,2));report.failures.push(...r.failures.map(f=>({case:id,...f})));fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2));}
 }
}catch(e){report.failures.push({name:'fatal',error:String(e)});}finally{if(browser)await browser.close();report.finishedAt=new Date().toISOString();report.ok=report.cases.length===12&&report.failures.length===0;fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;}
})();
