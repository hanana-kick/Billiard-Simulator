import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {createCanonicalPracticePreset,startCanonicalPracticeInternal,canonicalSearchLossTiming} from '../src/direct-candidate/canonical-practice-entry.mjs';
const require=createRequire(import.meta.url),R=require('../vendor/rapier.cjs');await R.init();globalThis.RAPIER=R;
for(const name of ['math','physics','game-rules','render-cadence','controller'])require('../src/'+name+'.js');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
async function browserEntryHarness(createRuntime,install){
 const {readFile}=await import('node:fs/promises'),{createCanonicalPreparationScope}=await import('../src/direct-candidate/canonical-page-preparation.mjs');
 const source=await readFile(new URL('../src/direct-candidate/canonical-controller-browser-entry.mjs',import.meta.url),'utf8');
 // Evaluate the exact public wrapper against owned host-only dependencies. This
 // creates no public backend injection seam and never imports a GPU executor.
 assert.doesNotMatch(source,/navigator|requestAdapter|\.requestDevice\s*\(|\.destroy\s*\(/);
 const start=source.indexOf('export function startCanonicalPractice(');assert.ok(start>0);
 return new Function('createCanonicalPreparationScope','startCanonicalPracticeInternal','installCanonicalController','createWasmGpuProductionRuntime',source.slice(start).replace('export function','function')+'return startCanonicalPractice;')(createCanonicalPreparationScope,startCanonicalPracticeInternal,install,createRuntime);
}
function fixture(){const c=new LabController();c.lab=new PhysicsLab(R);c.game=new ThreeBallGame();c.state.ready=true;c.notify=()=>{};c.repairRouteTargets=()=>{};c.dispose=()=>{c.disposed=true;c.lab.dispose();};let destroyed=0;const lost=deferred(),device={destroy(){destroyed++;},lost:lost.promise};return {c,device,lost,get destroyed(){return destroyed;},cleanup(){if(!c.disposed)c.dispose();}};}
test('fresh preset authors exact resting bodies on unstepped default table, not current world migration',()=>{const preset=createCanonicalPracticePreset();assert.equal(preset.scene.admitted,true);assert.deepEqual(preset.scene.slotToId,[8,19,50,300]);assert.equal(preset.selectedWorldProfile,'mmq2-cushion');assert.equal(preset.searchOptions.maximumCandidates,4096);for(const body of preset.scene.physical.bodies){assert.equal(body.pos.y,.03075);assert.deepEqual(body.v,{x:0,y:0,z:0});}assert.equal(preset.scene.physical.statics.filter(s=>s.kind==='cushion').length,4);});
test('explicit entry switches fresh game only after device ready; disposal owns exact store/device',async()=>{const f=fixture(),wait=deferred(),original=f.c.game;let options;try{const started=startCanonicalPracticeInternal(f.c,{requestDevice:()=>wait.promise,install(c,o){options=o;const owner={cancel(){}};c.canonicalPlayback=owner;return owner;}});assert.equal(f.c.game,original);wait.resolve(f.device);await started;assert.deepEqual(f.c.game.cueIds,[50,19]);assert.deepEqual(f.c.game.redIds,[8,300]);assert.equal(f.c.state.activePanel,'routes');assert.equal(f.c.state.predict,false);assert.equal(options.selectedWorldProfile,'mmq2-cushion');assert.equal(options.stateStore.capabilities.selectedWorldProfile,'mmq2-cushion');assert.equal(options.searchOptions.parameterGrid.angles.length*options.searchOptions.parameterGrid.speeds.length,9);assert.equal(options.stateStore.readScene().physical.bodies[0].pos.y,.03075);f.c.dispose();assert.equal(f.destroyed,1);assert.throws(()=>options.stateStore.readScene(),/disposed/);}finally{f.cleanup();}});
test('history refusal and double start preserve original state without duplicate device request',async()=>{const f=fixture(),wait=deferred();let requested=0;const args={requestDevice:()=>{requested++;return wait.promise;},install(){throw Error('not reached');}};try{f.c.undoStack=[{}];await assert.rejects(startCanonicalPracticeInternal(f.c,args),/기존 기록/);assert.equal(requested,0);f.c.undoStack=[];const p=startCanonicalPracticeInternal(f.c,args);await assert.rejects(startCanonicalPracticeInternal(f.c,args),/이미/);assert.equal(requested,1);wait.resolve(f.device);await assert.rejects(p,/not reached/);assert.equal(f.destroyed,1);}finally{f.cleanup();}});
test('cancel or edit while device pending cannot replace old game and releases returned device',async()=>{for(const action of ['abort','settings','newgame']){const f=fixture(),wait=deferred(),abort=new AbortController(),old=f.c.game;try{const p=startCanonicalPracticeInternal(f.c,{requestDevice:()=>wait.promise,signal:abort.signal,install(){throw Error('must not install');}});if(action==='abort')abort.abort();if(action==='settings')f.c.state.settings.angle=17;if(action==='newgame')f.c.game=new ThreeBallGame();const expected=f.c.game;wait.resolve(f.device);await assert.rejects(p,/취소|바뀌었습니다/);assert.equal(f.c.game,expected);assert.equal(f.destroyed,1);}finally{f.cleanup();}}});
test('failed installer restores original game/input references and device loss cancels active owner',async()=>{const f=fixture(),original=f.c.game,settings=f.c.state.settings;try{await assert.rejects(startCanonicalPracticeInternal(f.c,{requestDevice:async()=>f.device,install(){throw Error('install failed');}}),/install failed/);assert.equal(f.c.game,original);assert.equal(f.c.state.settings,settings);assert.equal(f.destroyed,1);}finally{f.cleanup();}const g=fixture();let canceled=0;try{await startCanonicalPracticeInternal(g.c,{requestDevice:async()=>g.device,install(c){const owner={cancel(){canceled++;}};c.state.canonicalPlayback={};c.canonicalPlayback=owner;return owner;}});g.lost.resolve({reason:'unknown',message:'lost'});await Promise.resolve();assert.equal(canceled,1);assert.equal(g.c.state.canonicalPlayback.deviceLost,true);assert.equal(g.c.state.routeStatus,'error');}finally{g.cleanup();}});

test('post-install presentation notification failure does not claim rollback of an active owner',async()=>{const f=fixture();try{const owner=await startCanonicalPracticeInternal(f.c,{requestDevice:async()=>f.device,install(c){const o={cancel(){}};c.canonicalPlayback=o;c.state.canonicalPlayback={};c.repairRouteTargets=()=>{throw Error('presentation failure');};return o;}});assert.equal(f.c.canonicalPlayback,owner);assert.match(f.c.state.canonicalPlayback.entryWarning,/시작됐지만/);assert.equal(f.destroyed,0);}finally{f.cleanup();}});

test('fresh MMQ2 choice reaches matching store and selected/search installer without changing scene',async()=>{const a=createCanonicalPracticePreset(),b=createCanonicalPracticePreset({selectedWorldProfile:'mmq2-cushion'});assert.equal(b.scene.sceneId,a.scene.sceneId);assert.equal(b.selectedWorldProfile,'mmq2-cushion');const f=fixture();let requested=0;try{await assert.rejects(startCanonicalPracticeInternal(f.c,{selectedWorldProfile:'invalid',requestDevice:async()=>{requested++;return f.device},install(){}}));assert.equal(requested,0);await startCanonicalPracticeInternal(f.c,{selectedWorldProfile:'mmq2-cushion',requestDevice:async()=>f.device,install(c,o){assert.equal(o.selectedWorldProfile,'mmq2-cushion');assert.equal(o.stateStore.capabilities.selectedWorldProfile,'mmq2-cushion');const owner={cancel(){}};c.canonicalPlayback=owner;return owner;}});}finally{f.cleanup();}});

test('actual installer notification failure retains committed owner and owned resources until dispose (host only)',async()=>{
 const {installCanonicalControllerHarness}=await import('../src/direct-candidate/canonical-controller-integration.mjs');
 const f=fixture(),legacy=f.c.lab,oldGame=f.c.game;let store,legacyDisposals=0;const legacyDispose=legacy.dispose.bind(legacy);
 legacy.dispose=()=>{legacyDisposals++;legacyDispose();};
 const session={selectedWorldProfile:'mmq2-cushion',capabilities:{selectedWorldProfile:'mmq2-cushion'},cancel(){},runSelected(){throw Error('No GPU work permitted');}};
 try{
  f.c.notify=()=>{throw Error('subscriber failed');};
  const owner=await startCanonicalPracticeInternal(f.c,{requestDevice:async()=>f.device,install(c,options){store=options.stateStore;return installCanonicalControllerHarness(c,{...options,session});}});
  assert.equal(f.c.canonicalPlayback,owner);assert.notEqual(f.c.lab,legacy);assert.notEqual(f.c.game,oldGame);
  assert.equal(legacyDisposals,1);assert.equal(f.destroyed,0);assert.equal(store.readScene().admitted,true);
  assert.match(f.c.state.canonicalPlayback.entryWarning,/subscriber failed/);
  f.c.dispose();assert.equal(f.destroyed,1);assert.throws(()=>store.readScene(),/disposed/);
 }finally{f.cleanup();}
});

test('device loss snapshots original phase/progress before cancellation and survives mutable route errors',async()=>{
 const f=fixture();let requested=0,canceled=0;const message='A valid external Instance reference no longer exists.';
 try{
  await startCanonicalPracticeInternal(f.c,{requestDevice:async()=>{requested++;return f.device;},install(c){
   c.state.canonicalPlayback={phase:'ready'};const owner={cancel(){canceled++;c.state.routeProgress={phase:'canceled',tested:0};c.state.canonicalPlayback.phase='ready';}};c.canonicalPlayback=owner;return owner;
  }});
  f.c.state.canonicalPlayback.phase='forecast';f.c.state.routeStatus='searching';f.c.state.routeProgress={phase:'compiling',tested:3,total:9};
  const game=f.c.game;f.lost.resolve({reason:'unknown',message});await Promise.resolve();
  const diagnostic=f.c.state.canonicalPlayback.deviceLoss;
  assert.equal(diagnostic.reason,'unknown');assert.equal(diagnostic.message,message);assert.equal(diagnostic.phase,'forecast');
  assert.deepEqual(diagnostic.searchProgress,{phase:'compiling',tested:3,total:9});assert.ok(Number.isFinite(Date.parse(diagnostic.timestamp)));
  assert.equal(Object.isFrozen(diagnostic),true);assert.equal(Object.isFrozen(diagnostic.searchProgress),true);
  assert.match(f.c.state.routeError,/마지막 단계: compiling/);f.c.state.routeError='later refusal';f.c.state.routeProgress=null;
  assert.equal(f.c.state.canonicalPlayback.deviceLoss,diagnostic);assert.equal(f.c.state.canonicalPlayback.deviceLost,true);
  assert.equal(f.c.state.paused,true);assert.equal(f.c.game,game);assert.equal(requested,1);assert.equal(canceled,1);
 }finally{f.cleanup();}
});

test('intentional dispose does not surface device loss; failed rollback notification preserves installer error',async()=>{
 const f=fixture();try{f.c.notify=()=>{throw Error('subscriber failed');};await assert.rejects(startCanonicalPracticeInternal(f.c,{requestDevice:async()=>f.device,install(){throw Error('original install failure');}}),/original install failure/);assert.equal(f.destroyed,1);}finally{f.cleanup();}
 const g=fixture();try{await startCanonicalPracticeInternal(g.c,{requestDevice:async()=>g.device,install(c){const owner={cancel(){throw Error('must not cancel after dispose');}};c.canonicalPlayback=owner;return owner;}});g.c.dispose();g.lost.resolve({reason:'destroyed',message:'intentional'});await Promise.resolve();assert.equal(g.c.state.canonicalPlayback?.deviceLoss,undefined);}finally{g.cleanup();}
});

test('owned async device cleanup drains before destroy on rollback and controller disposal',async()=>{
 for(const rollback of [true,false]){const f=fixture(),drain=deferred();let started=false;try{
 const pending=startCanonicalPracticeInternal(f.c,{requestDevice:async()=>f.device,async disposeDevice(device){started=true;await drain.promise;device.destroy();},install(c){if(rollback)throw Error('install failure');return c.canonicalPlayback={cancel(){}};}});
 if(rollback){const rejected=assert.rejects(pending,/install failure/);while(!started)await new Promise(r=>setImmediate(r));assert.equal(f.destroyed,0);drain.resolve();await rejected;}
 else{await pending;const disposed=f.c.dispose();assert.equal(typeof disposed?.then,'function');assert.equal(f.c.dispose(),disposed,'repeat disposal shares the acknowledged cleanup');let acknowledged=false;disposed.then(()=>{acknowledged=true;});assert.equal(started,true);assert.equal(f.destroyed,0);await Promise.resolve();assert.equal(acknowledged,false);drain.resolve();await disposed;assert.equal(acknowledged,true);}
 assert.equal(f.destroyed,1);
 }finally{drain.resolve();f.cleanup();}}
});

test('public WASM browser import is inert; unsealed or forged runtime refuses before main GPU, Worker or fetch access',async()=>{
 const oldSecure=globalThis.isSecureContext,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldFetch=globalThis.fetch,oldWorker=globalThis.Worker;
 const f=fixture();let adapters=0,devices=0,fetches=0,workers=0;
 try{
  globalThis.isSecureContext=true;globalThis.fetch=()=>{fetches++;throw Error('Unsealed entry must not fetch');};globalThis.Worker=class{constructor(){workers++;throw Error('Unsealed entry must not create Worker');}};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{async requestAdapter(){adapters++;return {limits:{maxStorageBuffersPerShaderStage:10},async requestDevice(){devices++;return f.device;}};}}}});
  const api=await import('../src/direct-candidate/canonical-controller-browser-entry.mjs');assert.equal(adapters,0);assert.equal(devices,0);assert.equal(fetches,0);assert.equal(workers,0);
  for(const key of ['searchService','session','sessionService'])assert.throws(()=>api.installCanonicalController(f.c,{[key]:{}}),/owns/);
  assert.throws(()=>api.installCanonicalController(f.c,{device:f.device,productionRuntime:{buildSealed:true,sourceRevision:'a'.repeat(64)}}),/Owned sealed/);
  assert.throws(()=>api.startCanonicalPractice(f.c,{selectedWorldProfile:'mmq1-ball-ball'}),/통합/);assert.equal(adapters,0);
  const oldGame=f.c.game,oldLab=f.c.lab;await assert.rejects(api.startCanonicalPractice(f.c),/static build configuration/);
  assert.equal(adapters,0);assert.equal(devices,0);assert.equal(fetches,0);assert.equal(workers,0);assert.equal(f.destroyed,0);assert.equal(f.c.game,oldGame);assert.equal(f.c.lab,oldLab);assert.equal(f.c.canonicalPlayback,undefined);
 }finally{globalThis.isSecureContext=oldSecure;globalThis.fetch=oldFetch;globalThis.Worker=oldWorker;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;f.cleanup();}
});

