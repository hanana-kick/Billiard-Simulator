import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {createCanonicalPracticePreset,startCanonicalPracticeInternal} from '../src/direct-candidate/canonical-practice-entry.mjs';
const require=createRequire(import.meta.url),R=require('../vendor/rapier.cjs');await R.init();globalThis.RAPIER=R;
for(const name of ['math','physics','game-rules','render-cadence','controller'])require('../src/'+name+'.js');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
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
 else{await pending;f.c.dispose();assert.equal(started,true);assert.equal(f.destroyed,0);drain.resolve();await new Promise(r=>setImmediate(r));}
 assert.equal(f.destroyed,1);
 }finally{drain.resolve();f.cleanup();}}
});

test('public WASM browser import is inert; forged services/runtime refuse and failed prewarm destroys unreturned device',async()=>{
 const oldSecure=globalThis.isSecureContext,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldFetch=globalThis.fetch;
 const f=fixture();let adapters=0,devices=0,fetches=0;
 try{
  globalThis.isSecureContext=true;globalThis.fetch=()=>{fetches++;throw Error('Unsealed entry must not fetch');};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{async requestAdapter(){adapters++;return {limits:{maxStorageBuffersPerShaderStage:10},async requestDevice(){devices++;return f.device;}};}}}});
  const api=await import('../src/direct-candidate/canonical-controller-browser-entry.mjs');assert.equal(adapters,0);assert.equal(devices,0);assert.equal(fetches,0);
  for(const key of ['searchService','session','sessionService'])assert.throws(()=>api.installCanonicalController(f.c,{[key]:{}}),/owns/);
  assert.throws(()=>api.installCanonicalController(f.c,{device:f.device,productionRuntime:{buildSealed:true,sourceRevision:'a'.repeat(64)}}),/Owned sealed/);
  assert.throws(()=>api.startCanonicalPractice(f.c,{selectedWorldProfile:'mmq1-ball-ball'}),/통합/);assert.equal(adapters,0);
  const oldGame=f.c.game,oldLab=f.c.lab;await assert.rejects(api.startCanonicalPractice(f.c),/static build configuration/);
  assert.equal(adapters,1);assert.equal(devices,1);assert.equal(fetches,0);assert.equal(f.destroyed,1);assert.equal(f.c.game,oldGame);assert.equal(f.c.lab,oldLab);assert.equal(f.c.canonicalPlayback,undefined);
 }finally{globalThis.isSecureContext=oldSecure;globalThis.fetch=oldFetch;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;f.cleanup();}
});

test('page hiding cancels adapter/device requests promptly; visible retry creates fresh device and late orphan cannot install',async()=>{
 const oldSecure=globalThis.isSecureContext,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldDoc=globalThis.document,oldWindow=globalThis.window;
 const f=fixture(),doc=new EventTarget(),win=new EventTarget();doc.hidden=true;doc.visibilityState='hidden';let adapterCalls=0,deviceCalls=0,orphanDestroyed=0;const deviceWait=deferred();
 try{
  globalThis.isSecureContext=true;globalThis.document=doc;globalThis.window=win;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{async requestAdapter(){adapterCalls++;return {limits:{maxStorageBuffersPerShaderStage:10},requestDevice(){deviceCalls++;return deviceCalls===1?deviceWait.promise:Promise.resolve(f.device);}};}}}});
  const {startCanonicalPractice}=await import('../src/direct-candidate/canonical-controller-browser-entry.mjs');
  await assert.rejects(startCanonicalPractice(f.c),e=>e.name==='AbortError'&&/화면/.test(e.message));assert.equal(adapterCalls,0);
  doc.hidden=false;doc.visibilityState='visible';const oldGame=f.c.game,oldLab=f.c.lab,p=startCanonicalPractice(f.c);while(deviceCalls===0)await new Promise(r=>setImmediate(r));
  doc.hidden=true;doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));
  await Promise.race([assert.rejects(p,e=>e.name==='AbortError'&&/화면/.test(e.message)),new Promise((_,reject)=>setTimeout(()=>reject(Error('Hidden startup blocked')),1000))]);
  assert.equal(f.c.game,oldGame);assert.equal(f.c.lab,oldLab);assert.equal(f.c.canonicalPlayback,undefined);
  doc.hidden=false;doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));assert.equal(deviceCalls,1,'visibility must not request a device automatically');
  await assert.rejects(startCanonicalPractice(f.c),/static build configuration/);assert.equal(deviceCalls,2);assert.equal(f.destroyed,1);
  deviceWait.resolve({destroy(){orphanDestroyed++;}});await new Promise(r=>setImmediate(r));assert.equal(orphanDestroyed,1);assert.equal(f.destroyed,1);assert.equal(f.c.game,oldGame);assert.equal(f.c.canonicalPlayback,undefined);
 }finally{globalThis.isSecureContext=oldSecure;globalThis.document=oldDoc;globalThis.window=oldWindow;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;f.cleanup();}
});
