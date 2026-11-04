'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {waitForPretendard,PRETENDARD_CSS_URL,PRETENDARD_CDN_BASE}=require('./font-helper.cjs');
const pins=require('./deployed-pins.json');
const OUT=path.resolve(process.env.RUN_OUT||'public-cpu-event-window-evidence');fs.mkdirSync(OUT,{recursive:true});
const URL=pins.publicURL,ALGORITHM='cpu-event-window-inverse',LABEL='관측 구간 단축 탐색 (실험)';
assert.equal(URL,'https://dangoo.hananakick.cc/');assert.match(pins.deployedCommit,/^[a-f0-9]{40}$/);assert.match(pins.htmlSha256||'',/^[a-f0-9]{64}$/);assert.match(String(pins.deploymentRunId||''),/^[0-9]+$/);
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const report={schema:'public-cpu-event-window-v7-browser-v1',url:URL,expectedCommit:pins.deployedCommit,deploymentRunId:pins.deploymentRunId,htmlSha256:pins.htmlSha256,algorithm:ALGORITHM,chromiumSandbox:true,tlsBypass:false,routeInterception:false,localAssetSubstitution:false,hardwareConcurrencyOverride:null,sourceOrWorkerMutation:false,gpuComputeRequested:false,cases:[],passed:false};
const save=()=>fs.writeFileSync(path.join(OUT,'public-result.json'),JSON.stringify(report,null,2));
let browser,browserServer;
async function open(page){if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();}
async function close(page){if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')==='true')await page.locator('.toolbox-heading').getByRole('button',{name:'설정 패널 닫기',exact:true}).click();}
async function screenshot(page,d,name){
 try{
  const evidence=await waitForPretendard(page,{timeout:10000});
  assert.ok(evidence.stylesheetURLs.includes(PRETENDARD_CSS_URL));
  assert.ok(d.fontResponses.some(r=>r.url===PRETENDARD_CSS_URL&&r.status===200),'Pinned font CSS 200 required');
  assert.ok(d.fontResponses.some(r=>r.type==='font'&&r.status===200&&/\/woff2-dynamic-subset\/PretendardVariable\.subset\.\d+\.woff2$/.test(r.url)),'Actual Korean WOFF2 200 required');
  assert.ok(!d.requestFailures.some(r=>r.url.startsWith(PRETENDARD_CDN_BASE)),'Failed font request');
  d.fontEvidence=evidence;await page.screenshot({path:path.join(OUT,name),fullPage:true});d.screenshots.push({name,qualified:true});save();
 }catch(error){d.screenshots.push({name,skipped:true,reason:String(error.message||error)});save();throw error;}
}
async function boot(scene,game,viewport){
 const page=await browser.newPage({viewport});page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(30000);
 const d={scene,game,viewport,pageErrors:[],consoleErrors:[],requestFailures:[],httpErrors:[],fontResponses:[],workers:[],screenshots:[],passed:false};report.cases.push(d);save();
 page.on('pageerror',e=>d.pageErrors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')d.consoleErrors.push({text:m.text(),location:m.location()});});
 page.on('requestfailed',r=>d.requestFailures.push({url:r.url(),failure:r.failure()}));
 page.on('response',r=>{if(r.url().startsWith(PRETENDARD_CDN_BASE))d.fontResponses.push({url:r.url(),status:r.status(),type:r.request().resourceType()});if(r.status()>=400)d.httpErrors.push({url:r.url(),status:r.status()});});
 page.on('worker',w=>d.workers.push({url:w.url(),createdAt:Date.now()}));
 try{
  const started=Date.now(),response=await page.goto(URL);assert.ok(response&&response.ok());assert.equal(page.url(),URL);
  d.response={url:response.url(),status:response.status(),headers:response.headers(),tls:await response.securityDetails(),htmlSha256:sha(await response.body())};
  assert.equal(d.response.htmlSha256,pins.htmlSha256,'Exact freshly built release HTML');assert.ok(d.response.tls?.protocol,'Normal HTTPS TLS evidence required');
  await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);d.readyMs=Date.now()-started;
  const served=await page.locator('script[id^="source-"]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.id,n.textContent])));
  d.sourceHashes={};assert.deepEqual(Object.keys(served).sort(),Object.keys(pins.inlineScripts).sort(),'Complete inline source inventory');
  for(const [id,text]of Object.entries(served)){d.sourceHashes[id]=sha(text);assert.equal(d.sourceHashes[id],pins.inlineScripts[id],id);}
  d.initial=await page.evaluate(()=>({options:{...cueLab.state.routeOptions},settings:{...cueLab.state.settings},hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory,renderMetrics:cueLab.renderMetrics,engineError:cueLab.state.engineError,renderer:{isFallback:!!cueLab.renderer?.isFallback,workerMode:!!cueLab.renderer?.workerMode}}));
  assert.equal(d.initial.options.searchAlgorithm,'inverse-constraints');assert.equal(d.initial.options.workers,0);assert.ok(d.initial.hardwareConcurrency>0);
  await page.waitForFunction(()=>cueLab.renderMetrics.presentations>0&&cueLab.renderMetrics.frames>0,null,{timeout:5000});
  await open(page);await page.locator('#gameMode').getByRole('button',{name:game==='four'?'4구':'3구',exact:true}).click();await page.locator('#tab-routes').click();d.preAlgorithmOptions=await page.evaluate(()=>({...cueLab.state.routeOptions}));await page.locator('#routeDetails').click();await page.locator('#routeAlgorithm').click();
  for(const name of ['기존 접촉 제약식','이벤트 우선 탐색 (실험)',LABEL])await page.getByRole('option',{name,exact:true}).waitFor({state:'visible'});
  d.algorithmOptions=await page.getByRole('option').allTextContents();await page.getByRole('option',{name:LABEL,exact:true}).click();await page.locator('#closeRouteDetails').click();
  d.options=await page.evaluate(()=>({...cueLab.state.routeOptions}));assert.deepEqual(d.options,{...d.preAlgorithmOptions,searchAlgorithm:ALGORITHM},'Only the UI algorithm choice may change default search conditions');assert.equal(d.options.searchAlgorithm,ALGORITHM);assert.equal(d.options.workers,0);assert.equal(d.options.allowKiss,true);assert.equal(d.options.fourBallThreeCushion,false);assert.equal(d.options.solveTimeMs,20000);
  await page.evaluate(()=>{globalThis.__publicAudit={lab:cueLab.lab,world:cueLab.lab.world,worldStep:cueLab.lab.world.step,game:cueLab.game,gameContact:cueLab.game.contact,settings:JSON.stringify(cueLab.state.settings),bytes:JSON.stringify(Array.from(cueLab.lab.world.takeSnapshot())),shots:cueLab.lab.shots};});
  if(viewport.width<500)assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await screenshot(page,d,scene+'-ready.png');save();return {page,d};
 }catch(error){d.failure=String(error.stack||error);save();await page.close();throw error;}
}
async function invariant(page){return page.evaluate(()=>({sourceWorldUnchanged:cueLab.lab===__publicAudit.lab&&cueLab.lab.world===__publicAudit.world&&cueLab.lab.world.step===__publicAudit.worldStep&&cueLab.game===__publicAudit.game&&cueLab.game.contact===__publicAudit.gameContact&&JSON.stringify(Array.from(cueLab.lab.world.takeSnapshot()))===__publicAudit.bytes,settingsUnchanged:JSON.stringify(cueLab.state.settings)===__publicAudit.settings,shots:cueLab.lab.shots,workers:cueLab.optimizer.workers.length}));}
function checkWorker(result,d){
 assert.equal(result.inputStrategy,ALGORITHM);assert.equal(result.executionMode,'worker');assert.equal(result.workerCount,1);assert.equal(result.workerFallbackReason,null);assert.equal(result.globalOptimal,false);assert.equal(result.exhaustive,false);assert.equal(result.continuable,true);
 const cores=Number.isFinite(Number(d.initial.hardwareConcurrency))&&Number(d.initial.hardwareConcurrency)>0?Math.floor(Number(d.initial.hardwareConcurrency)):2,memory=Number(d.initial.deviceMemory),memoryCap=Number.isFinite(memory)&&memory>0?Math.max(1,Math.floor(memory*1024/2/128)):64;
 assert.equal(result.workerPlan.hardwareConcurrency,cores);assert.equal(result.workerPlan.memoryCap,memoryCap);assert.equal(result.workerPlan.requestedWorkers,1);assert.equal(result.workerPlan.workItems,1);
}
async function waitDone(page){await page.waitForFunction(()=>['done','error'].includes(cueLab.state.routeStatus),null,{timeout:45000});const state=await page.evaluate(()=>({status:cueLab.state.routeStatus,error:cueLab.state.routeError,result:cueLab.state.routeResult}));assert.equal(state.status,'done',state.error);return state.result;}
async function find(page,d){
 const started=Date.now();await page.locator('#findRoute').click();d.result=await waitDone(page);d.searchWallMs=Date.now()-started;
 checkWorker(d.result,d);assert.ok(d.result.results.length>0);assert.equal(d.result.terminationReason,'first-feasible-shot');d.afterSearch=await invariant(page);assert.deepEqual(d.afterSearch,{sourceWorldUnchanged:true,settingsUnchanged:true,shots:0,workers:0});save();
}
async function live(page,d){
 const chosen=d.result.results[0];assert.equal(chosen.success,true);d.chosen=chosen;
 await page.locator('#applyRoute'+chosen.id).click();assert.deepEqual(await page.evaluate(()=>({...cueLab.state.settings})),chosen.settings);assert.equal(await page.evaluate(()=>cueLab.lab.shots),0);
 await page.locator('#tab-shot').click();await page.locator('#tab-settings').click();await page.locator('#tab-routes').click();assert.deepEqual(await page.evaluate(()=>({...cueLab.state.settings})),chosen.settings);
 // Observe events while preserving the original callback and receiver. Never
 // replace world.step, scoring, search sources, Worker, contacts, or settings.
 await page.evaluate(()=>{const lab=cueLab.lab,original=lab.onEvent,selected=cueLab.state.selectedId;globalThis.__publicLive={selected,contacts:[],obstruction:false,offTable:false,opponent:false,worldStep:lab.world.step,originalCallback:original,originalCalls:0,beforeScore:cueLab.game.scores[selected]};lab.onEvent=function(e){if(original){__publicLive.originalCalls++;original.call(this,e);}if(e.kind==='cue-obstruction')__publicLive.obstruction=true;if(e.kind!=='contact'||!e.a||!e.b)return;const other=e.a.id===selected?e.b:e.b.id===selected?e.a:null;if(!other)return;if(other.kind==='floor')__publicLive.offTable=true;if(cueLab.state.gameMode==='four'&&cueLab.game.cueIds.includes(other.id)&&other.id!==selected)__publicLive.opponent=true;if(other.kind==='cushion'||other.id!=null)__publicLive.contacts.push({kind:other.kind==='cushion'?'cushion':'object',id:other.id??null,rail:LabRouteRules.railId(other),time:e.time});};});
 await close(page);const started=Date.now();await page.locator('#strike').click();await page.waitForFunction(()=>cueLab.lab.shots===1&&!cueLab.lab.cue&&!cueLab.game.pending&&cueLab.lab.objects.every(o=>o.body.isSleeping()),null,{timeout:60000});d.liveWallMs=Date.now()-started;
 d.live=await page.evaluate(shot=>{const x=__publicLive,end=x.contacts.findIndex(c=>c.kind==='object'&&c.id===shot.secondId),contacts=end<0?x.contacts:x.contacts.slice(0,end+1);return{contacts,allContactsThroughRest:x.contacts,rule:LabRouteRules.evaluate(contacts,{method:shot.method,firstId:shot.firstId,secondId:shot.secondId,minCushions:cueLab.state.gameMode==='four'?0:3}),beforeScore:x.beforeScore,score:cueLab.game.scores[x.selected],activeCue:cueLab.game.activeCue,selected:x.selected,fullRest:!cueLab.lab.cue&&!cueLab.game.pending&&cueLab.lab.objects.every(o=>o.body.isSleeping()),nativeWorldUnchanged:cueLab.lab===__publicAudit.lab&&cueLab.lab.world===__publicAudit.world&&cueLab.lab.world.step===__publicAudit.worldStep&&cueLab.lab.world.step===x.worldStep&&cueLab.game===__publicAudit.game&&cueLab.game.contact===__publicAudit.gameContact,originalCalls:x.originalCalls,obstruction:x.obstruction,offTable:x.offTable,opponent:x.opponent,shots:cueLab.lab.shots,settings:{...cueLab.state.settings},seconds:cueLab.lab.time};},chosen);
 assert.equal(d.live.beforeScore,0);assert.equal(d.live.score,1);assert.equal(d.live.activeCue,d.live.selected);assert.equal(d.live.fullRest,true);assert.equal(d.live.nativeWorldUnchanged,true);assert.equal(d.live.rule.success,true);assert.equal(d.live.obstruction,false);assert.equal(d.live.offTable,false);assert.equal(d.live.opponent,false);assert.ok(d.live.originalCalls>0);assert.equal(d.live.shots,1);assert.deepEqual(d.live.settings,chosen.settings);
 const normalize=e=>e.kind==='object'?{kind:e.kind,id:e.id,time:e.time}:{kind:e.kind,rail:e.rail||({'오른쪽 쿠션':'x+','왼쪽 쿠션':'x-','앞쪽 쿠션':'z+','뒤쪽 쿠션':'z-'}[e.label]),time:e.time};
 const predicted=chosen.contacts.map(normalize),actual=d.live.contacts.map(normalize);assert.equal(predicted.length,actual.length);for(let i=0;i<predicted.length;i++){assert.equal(predicted[i].kind,actual[i].kind);assert.equal(predicted[i].id,actual[i].id);assert.equal(predicted[i].rail,actual[i].rail);assert.ok(Math.abs(predicted[i].time-actual[i].time)<1e-8);}
 await page.evaluate(()=>{cueLab.lab.onEvent=__publicLive.originalCallback;});await screenshot(page,d,d.scene+'-score.png');
}
function checkDiagnostics(d){for(const key of ['pageErrors','consoleErrors','requestFailures','httpErrors'])assert.deepEqual(d[key],[],key);d.passed=true;save();}
async function controls(page,d){
 const started=Date.now();await page.locator('#findRoute').click();assert.equal(await page.evaluate(()=>cueLab.state.routeStatus),'searching');await page.locator('#cancelRoute').click();d.cancelled=await waitDone(page);d.cancelMs=Date.now()-started;d.cancelInvariant=await invariant(page);assert.deepEqual(d.cancelInvariant,{sourceWorldUnchanged:true,settingsUnchanged:true,shots:0,workers:0});
 assert.equal(await page.locator('#resumeSearch').count(),1);await page.locator('#resumeSearch').click();d.resumed=await waitDone(page);assert.ok(d.resumed.results.length);checkWorker(d.resumed,d);assert.deepEqual(await invariant(page),d.cancelInvariant);
 const identity=await page.evaluate(()=>LabRouteRules.successIdentity(cueLab.state.routeResult.results[0]));await page.locator('#resumeSearch').click();await page.locator('#cancelRoute').click();await waitDone(page);d.preservedAfterResumeCancel=await page.evaluate(id=>cueLab.state.routeResult.results.some(r=>LabRouteRules.successIdentity(r)===id),identity);assert.equal(d.preservedAfterResumeCancel,true);assert.deepEqual(await invariant(page),d.cancelInvariant);
 await page.locator('#findRoute').click();await page.locator('#tab-shot').click();d.statusBeforeInputChange=await page.evaluate(()=>cueLab.state.routeStatus);assert.equal(d.statusBeforeInputChange,'searching');await page.locator('#angle').fill('17.23');await page.locator('#angle').press('Tab');await page.waitForFunction(()=>cueLab.state.routeStatus!=='searching');
 const state=()=>page.evaluate(()=>({status:cueLab.state.routeStatus,angle:cueLab.state.settings.angle,version:cueLab.optimizer.version,workers:cueLab.optimizer.workers.length,shots:cueLab.lab.shots}));d.inputChanged=await state();assert.equal(d.inputChanged.angle,17.23);assert.equal(d.inputChanged.workers,0);assert.equal(d.inputChanged.shots,0);assert.notEqual(d.inputChanged.status,'error');await page.waitForTimeout(1200);d.afterLateWorkerWindow=await state();assert.deepEqual(d.afterLateWorkerWindow,d.inputChanged);
 await page.locator('#tab-routes').click();if(await page.locator('#resumeSearch').count()){await page.locator('#resumeSearch').click();assert.notEqual(await page.evaluate(()=>cueLab.state.routeStatus),'searching','Changed inputs cannot resume stale work');}assert.equal((await invariant(page)).sourceWorldUnchanged,true);await screenshot(page,d,d.scene+'-input-change.png');
}
async function main(){
 browserServer=await chromium.launchServer({channel:'chrome',headless:true,chromiumSandbox:true});const pid=browserServer.process().pid,stat=fs.readFileSync('/proc/'+pid+'/stat','utf8').split(') ')[1].split(' ');fs.writeFileSync(path.join(OUT,'browser-owned-pid.json'),JSON.stringify({pid,starttime:stat[19]}));
 report.browserCommand=fs.readFileSync('/proc/'+pid+'/cmdline','utf8').split('\0').filter(Boolean);for(const arg of report.browserCommand)assert.ok(!/^--(?:no-sandbox|disable-setuid-sandbox|ignore-certificate-errors|disable-web-security|allow-running-insecure-content)(?:=|$)/.test(arg),'Security override forbidden: '+arg);
 browser=await chromium.connect(browserServer.wsEndpoint());report.browserVersion=browser.version();save();
 for(const item of [{scene:'default-three',game:'three',viewport:{width:1440,height:900}},{scene:'default-four',game:'four',viewport:{width:1440,height:900}},{scene:'mobile-controls-four',game:'four',viewport:{width:390,height:844}}]){
  const {page,d}=await boot(item.scene,item.game,item.viewport);try{if(item.scene.startsWith('mobile'))await controls(page,d);else{await find(page,d);await live(page,d);}checkDiagnostics(d);console.log(JSON.stringify({scene:d.scene,passed:true,searchMs:d.searchWallMs,liveMs:d.liveWallMs,score:d.live?.score}));}
  catch(error){d.failure=String(error.stack||error);d.failureState=await page.evaluate(()=>({status:globalThis.cueLab?.state.routeStatus,error:globalThis.cueLab?.state.routeError,result:globalThis.cueLab?.state.routeResult,progress:globalThis.cueLab?.state.routeProgress})).catch(()=>null);save();throw error;}finally{await page.close();}
 }
 report.passed=true;save();
}
main().catch(error=>{report.failure=String(error.stack||error);save();console.error(report.failure);process.exitCode=1;}).finally(async()=>{await browser?.close();await browserServer?.close();});