test('hidden entry refuses runtime creation; late Worker runtime waits for drain acknowledgement before cancellation and explicit retry',async()=>{
 const oldDoc=globalThis.document,oldWindow=globalThis.window,doc=new EventTarget(),win=new EventTarget(),f=fixture(),creation=deferred(),drain=deferred(),cleanupStarted=deferred();
 doc.hidden=true;doc.visibilityState='hidden';let creations=0,cleanups=0,installs=0,creationSignal,settled=false;
 const runtime={identity:Object.freeze({}),lost:deferred().promise,dispose(){cleanups++;cleanupStarted.resolve();return drain.promise;}};
 try{
  globalThis.document=doc;globalThis.window=win;
  const start=await browserEntryHarness(options=>{creations++;creationSignal=options.signal;assert.deepEqual(Object.keys(options).sort(),['onProgress','signal']);return creations===1?creation.promise:Promise.resolve(runtime);},c=>{installs++;return c.canonicalPlayback={cancel(){}};});
  await assert.rejects(start(f.c),e=>e.name==='AbortError'&&/화면/.test(e.message));assert.equal(creations,0);
  doc.hidden=false;doc.visibilityState='visible';const original={lab:f.c.lab,game:f.c.game,settings:f.c.state.settings,undo:f.c.undoStack,redo:f.c.redoStack},pending=start(f.c);pending.then(()=>{settled=true;},()=>{settled=true;});
  assert.equal(creations,1);doc.hidden=true;doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));assert.equal(creationSignal.aborted,true);
  creation.resolve(runtime);await cleanupStarted.promise;await Promise.resolve();assert.equal(settled,false);assert.equal(cleanups,1);assert.equal(installs,0);
  assert.equal(f.c.lab,original.lab);assert.equal(f.c.game,original.game);assert.equal(f.c.state.settings,original.settings);assert.equal(f.c.undoStack,original.undo);assert.equal(f.c.redoStack,original.redo);
  doc.hidden=false;doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));assert.equal(creations,1,'visibility must not start a runtime automatically');
  await assert.rejects(start(f.c),/이미/);assert.equal(creations,1,'pending cleanup prevents replacement Worker creation');
  drain.resolve();await assert.rejects(pending,e=>e.name==='AbortError'&&/화면/.test(e.message));assert.equal(f.c.canonicalPlayback,undefined);
  await start(f.c);assert.equal(creations,2);assert.equal(installs,1);assert.equal(creationSignal.aborted,false);await f.c.dispose();assert.equal(cleanups,2);assert.equal(f.destroyed,0);
 }finally{creation.resolve(runtime);drain.resolve();globalThis.document=oldDoc;globalThis.window=oldWindow;f.cleanup();}
});

