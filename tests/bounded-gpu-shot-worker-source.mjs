// SOURCE/REALM GATES ONLY. No native engine, decoder execution, GPUDevice or WGSL.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {Worker} from 'node:worker_threads';
import {WORKER_RUNTIME_MODULES} from '../src/bounded-gpu-shot/four-ball-worker-runtime.mjs';
import {createWorkerClientTransport} from '../src/bounded-gpu-shot/four-ball-worker-transport.mjs';
import {initializeWorkerGpu} from '../src/bounded-gpu-shot/four-ball-worker-bootstrap.mjs';
import {input} from './bounded-gpu-shot-worker-fixture.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
function derivedOrder(){
  // Exact trusted dependency traversal from the supported browser page generator.
  const source=read('tests/browser-live-initial-four-ball-page.cjs');
  const begin=source.indexOf('const seen=new Set(),scripts=[];'),end=source.indexOf("\nconst originals=",begin);
  assert.ok(begin>=0&&end>begin,'Supported generator dependency traversal must remain identifiable');
  const context=vm.createContext({fs,path,ROOT});
  return vm.runInContext(source.slice(begin,end)+";scripts.filter(x=>x!=='src/experimental-cue-convex-topology.js')",context);
}
test('source gate: exact supported generator order, with only one topology authority',()=>{
  assert.deepEqual([...WORKER_RUNTIME_MODULES],Array.from(derivedOrder(),x=>'../'+x.slice(4)));
  assert.equal(WORKER_RUNTIME_MODULES.length,59);
  assert.equal(new Set(WORKER_RUNTIME_MODULES).size,WORKER_RUNTIME_MODULES.length);
  for(const module of WORKER_RUNTIME_MODULES)assert.match(module,/^\.\.\/(?:experimental-[a-z0-9-]+|game-rules)\.js$/);
  assert.ok(!WORKER_RUNTIME_MODULES.some(x=>x.includes('convex-topology')));
  const context=vm.createContext({structuredClone});
  const topology=read('src/experimental-cue-convex-topology.js');vm.runInContext(topology,context);
  const authority=context.LabCueConvexTopologyExperimental;
  for(const module of WORKER_RUNTIME_MODULES){
    // These globals are captured during module initialization. Checking only
    // the final global table would miss an undefined dependency captured early.
    if(module==='../experimental-cue-obstacle-contact.js')
      assert.equal(typeof context.LabCueEpaCoreExperimental?.EPA_CORE,'string');
    if(module==='../experimental-cue-rigid-exclusion.js')
      assert.equal(typeof context.LabCueObstacleContactExperimental?.createGpuQueries,'function');
    if(module==='../experimental-cue-broad-phase.js'){
      assert.equal(typeof context.LabCueEmptyConvexCacheExperimental?.createGpuStage,'function');
      assert.equal(typeof context.LabCueEmptyPairCacheExperimental?.createGpuStage,'function');
      assert.equal(typeof context.LabCueRigidExclusionExperimental?.createGpuGuard,'function');
    }
    vm.runInContext(read('src/'+module.slice(3)),context,{filename:module});
  }
  assert.equal(context.LabCueConvexTopologyExperimental,authority);
  assert.equal(typeof context.LabFourBallWorldExperimental.createGpuStepper,'function');
  assert.equal(typeof context.FourBallGame,'function');
});
test('source gate: dependency back edges are only the four explicit lazy cycle lookups',()=>{
  const order=['../experimental-cue-convex-topology.js',...WORKER_RUNTIME_MODULES],backEdges=new Set();
  for(const module of WORKER_RUNTIME_MODULES){
    const source=read('src/'+module.slice(3));
    for(const match of source.matchAll(/(?:require\('\.\/|load\(')([\w-]+)(?:\.js)?'/g)){
      const dependency='../'+match[1]+'.js';
      assert.ok(order.includes(dependency),'Unbundled trusted dependency: '+dependency);
      if(order.indexOf(dependency)>order.indexOf(module))backEdges.add(module+' -> '+dependency);
    }
  }
  assert.deepEqual([...backEdges].sort(),[
    '../experimental-cloth-island-world.js -> ../experimental-pair-contact-stage.js',
    '../experimental-cue-broad-phase.js -> ../experimental-ccd-bvh-world-bridge.js',
    '../experimental-four-ball-cloth-birth.js -> ../experimental-contact-graph-journal.js',
    '../experimental-plan-batch-scheduler.js -> ../experimental-stage-runtime.js'
  ]);
  assert.match(read('src/experimental-plan-batch-scheduler.js'),/const runtime=\(\)=>.*?require\('\.\/experimental-stage-runtime\.js'\)/);
  // These source functions defer their lookups until after module loading.
  // The browser-like realm gate below rejects an eager capture on every edge.
  assert.match(read('src/experimental-four-ball-cloth-birth.js'),/const journal = \(\) => common \? require\('\.\/experimental-contact-graph-journal'\)/);
  assert.match(read('src/experimental-cloth-island-world.js'),/function sourceWakeSelection\(receipt,backend\)\{const Pair=.*?require\('\.\/experimental-pair-contact-stage'\)/);
  assert.match(read('src/experimental-cue-broad-phase.js'),/if\(clothOwner\)\{const Bridge=.*?require\('\.\/experimental-ccd-bvh-world-bridge'\)/);
});
function loadBrowserLikeWorker(mutation){
  const worker=new Worker(new URL('./bounded-gpu-shot-worker-runtime-realm.mjs',import.meta.url),
    {type:'module',execArgv:['--experimental-vm-modules'],workerData:{mutation}});
  return new Promise((resolve,reject)=>{
    let result;
    worker.once('message',value=>{result=value;});
    worker.once('error',reject);
    worker.once('exit',code=>code===0&&result?resolve(result):reject(Error('Runtime worker exited without a result: '+code)));
  });
}
test('browser-like module worker: actual runtime imports initialize every captured and lazy global once',{timeout:30000},async()=>{
  const result=await loadBrowserLikeWorker();
  assert.equal(result.browserBranches,true);assert.equal(result.physicsExecuted,false);
  assert.equal(result.scriptCount,60);assert.equal(result.globalCount,61);assert.equal(result.topologyWrites,1);
  for(const name of ['LabCoupledContactOwnerExperimental','LabThreeBallCcdWorldExperimental',
    'LabCcdPassAuthorityExperimental','LabCcdFixedSphereExperimental','LabCcdSweepMathExperimental',
    'LabCcdSubstepExperimental','LabCcdBvhWorldBridgeExperimental','LabLiveThreeBallOriginExperimental'])
    assert.ok(result.initializationReads[name]>0,'Actual initialization read required: '+name);
  assert.deepEqual(result.capability,{
    kind:'experimental-bounded-live-initial-four-ball-gpu-service',backend:'webgpu',
    initialSnapshotOnly:true,cpuFallback:false,wholeWorld:false,arbitraryShots:false,
    initialDomain:'original-constructor72-default-first-strike',
    completion:'existing-world-physical-rest-and-scoring',resumableBudget:true
  });
});
test('browser-like module worker gate rejects missing captured globals, lazy dependencies and wrong order',{timeout:30000},async()=>{
  await assert.rejects(loadBrowserLikeWorker('omit-coupled-owner'),/Module captured uninitialized global: LabCoupledContactOwnerExperimental/);
  await assert.rejects(loadBrowserLikeWorker('omit-lazy-coupled-hints'),/Missing bundled runtime global: LabCoupledContactHintsExperimental/);
  await assert.rejects(loadBrowserLikeWorker('reverse-bvh-dependency'),/Module captured uninitialized global: LabCcdBvhStateExperimental/);
});
test('source gate: production transport has no input-controlled code, source engine execution or CPU fallback',()=>{
  const files=fs.readdirSync(path.join(ROOT,'src/bounded-gpu-shot')).filter(x=>x.includes('worker')&&x.endsWith('.mjs'));
  for(const file of files){const source=read('src/bounded-gpu-shot/'+file);assert.doesNotMatch(source,/\beval\s*\(|new Function\s*\(|importScripts\s*\(|PhysicsLab|restoreSnapshot|RAPIER\.init|forceFallbackAdapter|--disable|--no-sandbox/);}
  const client=read('src/bounded-gpu-shot/four-ball-worker-client.mjs');assert.match(client,/type: 'module'/);assert.doesNotMatch(client,/decoder|browser-initial-import|four-ball\.mjs/);
  const runtime=read('src/bounded-gpu-shot/four-ball-worker-runtime.mjs');assert.ok(runtime.indexOf("await import('../browser-initial-import/four-ball.mjs')")<runtime.indexOf('for (const source'));
  assert.match(read('src/bounded-gpu-shot/four-ball-worker-bootstrap.mjs'),/runtime\.createBoundedFourBallShotService\(\{device, decoder\}\)/);
});
test('bootstrap double: real production bootstrap returns unsupported on null adapter without decoder/fetch/device',async()=>{
  const before=Object.getOwnPropertyDescriptor(globalThis,'navigator'),fetchBefore=globalThis.fetch;let requested=0,fetched=0;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{async requestAdapter(...args){assert.equal(args.length,0);requested++;return null;}}}});
  globalThis.fetch=()=>{fetched++;throw Error('Must not fetch decoder without adapter');};
  try{assert.deepEqual(await initializeWorkerGpu(),{status:'unsupported',reason:'worker-webgpu-adapter-unavailable'});assert.equal(requested,1);assert.equal(fetched,0);}
  finally{Object.defineProperty(globalThis,'navigator',before);globalThis.fetch=fetchBefore;}
});
test('actual Node worker realm with DOUBLE physics preserves copied inputs, progress and graceful disposal',async()=>{
  const native=new Worker(new URL('./bounded-gpu-shot-worker-thread.mjs',import.meta.url),{type:'module'}),listeners=new Map();
  const worker={postMessage:value=>native.postMessage(value),terminate:()=>native.terminate(),
    addEventListener(type,fn){const wrapped=type==='message'?data=>fn({data}):error=>fn({error,message:error.message});if(!listeners.has(type))listeners.set(type,new Map());listeners.get(type).set(fn,wrapped);native.on(type,wrapped);},
    removeEventListener(type,fn){native.off(type,listeners.get(type).get(fn));listeners.get(type).delete(fn);}};
  const c=createWorkerClientTransport(worker);
  try{const ready=await c.ready;assert.equal(ready.status,'ready');assert.equal(ready.capability.actualGpu,false);assert.ok(ready.capability.workerThreadId>0);
    const raw=input('separate-realm'),op=c.start(raw,{budget:{maxSteps:1,maxWallMs:30000}});raw.snapshot[0]=99;
    assert.equal((await op.result).state.bytes[0],1);assert.equal((await op.progress()).progress.committedH,1);
    assert.equal((await op.resume()).status,'complete');assert.equal((await op.finished).progress.committedH,3);
    assert.equal((await c.dispose()).drained,true);
  }finally{await c.dispose();}
});
