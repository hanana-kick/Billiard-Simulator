'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {execFileSync,execFile}=require('node:child_process');
const execFileAsync=require('node:util').promisify(execFile);
const {createHash}=require('node:crypto');
const {waitForPretendard}=require('../e2e/font-helper.cjs');

// Live UI diagnostic: no fixture-seeded state, CPU execution fallback, forced GC,
// Worker debugger pause, or injected shader. Numeric coverage is deliberately
// limited to preset outcome expectations and exact Undo/Redo state preservation.
// Full independent CPU all-word parity is a separate gate.
test('live Worker search → strike → N3+N1 → cancellation → restart',async({page,browser},testInfo)=>{
 const output=testInfo.outputPath('lifecycle.json'),events=testInfo.outputPath('events.jsonl');
 fs.mkdirSync(testInfo.outputDir,{recursive:true});
 const evidence={schema:'worker-lifecycle-diagnostic-v1',startedAt:new Date().toISOString(),pass:false,
  classification:'in-progress',physicalHardwareVerified:false,fullNumericalParity:false,fullUIQualification:false,
  stages:[],pageErrors:[],consoleErrors:[],crashes:[],browserVersion:browser.version()};
 const save=()=>fs.writeFileSync(output,JSON.stringify(evidence,null,2));
 const record=(kind,data={})=>fs.appendFileSync(events,JSON.stringify({at:new Date().toISOString(),kind,...data})+'\n');
 const stage=name=>{evidence.stage=name;evidence.stages.push({name,at:new Date().toISOString()});save();record('stage',{name});};
 const hostMemory=()=>{if(process.platform==='darwin'){try{return {vm_stat:execFileSync('/usr/bin/vm_stat',[],{encoding:'utf8',timeout:3000})};}catch(error){return {vm_stat:{unavailable:error.code??error.message}};}}const files=['/proc/meminfo','/proc/self/cgroup','/sys/fs/cgroup/memory.events','/sys/fs/cgroup/memory.current','/sys/fs/cgroup/memory.max'];return Object.fromEntries(files.map(file=>{try{return [file,fs.readFileSync(file,'utf8')];}catch(error){return [file,{unavailable:error.code}];}}));};
 evidence.hostMemoryBefore=hostMemory();
 let monitor,memoryMonitor;
 const cdp=await browser.newBrowserCDPSession();
 const targets=new Map();
 const targetInfo=(kind,info)=>{targets.set(info.targetId,info);record(kind,{target:info});};
 cdp.on('Target.targetCreated',event=>targetInfo('target-created',event.targetInfo));
 cdp.on('Target.targetInfoChanged',event=>targetInfo('target-info-changed',event.targetInfo));
 cdp.on('Target.targetDestroyed',event=>record('target-destroyed',{...event,target:targets.get(event.targetId)??null}));
 cdp.on('Target.targetCrashed',event=>{const crash={...event,target:targets.get(event.targetId)??null};evidence.crashes.push(crash);record('target-crash',crash);save();});
 await cdp.send('Target.setDiscoverTargets',{discover:true});
 for(const info of (await cdp.send('Target.getTargets')).targetInfos)targetInfo('target-initial',info);
 let memoryBusy=false;
 const sampleProcesses=async()=>{if(memoryBusy)return;memoryBusy=true;try{
  const {processInfo}=await cdp.send('SystemInfo.getProcessInfo');
  const processes=await Promise.all(processInfo.map(async info=>{const row={pid:info.id,type:info.type,cpuTime:info.cpuTime};try{if(process.platform==='darwin'){if(!Number.isSafeInteger(info.id)||info.id<=0)throw Error('Invalid process ID');const {stdout}=await execFileAsync('/bin/ps',['-o','rss=','-p',String(info.id)],{encoding:'utf8',timeout:3000});const rss=stdout.trim();if(!/^\d+$/.test(rss))throw Error('RSS unavailable');row.rssKiB=Number(rss);row.rssSource='ps';return row;}const status=fs.readFileSync('/proc/'+info.id+'/status','utf8');const match=/^VmRSS:\s+(\d+)\s+kB$/m.exec(status);row.rssKiB=match?Number(match[1]):null;if(!match)row.rssUnavailable='VmRSS absent';}catch(error){row.rssUnavailable=error.code??error.message;}return row;}));
  const aggregateRSSKiB=processes.reduce((n,row)=>n+(row.rssKiB??0),0);
  const sample={stage:evidence.stage,processes,aggregateRSSKiB,rssComplete:processes.every(row=>row.rssKiB!==undefined&&row.rssKiB!==null)};
  evidence.latestProcessMemory=sample;evidence.peakAggregateRSSKiB=Math.max(evidence.peakAggregateRSSKiB??0,aggregateRSSKiB);
  record('process-memory',sample);
 }catch(error){record('process-memory-unavailable',{message:error.message});}finally{memoryBusy=false;}};
 await sampleProcesses();memoryMonitor=setInterval(()=>{void sampleProcesses();},1000);
 page.on('crash',()=>{evidence.crashes.push({kind:'page-crash'});save();});
 page.on('pageerror',error=>{evidence.pageErrors.push(error.message);record('page-error',{message:error.message});save();});
 page.on('console',message=>{if(message.text().startsWith('LIFECYCLE '))record('worker',JSON.parse(message.text().slice(10)));else if(message.type()==='error')evidence.consoleErrors.push(message.text());});
 await page.addInitScript(()=>{
  const p=globalThis.__lifecycle={stage:'load',workers:[],mainDeviceRequests:0,mainFetches:[],executionCount:0,lastExecution:null,compact:[],cancelClicks:[]};
  const emit=data=>console.log('LIFECYCLE '+JSON.stringify(data));
  const originalFetch=fetch;globalThis.fetch=function(...args){p.mainFetches.push(String(args[0]?.url??args[0]));return originalFetch.apply(this,args);};
  if(navigator.gpu){const request=navigator.gpu.requestAdapter.bind(navigator.gpu);navigator.gpu.requestAdapter=async(...args)=>{const adapter=await request(...args);if(adapter){const device=adapter.requestDevice.bind(adapter);adapter.requestDevice=(...args)=>{p.mainDeviceRequests++;return device(...args);};}return adapter;};}
  const NativeWorker=Worker;
  globalThis.Worker=class extends NativeWorker{
   constructor(...args){super(...args);const row={index:p.workers.length+1,requests:[],acks:[],terminated:false};p.workers.push(row);
    const post=this.postMessage.bind(this);this.postMessage=(message,...rest)=>{if(message?.v===1){row.requests.push({id:message.id,op:message.op,program:message.program,width:message.width,stage:p.stage});emit({kind:'request',worker:row.index,id:message.id,op:message.op,program:message.program,width:message.width});}return post(message,...rest);};
    this.addEventListener('message',({data:m})=>{if(m?.v!==1)return;
     if(m.event==='execution'){p.executionCount++;p.lastExecution={worker:row.index,id:m.id,active:true,detail:m.detail};}
     if(m.event==='boot-error'||m.event==='lost')emit({kind:m.event,worker:row.index,error:m.error,detail:m.detail});
     if(m.op==='run'&&!m.event){p.lastExecution={...p.lastExecution,active:false};if(m.ok&&m.result instanceof Uint32Array){const request=row.requests.find(r=>r.id===m.id);p.compact.push({stage:request?.stage,words:Array.from(m.result)});}const selected=m.ok&&m.result?.world instanceof Uint32Array&&m.result?.trace instanceof Uint32Array?{worldLength:m.result.world.length,world:Array.from(m.result.world.slice(0,2916)),traceLength:m.result.trace.length,traceHeader:Array.from(m.result.trace.slice(0,64))}:undefined;emit({kind:'run-reply',worker:row.index,id:m.id,ok:m.ok,error:m.error,selected});}
     if(m.op==='dispose'){row.acks.push({ok:m.ok,drained:m.drained,disposed:m.disposed,destroyed:m.destroyed,ownedBytes:m.ownedBytes});emit({kind:'dispose-ack',worker:row.index,...row.acks.at(-1)});}
    });
    const terminate=this.terminate.bind(this);this.terminate=()=>{row.terminated=true;emit({kind:'terminate',worker:row.index,ack:row.acks.at(-1)});return terminate();};
   }
  };
  document.addEventListener('click',event=>{if(event.target.closest?.('#cancelRoute'))p.cancelClicks.push({execution:structuredClone(p.lastExecution),status:globalThis.cueLab?.state.routeStatus,phase:globalThis.cueLab?.state.routeProgress?.phase});},true);
 });
 const observe=()=>page.evaluate(()=>({status:cueLab.state.routeStatus,error:cueLab.state.routeError,result:cueLab.state.routeResult,progress:cueLab.state.routeProgress,canonical:cueLab.state.canonicalPlayback,probe:__lifecycle}));
 const begin=async name=>{stage(name);await page.evaluate(name=>{__lifecycle.stage=name;},name);};
 const search=async(name,count,found,batchWidths)=>{
  await begin(name);await page.locator('#findRoute').click();
  await page.waitForFunction(()=>['done','error','stale'].includes(cueLab.state.routeStatus),null,{timeout:600000});
  const row=await observe();evidence[name]=row;save();
  expect(row.status,row.error).toBe('done');expect(row.result).toMatchObject({tested:count,evaluated:count,found,miss:count-found,incomplete:0,unsupported:0});
  expect(row.result.batchWidths).toEqual(batchWidths);
  const packets=row.probe.compact.filter(x=>x.stage===name).flatMap(x=>Array.from({length:x.words.length/4},(_,i)=>x.words.slice(i*4,i*4+4)));
  expect(packets).toHaveLength(count);expect(new Set(packets.map(x=>x[0])).size).toBe(count);
  // Preset regression expectations, not newly computed CPU reference evidence.
  expect(packets.map(x=>x.slice(1))).toEqual(Array.from({length:count},()=>found?[1,0,1]:[2,1,0]));
  return row;
 };
 try{
  stage('load');await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
  const manifest=await (await page.request.get('./canonical-controller-assets/manifest.json')).json();
  expect(manifest.searchSourceRevision).toBe('90ad6636d8768b56cb4e93153d1762d3594c6652ad4ae12da283d1249dd1d16f');
  expect(manifest.searchSourceSealed).toBe(true);expect(manifest.sharedSourceBytesVerified).toBe(true);
  const bundle=await page.request.get('./canonical-controller-assets/canonical-controller.mjs');expect(bundle.ok()).toBe(true);
  expect(createHash('sha256').update(await bundle.body()).digest('hex')).toBe(manifest.sha256);
  const workerBootstrap=manifest.wasmGpuWorkerBootstrap;
  expect(workerBootstrap?.file).toBe('wasm-gpu-compute-worker.mjs');
  const workerAsset=await page.request.get('./canonical-controller-assets/'+workerBootstrap.file);expect(workerAsset.ok()).toBe(true);
  expect(createHash('sha256').update(await workerAsset.body()).digest('hex')).toBe(workerBootstrap.sha256);
  evidence.manifest=manifest;save();
  stage('activate');await page.locator('#startCanonicalPractice').click();await page.locator('#confirmCanonicalPractice').click();
  await page.waitForFunction(()=>!!cueLab.canonicalPlayback||!!document.querySelector('#canonicalPracticeError'),null,{timeout:60000});
  const activation=await page.evaluate(()=>({active:!!cueLab.canonicalPlayback,error:document.querySelector('#canonicalPracticeError')?.textContent}));
  evidence.activation=activation;save();expect(activation.active,activation.error||'Worker WebGPU activation failed').toBe(true);
  monitor=setInterval(()=>{void observe().then(snapshot=>{evidence.latest=snapshot;save();}).catch(error=>{record('observation-error',{message:error.message});});},5000);
  if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
  await page.getByRole('tab',{name:'경로 탐색',exact:true}).click();
  const cold=await search('cold-nine',9,9,[3,3,3]);
  const initial=await page.evaluate(()=>({game:cueLab.game.snapshot(),grid:structuredClone(cueLab.state.canonicalPlayback.searchDomain.parameterGrid)}));
  const chosen=cold.result.results[0];
  // Exact shot used in the preceding passive UI regression. Do not silently
  // apply +1/active-cue expectations to a differently ordered search result.
  expect(chosen.settings).toMatchObject({angle:-2,speed:0.5,elevation:25,tipX:0,tipY:0.2});
  evidence.selectedShotSettings=chosen.settings;save();await page.locator('#applyRoute'+chosen.id).click();
  expect(await page.evaluate(()=>cueLab.state.settings)).toEqual(chosen.settings);
  await begin('manual-strike');if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')==='true')await page.locator('.toolbox-heading').getByRole('button',{name:'설정 패널 닫기',exact:true}).click();
  await page.locator('#strike').click();
  await page.waitForFunction(()=>cueLab.state.canonicalPlayback.phase==='rest'||cueLab.state.canonicalPlayback.phase==='refused',null,{timeout:600000});
  const final=await page.evaluate(()=>({words:Array.from(cueLab.canonicalPlayback.readCommittedState()||[]),game:cueLab.game.snapshot(),selectedId:cueLab.state.selectedId,status:cueLab.state.canonicalPlayback}));
  evidence.manual=final;if(final.status.phase==='refused')evidence.refusalObservation=await observe();save();expect(final.words).toHaveLength(256);expect(final.words[1]).toBe(9);
  expect(final.status).toMatchObject({phase:'rest',captureComplete:true,scoreAndTurnCommitted:true});
  expect(final.game.scores).toEqual({'19':0,'50':1});expect(final.selectedId).toBe(50);expect(final.game.pending).toBe(null);
  if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
  await page.getByRole('tab',{name:'경로 탐색',exact:true}).click();
  // Public app API authors grid; world/game are never overwritten with fixtures.
  await page.evaluate(()=>cueLab.updateCanonicalSearchGrid({parameterGrid:{angles:[-2,0],speeds:[.5,.6],elevations:[25],tipXs:[0],tipYs:[.2]}}));
  await search('postshot-four',4,0,[3,1]);
  await page.evaluate(grid=>cueLab.updateCanonicalSearchGrid({parameterGrid:grid}),initial.grid);
  await search('postshot-nine',9,0,[3,3,3]);
  await begin('cancel-in-flight');const before=await page.evaluate(()=>__lifecycle.executionCount);await page.locator('#findRoute').click();
  await page.waitForFunction(before=>cueLab.state.routeStatus==='searching'&&['encoding','submitted','readback'].includes(cueLab.state.routeProgress?.phase)&&__lifecycle.executionCount>before&&__lifecycle.lastExecution?.active,before,{timeout:600000,polling:10});
  await page.locator('#cancelRoute').click();const click=await page.evaluate(()=>__lifecycle.cancelClicks.at(-1));evidence.cancelClick=click;save();
  expect(click.execution?.active,'Click must occur during observed Worker execution, not preparation').toBe(true);
  await page.waitForFunction(()=>cueLab.state.routeStatus==='done'&&cueLab.state.routeProgress?.phase==='stopped',null,{timeout:60000});
  expect((await observe()).error).toBe('');await search('restart-nine',9,0,[3,3,3]);
  await begin('undo-redo');await page.evaluate(()=>{document.activeElement?.blur();document.body.focus();});await page.keyboard.press('ControlOrMeta+z');
  expect(await page.evaluate(()=>cueLab.canonicalPlayback.readCommittedState())).toBe(null);
  expect(await page.evaluate(()=>cueLab.game.snapshot())).toEqual(initial.game);
  await page.keyboard.press('ControlOrMeta+y');expect(await page.evaluate(()=>Array.from(cueLab.canonicalPlayback.readCommittedState()))).toEqual(final.words);
  expect(await page.evaluate(()=>cueLab.game.snapshot())).toEqual(final.game);
  await begin('font-and-final-state');evidence.font=await waitForPretendard(page);
  await page.screenshot({path:testInfo.outputPath('final.png'),fullPage:true});
  evidence.probe=await page.evaluate(()=>__lifecycle);expect(evidence.probe.mainDeviceRequests).toBe(0);
  expect(evidence.probe.mainFetches.filter(url=>url.includes('wasm-gpu-programs/')&&!/\/(manifest\.json|input-[^/]+\.json)(?:\?|$)/.test(url))).toEqual([]);
  for(const worker of evidence.probe.workers.filter(w=>w.terminated&&w.requests.some(r=>r.op==='prepare')))
   expect(worker.acks.at(-1)).toMatchObject({ok:true,drained:true,disposed:true,destroyed:true,ownedBytes:0});
  expect(evidence.pageErrors).toEqual([]);expect(evidence.crashes).toEqual([]);
  evidence.pass=true;evidence.classification='lifecycle-pass';stage('passed');
 }catch(error){evidence.error=error.stack;evidence.classification=evidence.crashes.length?'browser-crash':/WebGPU|adapter|ten storage|activation/i.test(error.message)?'capability-or-activation-failure':/Timeout|timeout/i.test(error.message)?'timeout':'assertion-or-runtime-failure';save();throw error;}
 finally{clearInterval(monitor);clearInterval(memoryMonitor);await sampleProcesses();evidence.targets=Array.from(targets.values());evidence.hostMemoryAfter=hostMemory();evidence.finishedAt=new Date().toISOString();save();await testInfo.attach('lifecycle-evidence',{path:output,contentType:'application/json'});await cdp.detach().catch(()=>{});}
});