test('running loss reports last chunk submission separately from GPU completion',async()=>{
 const f=fixture();try{
  await startCanonicalPracticeInternal(f.c,{requestDevice:async()=>f.device,install(c){return c.canonicalPlayback={cancel(){c.state.routeProgress=null;}};}});
  f.c.state.routeStatus='searching';f.c.state.routeProgress={phase:'encoding',executionStage:'chunk-encode-or-wait',chunkIndex:17,chunkCount:168,submittedCommands:4096,totalCommands:42837,elapsedMs:12345,cachedDeviceOwnedBytes:4096};
  f.lost.resolve({reason:'destroyed',message:'native destroy test'});await Promise.resolve();
  assert.match(f.c.state.routeError,/원인 코드: destroyed/);assert.match(f.c.state.routeError,/chunk-encode-or-wait/);assert.match(f.c.state.routeError,/청크 17\/168/);
  assert.match(f.c.state.routeError,/제출 명령 4096\/42837 \(GPU 완료 수 아님\)/);assert.match(f.c.state.routeError,/12345 ms/);
  assert.equal(f.c.state.canonicalPlayback.deviceLoss.searchProgress.cachedDeviceOwnedBytes,4096);
 }finally{f.cleanup();}
});

test('generation facade loss replaces anchor loss without replacing installed state or identity',async()=>{
 const f=fixture(),genuineLoss=deferred(),identity=Object.freeze({});let canceled=0,observed,options,cleanups=0;
 try{
  const owner=await startCanonicalPracticeInternal(f.c,{requestDevice:async()=>identity,getDeviceLoss(device){observed=device;return genuineLoss.promise;},async disposeDevice(device){assert.equal(device,identity);cleanups++;},install(c,o){options=o;return c.canonicalPlayback={cancel(){canceled++;}};}});
  const lab=f.c.lab,game=f.c.game,store=options.stateStore,undo=f.c.undoStack;
  assert.equal(observed,identity);assert.equal(options.device,identity);assert.equal(identity.lost,undefined);assert.equal(identity.destroy,undefined);assert.equal(Object.isFrozen(identity),true);
  f.lost.resolve({reason:'destroyed',message:'retired anchor'});await Promise.resolve();
  assert.equal(canceled,0);assert.equal(f.c.state.canonicalPlayback?.deviceLost,undefined);
  assert.equal(f.c.canonicalPlayback,owner);assert.equal(f.c.lab,lab);assert.equal(f.c.game,game);assert.equal(f.c.undoStack,undo);assert.equal(options.stateStore,store);
  genuineLoss.resolve({reason:'unknown',message:'new generation failed'});await Promise.resolve();
  assert.equal(canceled,1);assert.equal(f.c.state.canonicalPlayback.deviceLoss.reason,'unknown');assert.match(f.c.state.routeError,/new generation failed/);
  f.c.dispose();await Promise.resolve();assert.equal(cleanups,1);assert.equal(f.destroyed,0,'facade cleanup, not anchor destruction, owns all generations');
 }finally{f.cleanup();}
});
test('invalid generation loss hook rejects before installation and releases acquired device',async()=>{
 for(const hook of [17,()=>undefined]){const f=fixture();let requested=0;try{await assert.rejects(startCanonicalPracticeInternal(f.c,{requestDevice:async()=>{requested++;return f.device;},getDeviceLoss:hook,install(){throw Error('must not install');}}),/Owned device loss/);assert.equal(requested,typeof hook==='function'?1:0);assert.equal(f.destroyed,requested);assert.equal(f.c.canonicalPlayback,undefined);}finally{f.cleanup();}}
});

