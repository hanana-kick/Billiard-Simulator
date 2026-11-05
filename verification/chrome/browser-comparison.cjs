'use strict';
// Real-app Chrome comparison. Never runs on import; explicit release gates required.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const HERE=__dirname;
const sha=x=>crypto.createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
function atomic(file,value){const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n');fs.renameSync(temp,file);}
const recipes=[
 {name:'new-post-three-default',mode:'free',settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0}},
 {name:'new-post-three-shifted',mode:'free',moves:[[2,.17,.16]],settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0}},
 {name:'new-post-four-swapped',mode:'four',swap:true,settings:{angle:90,elevation:8,speed:.8,tipX:0,tipY:0}},
 {name:'new-post-four-offset',mode:'four',moves:[[1,-.60,.16],[2,.24,-.05],[3,.82,-.28],[4,.61,.34]],settings:{angle:90,elevation:8,speed:.8,tipX:0,tipY:0}}
];
const cells=[...recipes.map(recipe=>({recipe,rate:1})),{recipe:recipes[2],rate:.25}];
function makeOrder(mode='pacing'){
 if(!['pacing','precompute'].includes(mode))throw Error('MODE must be pacing or precompute');
 const arms=mode==='pacing'?[{arm:'baseline',enabled:true},{arm:'candidate',enabled:true}]:[{arm:'off',enabled:false},{arm:'on',enabled:true}];
 const order=[];for(let repeat=0;repeat<4;repeat++)for(let ci=0;ci<cells.length;ci++)for(const arm of repeat%2?[...arms].reverse():arms)order.push({...cells[ci],repeat:repeat+1,...arm,pair:`${ci}-${repeat+1}`});return order;
}
const mode=process.env.MODE||'pacing',order=makeOrder(mode);
const metricKeys=['setupToFireMs','aimingMs','predictionMs','fireToRestMs','restToRouteMs','fireToRouteMs','replayToRestMs'];
function localURL(value){const url=new URL(value);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!['http:','https:'].includes(url.protocol))throw Error('Only local test application allowed');return String(url);}
function buildInfo(root,url){
 const html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
 const manifestPath=path.join(root,'precompute-integration-manifest.json');
 // Candidate manifests can describe the frozen precursor; do not mislabel their old index hash as a fresh build attestation.
 const inheritedManifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):null;
 const sourceHashes={};function scan(relative=''){for(const file of fs.readdirSync(path.join(root,'src',relative)).sort()){const key=path.posix.join(relative,file),full=path.join(root,'src',key);if(fs.statSync(full).isDirectory())scan(key);else sourceHashes[key]=sha(fs.readFileSync(full));}}scan();
 return {root,url:localURL(url),htmlSHA256:sha(html),sourceHashes,inheritedManifest,inheritedManifestIndexMatches:inheritedManifest?.compiledIndexSHA256===sha(html)};
}
function chromePath(){const candidates=[process.env.CHROME_PATH,process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/opt/google/chrome/chrome','/usr/bin/chromium'];const found=candidates.find(p=>p&&fs.existsSync(p));if(!found)throw Error('Preinstalled Chrome not found; set CHROME_PATH. No download or no-sandbox fallback.');return found;}
const limits={navigation:60000,ready:60000,prediction:60000,rest:180000,routeAfterRest:180000,replay:180000};
async function run(){
 if(process.env.CPU_WINDOW_RELEASED!=='yes'||process.env.BOUNDED_CANDIDATE_PASSED!=='yes')throw Error('Parent must explicitly release CPU window AND approve bounded candidate before running');
 const out=path.resolve(process.env.OUT_DIR||path.join(HERE,'raw-'+new Date().toISOString().replaceAll(':','-')));fs.mkdirSync(out,{recursive:false});
 const appRoot=path.resolve(process.env.APP_ROOT||path.join(HERE,'frozen/precompute-repeat-plan/integrated-app'));
 const baselineRoot=path.resolve(process.env.BASELINE_ROOT||appRoot);
 if(mode==='pacing'&&!process.env.CANDIDATE_ROOT)throw Error('CANDIDATE_ROOT is required for pacing comparison');
 const baseline=buildInfo(baselineRoot,process.env.BASELINE_URL||process.env.APP_URL||'http://127.0.0.1:8793/');
 const candidate=mode==='pacing'?buildInfo(path.resolve(process.env.CANDIDATE_ROOT),process.env.CANDIDATE_URL||'http://127.0.0.1:8794/'):baseline;
 if(mode==='pacing'&&(baseline.root===candidate.root||baseline.htmlSHA256===candidate.htmlSHA256))throw Error('Pacing comparison requires distinct baseline and candidate builds');
 if(mode==='pacing'){
  if(baseline.sourceHashes['optimizer-service.js']!=='bb5077c421629bda7e8871b41e6213d1753967cd92aaad3bb1f9bcbfd719edf9'||candidate.sourceHashes['optimizer-service.js']!=='e0258591997e15531f7dfe310fa81557904cc9f9f2589abc082b0321d8850ae2')throw Error('Unexpected optimizer baseline/candidate source hash');
  for(const file of new Set([...Object.keys(baseline.sourceHashes),...Object.keys(candidate.sourceHashes)]))if(file!=='optimizer-service.js'&&baseline.sourceHashes[file]!==candidate.sourceHashes[file])throw Error('Uncontrolled per-arm source difference: '+file);
 }
 const arms=mode==='pacing'?{baseline,candidate}:{off:baseline,on:baseline};
 const executablePath=chromePath();
 const manifest={kind:mode==='pacing'?'frozen-integrated-vs-private-pacing-both-precompute-on':'frozen-integrated-precompute-off-on',mode,limits,order,arms,dependencyRoot:appRoot,executablePath,chromiumSandbox:true,node:process.version,playwright:require(path.join(appRoot,'node_modules/playwright/package.json')).version,baselineLabel:mode==='pacing'?'Frozen integrated application (not pristine main)':'Selected integrated build with precompute off (not pristine main)',coldPolicy:'Fresh sandboxed Chrome process and context per attempt; no discarded warmups. OS filesystem cache uncontrolled. First-shot prediction must be ready in both conditions.',aimingPolicy:'Browser launch, navigation, readiness, configuration, prediction and fire timestamps retained. Precompute option set before mount.'};atomic(path.join(out,'manifest.json'),manifest);
 const {chromium}=require(path.join(appRoot,'node_modules/playwright'));const rows=[];
 for(const [index,spec]of order.entries()){
  const build=arms[spec.arm].root,url=arms[spec.arm].url,html=fs.readFileSync(path.join(build,'dist/index.html'),'utf8');
  const row={index,...spec,build:arms[spec.arm],stage:'launch',status:'running',startedAt:new Date().toISOString(),errors:[],timeouts:[],checkpoints:[]};const file=path.join(out,`${String(index+1).padStart(2,'0')}-${spec.recipe.name}-${spec.arm}.json`);const persist=()=>atomic(file,row);persist();let browser,page;
  try{
   const launch=performance.now();browser=await chromium.launch({executablePath,headless:true,chromiumSandbox:true});row.browserLaunchMs=performance.now()-launch;row.browserVersion=browser.version();
   const context=await browser.newContext({viewport:{width:1440,height:900}});page=await context.newPage();
   page.on('pageerror',e=>{row.errors.push({kind:'pageerror',message:e.message});persist();});page.on('console',m=>{if(m.type()==='error'){row.errors.push({kind:'console',message:m.text(),location:m.location()});persist();}});page.on('requestfailed',r=>{row.errors.push({kind:'network',url:r.url(),message:r.failure()?.errorText});persist();});page.on('crash',()=>{row.errors.push({kind:'crash'});persist();});
   await page.exposeBinding('__checkpoint',(_,data)=>{row.checkpoints.push(data);persist();});
   await page.addInitScript(({enabled})=>{
    const boot=globalThis.__benchBoot={workers:[],workerMessages:[],start:performance.now()};const NativeWorker=globalThis.Worker;
    globalThis.Worker=class extends NativeWorker{constructor(...args){super(...args);const id=boot.workers.length;boot.workers.push({id,at:performance.now(),url:String(args[0])});this.addEventListener('error',e=>boot.workerMessages.push({id,at:performance.now(),error:e.message}));this.addEventListener('message',e=>{if(boot.workerMessages.length<1000)boot.workerMessages.push({id,at:performance.now(),type:e.data?.type});});}};
    // Set the requested app option before mount; off must not pay for an accidental default-on warm worker.
    Object.defineProperty(globalThis,'LabController',{configurable:true,set(C){Object.defineProperty(globalThis,'LabController',{configurable:true,writable:true,value:new Proxy(C,{construct(target,args,newTarget){const c=Reflect.construct(target,args,newTarget);c.state.nextShotPrecompute=enabled;return c;}})});}});
   },{enabled:spec.enabled});
   row.setupBeforeNavigationMs=performance.now()-launch;row.stage='navigation';const response=await page.goto(String(url),{timeout:limits.navigation});row.servedHTMLSHA256=sha(await response.body());if(row.servedHTMLSHA256!==sha(Buffer.from(html)))throw Error('HTTP compiled index differs from build');
   for(const module of ['inverse-event-window-search','inverse-event-window-adaptive-search','optimizer-service','next-shot-service','controller']){const served=await page.locator('#source-'+module).textContent();(row.servedModules??={})[module]=sha(served.trim());if(served.trim()!==fs.readFileSync(path.join(build,'src',module+'.js'),'utf8').trim())throw Error('Served module differs: '+module);}
   row.stage='app-ready';await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready,null,{timeout:limits.ready});
   await page.evaluate(({recipe,rate,enabled})=>{
    globalThis.__bench={appReadyAt:performance.now(),frames:[],longTasks:[],events:[],phase:'setup'};const b=__bench,c=cueLab;b.cores=navigator.hardwareConcurrency;b.renderMode=c.snapshot().renderMode;
    b.observer=new PerformanceObserver(list=>{for(const e of list.getEntries())b.longTasks.push({at:e.startTime,duration:e.duration});});b.observer.observe({type:'longtask',buffered:true});
    let previous;function frame(t){if(previous!==undefined)b.frames.push({at:t,delta:t-previous,phase:b.phase});previous=t;if(!b.finished)requestAnimationFrame(frame);}requestAnimationFrame(frame);
    c.option('nextShotPrecompute',enabled);c.setGameMode(recipe.mode);
    if(recipe.swap){const a={...c.lab.get(1).body.translation()},d={...c.lab.get(2).body.translation()};if(!c.move(1,{x:-1,y:a.y,z:-.45})||!c.move(2,a)||!c.move(1,d))throw Error('Swap refused');}
    for(const [id,x,z]of recipe.moves||[]){const y=c.lab.get(id).body.translation().y;if(!c.move(id,{x,y,z}))throw Error('Move refused');}
    c.changeSettings(recipe.settings);c.routeOption('searchAlgorithm','cpu-event-window-inverse');c.routeOption('solveTimeMs',20000);c.option('rate',rate);b.configuredAt=performance.now();
    b.predictionReady=new Promise(resolve=>{let unsubscribe,settled=false;const check=()=>{if(settled)return;const f=c.forecastReceipt;if(!c.state.predictionBusy&&f?.result?.rested&&f.result.nextShot&&NextShotState.snapshotEqual(f.request.snapshot,c.lab.snapshot({trails:false}))&&JSON.stringify(f.request.settings)===JSON.stringify(c.state.settings)&&JSON.stringify(f.request.nextShotGame?.snapshot)===JSON.stringify(c.game.snapshot())){b.predictionReadyAt=performance.now();settled=true;unsubscribe?.();resolve(true);}};unsubscribe=c.subscribe(check);if(settled)unsubscribe();else check();});
   },spec);
   row.stage='prediction';await page.evaluate(ms=>Promise.race([__bench.predictionReady,new Promise((_,reject)=>setTimeout(()=>reject(Error('prediction timeout')),ms))]),limits.prediction);
   row.stage='measured-shot';persist();
   await page.evaluate(({enabled,limits})=>{
    const b=__bench,c=cueLab;const copy=x=>structuredClone(x);const snap=()=>c.lab.snapshot({trails:false});const checkpoint=type=>{const data={type,at:performance.now(),routeStatus:c.state.routeStatus,preparation:copy(c.state.nextShotPreparation),fireAt:b.fireAt??null,restAt:b.restAt??null,firstResultAt:b.firstResultAt??null,before:type==='fire'?copy(b.before):undefined,after:type==='full-rest'?copy(b.after):undefined,firstRoute:type==='first-route'?copy(b.firstRoute):undefined,frames:type==='full-rest'?undefined:copy(b.frames),longTasks:type==='full-rest'?undefined:copy(b.longTasks)};b.events.push({type,at:data.at});void __checkpoint(data);};
    b.before={snapshot:snap(),game:c.game.snapshot(),selectedId:c.state.selectedId,settings:copy(c.state.settings),options:copy(c.state.routeOptions)};b.nativeStep=c.lab.world.step;
    b.routeArrival=new Promise(resolve=>b.resolveArrival=resolve);
    b.unsubscribe=c.subscribe(()=>{if(b.restAt!=null&&b.firstResultAt==null&&c.state.routeResult?.results?.length){b.firstResultAt=performance.now();b.firstRoute=copy(c.state.routeResult.results[0]);b.resultAtArrival=copy(c.state.routeResult);b.phase='route-available';checkpoint('first-route');b.resolveArrival(true);}else if(b.restAt!=null&&['error','done'].includes(c.state.routeStatus)&&!c.state.routeResult?.results?.length){b.routeError=c.state.routeError||'no-route: '+(c.state.routeResult?.terminationReason||'done');b.noRouteResult=copy(c.state.routeResult);b.resolveArrival(false);}});
    const finish=c.finishGameShot.bind(c);c.finishGameShot=function(){const physicalRest=!!this.game.pending&&!this.lab.cue&&this.lab.objects.every(o=>o.body.isSleeping());const first=physicalRest&&b.restAt==null;if(first){b.restAt=performance.now();b.phase='post-rest';}finish();if(first){if(!enabled)c.startSearch();const j=c.nextShot.job;b.background=j?{reusedWarmWorker:j.reusedWarmWorker,reusedForecast:j.reusedForecast,suspended:j.suspended,searchStartedAt:j.searchStartedAt,promoted:j.promoted,exact:j.predicted?NextShotState.snapshotEqual(snap(),j.predicted.snapshot):null,progress:copy(j.progress)}:null;checkpoint('full-rest');}};
    b.fireAt=performance.now();b.phase='first-playback';if(!c.fire())throw Error('Manual first fire refused');checkpoint('fire');
   },{enabled:spec.enabled,limits});
   row.stage='first-rest';await page.waitForFunction(()=>__bench.restAt!=null,null,{timeout:limits.rest});
   row.stage='first-route';const arrived=await page.evaluate(ms=>Promise.race([__bench.routeArrival,new Promise((_,reject)=>setTimeout(()=>reject(Error('first-route timeout')),ms))]),limits.routeAfterRest);if(!arrived)throw Error('Route error: '+await page.evaluate(()=>__bench.routeError));
   row.stage='replay';await page.evaluate(()=>{const c=cueLab,b=__bench;const snap=()=>c.lab.snapshot({trails:false}),copy=x=>structuredClone(x);if(c.game.pending||c.lab.cue||!c.lab.objects.every(o=>o.body.isSleeping()))throw Error('Deferred after snapshot requires actual full rest');b.after={snapshot:snap(),game:c.game.snapshot(),selectedId:c.state.selectedId,settings:copy(c.state.settings),options:{...copy(c.state.routeOptions),gameMode:c.state.gameMode,opponentId:c.state.gameMode==='four'?c.game.cueIds.find(id=>id!==c.state.selectedId):null}};if(b.firstRoute.success!==true||!b.firstRoute.contacts?.length)throw Error('First route lacks native success/contacts');const current=c.state.routeResult?.results?.find(r=>r.id===b.firstRoute.id);if(!current||JSON.stringify(current.settings)!==JSON.stringify(b.firstRoute.settings)||JSON.stringify(current.contacts)!==JSON.stringify(b.firstRoute.contacts))throw Error('First route identity changed before application');b.replay={selectedId:c.state.selectedId,score:c.game.scores[c.state.selectedId],shots:c.lab.shots,at:performance.now()};c.option('nextShotPrecompute',false);c.option('rate',1);c.applyRoute(b.firstRoute.id);if(c.state.routeApplied!==b.firstRoute.id||Object.keys(b.firstRoute.settings).some(k=>c.state.settings[k]!==b.firstRoute.settings[k]))throw Error('Route was not applied');b.phase='route-replay';if(!c.fire())throw Error('Verified route replay fire refused');});
   await page.waitForFunction(()=>cueLab.lab.shots===__bench.replay.shots+1&&!cueLab.game.pending&&!cueLab.lab.cue&&cueLab.lab.objects.every(o=>o.body.isSleeping()),null,{timeout:limits.replay});
   await page.evaluate(()=>{const b=__bench,c=cueLab;b.replay.restAt=performance.now();b.replay.scoreDelta=c.game.scores[b.replay.selectedId]-b.replay.score;b.replay.game=c.game.snapshot();b.replay.fullRest=!c.lab.cue&&c.lab.objects.every(o=>o.body.isSleeping());b.replay.nativeStepUnchanged=c.lab.world.step===b.nativeStep;if(b.replay.scoreDelta!==1||!b.replay.nativeStepUnchanged)throw Error('Replay must score exactly +1 with unchanged native stepping');});row.status='passed';
  }catch(e){row.status='failed';row.failure={stage:row.stage,message:e.message,stack:e.stack};if(/timeout/i.test(e.message))row.timeouts.push(row.failure);}
  finally{
   if(page&&!page.isClosed())try{row.raw=await page.evaluate(()=>{const b=globalThis.__bench;if(!b)return{boot:globalThis.__benchBoot};b.finished=true;b.observer?.disconnect();b.unsubscribe?.();const {observer,unsubscribe,predictionReady,routeArrival,resolveArrival,nativeStep,...raw}=b;return{...raw,boot:globalThis.__benchBoot,finalStatus:cueLab.state.routeStatus,finalError:cueLab.state.routeError};});}catch(e){row.collectionError=e.message;}
   const b=row.raw;if(b){row.metrics={setupToFireMs:b.fireAt==null?null:row.setupBeforeNavigationMs+b.fireAt,aimingMs:b.fireAt==null?null:b.fireAt-b.configuredAt,predictionMs:b.predictionReadyAt==null?null:b.predictionReadyAt-b.configuredAt,fireToRestMs:b.restAt==null?null:b.restAt-b.fireAt,restToRouteMs:b.firstResultAt==null?null:b.firstResultAt-b.restAt,fireToRouteMs:b.firstResultAt==null?null:b.firstResultAt-b.fireAt,replayToRestMs:b.replay?.restAt==null?null:b.replay.restAt-b.replay.at};row.framesByPhase=Object.fromEntries(['setup','first-playback','post-rest','route-available','route-replay'].map(phase=>{const values=(b.frames||[]).filter(f=>f.phase===phase).map(f=>f.delta).sort((a,b)=>a-b);const q=p=>values.length?values[Math.min(values.length-1,Math.floor((values.length-1)*p))]:null;return[phase,{count:values.length,over32Ms:values.filter(v=>v>32).length,over50Ms:values.filter(v=>v>50).length,p50:q(.5),p95:q(.95),p99:q(.99),max:q(1)}];}));for(const key of ['before','after'])if(b[key])row[key+'SHA256']=sha(stable(b[key]));}
   const fontURL=u=>/^https:\/\/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard@v1\.3\.9\/(?:packages\/pretendard\/)?dist\/web\/variable\//.test(u||'');for(const e of row.errors)e.verifiedPretendardFetchFailure=['network','console'].includes(e.kind)&&fontURL(e.url||e.location?.url);const workerErrors=row.raw?.boot?.workerMessages?.filter(m=>m.error)||[];row.errorClassification={allErrors:row.errors.length+workerErrors.length,verifiedPretendardFetchFailures:row.errors.filter(e=>e.verifiedPretendardFetchFailure).length,otherErrors:row.errors.filter(e=>!e.verifiedPretendardFetchFailure).length+workerErrors.length};row.runtimeCorrect=row.status==='passed'&&row.errorClassification.otherErrors===0;if(row.errorClassification.allErrors){row.status='failed';row.errorGateFailed=true;}
   row.finishedAt=new Date().toISOString();persist();rows.push(row);try{await browser?.close();}catch(e){row.closeError=e.message;row.status='failed';row.runtimeCorrect=false;persist();}atomic(path.join(out,'summary.json'),summarize(rows,order.length));console.log(JSON.stringify({attempt:index+1,planned:order.length,arm:spec.arm,recipe:spec.recipe.name,repeat:spec.repeat,rate:spec.rate,status:row.status,stage:row.stage,metrics:row.metrics??null,failure:row.failure?.message??row.closeError??(row.errorGateFailed?'runtime/network error gate':null)}));
  }
 }
 const summary=summarize(rows,order.length);console.log(JSON.stringify({out,...summary},null,2));if(!summary.allGatesPassed)process.exitCode=1;
}
function summarize(rows,planned){
 const pairs={};for(const row of rows)(pairs[row.pair]??=[]).push(row);
 const pairChecks=Object.entries(pairs).map(([pair,r])=>({pair,complete:r.length===2,beforeExact:r.length===2&&!!r[0].beforeSHA256&&r[0].beforeSHA256===r[1].beforeSHA256,afterExact:r.length===2&&!!r[0].afterSHA256&&r[0].afterSHA256===r[1].afterSHA256}));
 const armNames=mode==='pacing'?['baseline','candidate']:['off','on'];
 const groups=[];for(const cell of cells)for(const arm of armNames){
  const r=rows.filter(x=>x.recipe.name===cell.recipe.name&&x.rate===cell.rate&&x.arm===arm);const metrics={};
  for(const key of metricKeys){const values=r.map(x=>x.metrics?.[key]).filter(x=>typeof x==='number'&&Number.isFinite(x)).sort((a,b)=>a-b);const mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;metrics[key]={observed:values.length,missing:r.length-values.length,mean,sampleSD:values.length>1?Math.sqrt(values.reduce((sum,v)=>sum+(v-mean)**2,0)/(values.length-1)):null,min:values[0]??null,max:values.at(-1)??null,values};}
  groups.push({recipe:cell.recipe.name,rate:cell.rate,arm,attempts:r.length,passed:r.filter(x=>x.status==='passed').length,runtimeCorrect:r.filter(x=>x.runtimeCorrect).length,failed:r.filter(x=>x.status!=='passed').length,metrics});
 }
 const pairedDifferences=Object.entries(pairs).map(([pair,r])=>{const control=r.find(x=>x.arm===armNames[0]),treatment=r.find(x=>x.arm===armNames[1]);return{pair,direction:armNames[1]+' minus '+armNames[0],controlStatus:control?.status,treatmentStatus:treatment?.status,metrics:Object.fromEntries(metricKeys.map(k=>[k,Number.isFinite(treatment?.metrics?.[k])&&Number.isFinite(control?.metrics?.[k])?treatment.metrics[k]-control.metrics[k]:null]))};});
 return{mode,pairedDifferences,identityScope:'reconstructed effective snapshot/game/options, not intercepted optimizer requests',planned,attempted:rows.length,complete:rows.length===planned,allGatesPassed:rows.length===planned&&rows.every(r=>r.status==='passed'&&r.runtimeCorrect)&&pairChecks.every(p=>p.complete&&p.beforeExact&&p.afterExact),passed:rows.filter(x=>x.status==='passed').length,runtimeCorrect:rows.filter(x=>x.runtimeCorrect).length,failed:rows.filter(x=>x.status!=='passed').length,pairChecks,groups,caveat:'All attempts retained. Finite-latency means include observed failures; missing outcomes/timeouts and failure counts must accompany means. No benefit conclusion valid if identity or replay gates fail. Replay measures native physical score at full rest; font/network errors remain visible and fail strict error gate.'};
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={recipes,cells,order,makeOrder,summarize,buildInfo};