test('browser wrapper forwards only owned runtime identity/loss and keeps installed state through genuine Worker loss',async()=>{
 const f=fixture(),loss=deferred(),drain=deferred(),identity=Object.freeze({}),events=[],progress=()=>{};let installedOptions,creationOptions,canceled=0;
 const runtime={identity,lost:loss.promise,dispose(){events.push('dispose');return drain.promise;}};
 try{
  const start=await browserEntryHarness(async options=>{creationOptions=options;return runtime;},(c,options)=>{installedOptions=options;return c.canonicalPlayback={cancel(){canceled++;}};});
  const owner=await start(f.c,{onProgress:progress}),snapshot={lab:f.c.lab,renderer:f.c.renderer,game:f.c.game,store:installedOptions.stateStore,settings:f.c.state.settings,undo:f.c.undoStack,redo:f.c.redoStack};
  assert.deepEqual(Object.keys(creationOptions).sort(),['onProgress','signal']);assert.equal(creationOptions.onProgress,progress);assert.equal(creationOptions.signal.aborted,false);
  assert.equal(installedOptions.productionRuntime,runtime);assert.equal(installedOptions.device,identity);assert.equal(identity.lost,undefined);assert.equal(identity.destroy,undefined);assert.deepEqual(events,[],'startup must not run or prewarm either mode');
  loss.resolve({reason:'unknown',message:'Worker native device lost'});await Promise.resolve();
  assert.equal(canceled,1);assert.equal(f.c.canonicalPlayback,owner);assert.equal(f.c.lab,snapshot.lab);assert.equal(f.c.renderer,snapshot.renderer);assert.equal(f.c.game,snapshot.game);assert.equal(installedOptions.stateStore,snapshot.store);assert.equal(f.c.state.settings,snapshot.settings);assert.equal(f.c.undoStack,snapshot.undo);assert.equal(f.c.redoStack,snapshot.redo);
  assert.equal(f.c.state.canonicalPlayback.deviceLoss.message,'Worker native device lost');assert.equal(f.c.state.routeStatus,'error');
  const disposed=f.c.dispose();assert.equal(disposed,drain.promise);assert.deepEqual(events,['dispose']);assert.throws(()=>snapshot.store.readScene(),/disposed/);drain.resolve();await disposed;assert.equal(f.destroyed,0);
 }finally{drain.resolve();f.cleanup();}
});

test('browser cancellation immediately after runtime creation awaits exact runtime disposal without native fallback',async()=>{
 for(const event of ['abort','pagehide']){
  const f=fixture(),abort=new AbortController(),drain=deferred(),cleanupStarted=deferred(),oldWindow=globalThis.window,win=new EventTarget();let calls=0,settled=false;
  const runtime={identity:Object.freeze({}),lost:deferred().promise,dispose(){calls++;cleanupStarted.resolve();return drain.promise;}};
  try{
   globalThis.window=win;const oldGame=f.c.game,oldLab=f.c.lab,oldSettings=f.c.state.settings;
   const start=await browserEntryHarness(async()=>{if(event==='abort')abort.abort();else win.dispatchEvent(new Event('pagehide'));return runtime;},()=>{throw Error('canceled runtime must not install');});
   const pending=start(f.c,{signal:abort.signal});pending.then(()=>{settled=true;},()=>{settled=true;});await cleanupStarted.promise;await Promise.resolve();assert.equal(settled,false);assert.equal(calls,1);
   assert.equal(f.c.game,oldGame);assert.equal(f.c.lab,oldLab);assert.equal(f.c.state.settings,oldSettings);assert.equal(f.c.canonicalPlayback,undefined);
   drain.resolve();await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,1);assert.equal(f.destroyed,0);
  }finally{drain.resolve();globalThis.window=oldWindow;f.cleanup();}
 }
});

test('browser startup edit refusal cleans only the runtime and preserves changed game/history/settings',async()=>{
 const f=fixture(),creation=deferred(),drain=deferred(),cleanupStarted=deferred();let installs=0,cleanups=0;
 const runtime={identity:Object.freeze({}),lost:deferred().promise,dispose(){cleanups++;cleanupStarted.resolve();return drain.promise;}};
 try{
  const start=await browserEntryHarness(()=>creation.promise,()=>{installs++;throw Error('must not install');}),pending=start(f.c);
  f.c.state.settings.angle=17;const saved={lab:f.c.lab,game:f.c.game,settings:f.c.state.settings,undo:f.c.undoStack,redo:f.c.redoStack};creation.resolve(runtime);
  await cleanupStarted.promise;assert.equal(installs,0);assert.equal(cleanups,1);assert.equal(f.c.lab,saved.lab);assert.equal(f.c.game,saved.game);assert.equal(f.c.state.settings,saved.settings);assert.equal(f.c.state.settings.angle,17);assert.equal(f.c.undoStack,saved.undo);assert.equal(f.c.redoStack,saved.redo);
  drain.resolve();await assert.rejects(pending,/바뀌었습니다/);assert.equal(f.destroyed,0);
 }finally{creation.resolve(runtime);drain.resolve();f.cleanup();}
});


test('loss timing uses the current page clock rather than stale progress or Worker clocks',()=>{
 const progress={elapsedMs:12899,searchStartedAtMs:1000,sampledAtMs:13899};
 assert.deepEqual(canonicalSearchLossTiming(progress,20000),{searchElapsedAtLossMs:19000,lastProgressAgeMs:6101});assert.equal(progress.elapsedMs,12899);
 assert.deepEqual(canonicalSearchLossTiming({elapsedMs:12899},20000),{});
 assert.deepEqual(canonicalSearchLossTiming({searchStartedAtMs:Infinity,sampledAtMs:30000},20000),{});
});
test('loss retains bounded Worker diagnostics and current page timing independently before cancel',async()=>{
 const f=fixture();try{await startCanonicalPracticeInternal(f.c,{requestDevice:async()=>f.device,install(c){return c.canonicalPlayback={cancel(){c.state.routeProgress=null;}};}});
 const now=performance.now();f.c.state.routeStatus='searching';f.c.state.routeProgress={elapsedMs:100,searchStartedAtMs:now-1000,sampledAtMs:now-900,executionStage:'finish-fence-and-readback'};
 f.lost.resolve({reason:'unknown',message:'native loss',diagnostics:{nativeStage:'finish-map-pending',runElapsedMs:150,secret:'omit'}});await Promise.resolve();
 const d=f.c.state.canonicalPlayback.deviceLoss;assert.ok(d.searchElapsedAtLossMs>=1000);assert.ok(d.lastProgressAgeMs>=900);assert.equal(d.gpuDiagnostics.runElapsedMs,150);assert.equal(d.gpuDiagnostics.nativeStage,'finish-map-pending');assert.equal('secret'in d.gpuDiagnostics,false);assert.match(f.c.state.routeError,/손실 통지 수신 시 탐색 경과/);assert.match(f.c.state.routeError,/finish-map-pending/);
 }finally{f.cleanup();}
});

test('loss outside active search does not label old progress as current search elapsed',async()=>{
 const f=fixture();try{await startCanonicalPracticeInternal(f.c,{requestDevice:async()=>f.device,install(c){return c.canonicalPlayback={cancel(){}};}});
 f.c.state.routeStatus='idle';f.c.state.routeProgress={elapsedMs:100,searchStartedAtMs:0,sampledAtMs:0};f.lost.resolve({reason:'unknown',message:'idle loss'});await Promise.resolve();
 assert.equal('searchElapsedAtLossMs'in f.c.state.canonicalPlayback.deviceLoss,false);assert.doesNotMatch(f.c.state.routeError,/손실 통지 수신 시 탐색 경과/);
 }finally{f.cleanup();}
});
