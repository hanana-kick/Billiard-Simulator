// HOST TRANSPORT MOCKS ONLY: no shader execution or accepted physics result.
import test from 'node:test';import assert from 'node:assert/strict';
import {assertControlCacheVariants,runControlVariantSession,compareControlVariantResults,controlVariantCompilationOrder,CONTROL_VARIANT_ORDER}from './resident-candidate-microcode-variant-contract.mjs';
const fixtures=()=>['storage-v1','invocation-cache-v1'].map((controlMode,i)=>({m:{count:6,frames:2,runs:2,controlMode,vmStateDisjoint:true,processIsolationVersion:2,sourceHashes:{source:'same'},sourceHead:'same',sourceSha256:'source',runtimeSha256:'runtime'+i},runtime:{original:{initial:new Uint32Array([1,2,3]),futureStates:false},identity:{sourceSha256:'source',bytecodeSha256:'bytecode'},vm:{controlMode,vmStateDisjoint:true,shader:'MOCK '+controlMode,code:new Uint32Array([0,1]),handlers:[{id:0,code:'same source'}],instructionBudget:65536,dispatchChunks:512}}}));
test('preparation compiles broad first, both small cores next, without changing any pipeline identity',()=>{
 const d=(name,code=name,entryPoint='main')=>Object.freeze({name,code,entryPoint,bindingTypes:Object.freeze(['storage'])}),sets=[0,1].map(i=>{const handlerDescriptors=[d('cue'),d('numeric'),d('external macro2 rc_world_broad_commit_collision')];return{handlerDescriptors,descriptors:[d('microcode begin','core'+i,'begin'),d('microcode bounded pump','core'+i),d('initialization'),...handlerDescriptors]};}),before=structuredClone(sets),ordered=controlVariantCompilationOrder(sets);
 assert.deepEqual(ordered.map(x=>x.name),['external macro2 rc_world_broad_commit_collision','microcode begin','microcode bounded pump','microcode begin','microcode bounded pump','cue','numeric','initialization']);assert.deepEqual(sets,before);assert.ok(ordered.every(x=>sets.some(s=>s.descriptors.includes(x))));
});
test('only explicit control strategy differs; inputs, source, bytecode, macros, bounds and contract changes reject',()=>{
 assertControlCacheVariants(fixtures());
 for(const change of[e=>e[1].runtime.original.initial[0]++,e=>e[1].m.sourceHashes.source='other',e=>e[1].m.sourceHead='other',e=>e[1].runtime.vm.code[0]++,e=>e[1].runtime.vm.handlers[0].code='other',e=>e[1].runtime.vm.instructionBudget++,e=>e[1].runtime.vm.vmStateDisjoint=false,e=>e[1].runtime.vm.controlMode='typo',e=>e[1].m.frames=3,e=>e[1].runtime.vm.shader=e[0].runtime.vm.shader]){const e=fixtures();change(e);assert.throws(()=>assertControlCacheVariants(e));}
});
test('ABBA shares only caller device/cache and invokes fresh owned runs sequentially',async()=>{
 const entries=fixtures(),owner={device:{}},cache={device:owner.device},calls=[],events=[];let active=false,preflighted=false;
 const runs=await runControlVariantSession({entries,owner,cache,preflight:async()=>{assert.equal(calls.length,0);preflighted=true;},trace:e=>events.push(e),run:async options=>{assert.equal(preflighted,true);assert.equal(active,false);active=true;assert.equal(options.owner,owner);assert.equal(options.cache,cache);calls.push(entries.findIndex(x=>x.runtime===options.plan));await Promise.resolve();active=false;return{words:new Uint32Array([9]),vmWords:new Uint32Array([4]),stats:{},controls:[]};}});
 assert.deepEqual(calls,CONTROL_VARIANT_ORDER);assert.deepEqual(runs.map(x=>x.length),[2,2]);assert.notEqual(runs[0][0].words,runs[0][1].words);assert.equal(events.filter(e=>e.stage==='control-variant-run-done').length,4);
 await assert.rejects(runControlVariantSession({entries,owner,cache:{device:{}},run:async()=>{throw Error('must not run');}}));
 let afterFailure=0;await assert.rejects(runControlVariantSession({entries,owner,cache,preflight:async()=>{throw Error('candidate shader failure');},run:async()=>afterFailure++}),/candidate shader failure/);assert.equal(afterFailure,0);
});
test('cross-strategy comparison requires complete bank equality and one recorded device session',()=>{
 const entries=fixtures(),stats={executionGroups:[{name:'pump',wallMs:10}],steadyEndToEndWallMs:20,cache:{compileWallMs:0,coldCompiles:0,warmHits:25}},actual=entries.map(e=>({runtimeSha256:e.m.runtimeSha256,sourceSha256:e.m.sourceSha256,adapter:{description:'HOST MOCK ONLY'},gpuInvocation:{id:'same'},variantSession:{order:[...CONTROL_VARIANT_ORDER],deviceOwners:1,sharedPipelineCache:true},runs:[0,1].map(()=>({words:new Uint32Array([1,2]),vmWords:new Uint32Array([3,4]),stats}))}));
 assert.equal(compareControlVariantResults(entries,actual).allSourceAndVmWordsEqual,true);
 for(const change of[a=>a[1].runs[1].vmWords[1]++,a=>a[1].runs[0].words[1]++,a=>a[1].gpuInvocation.id='different',a=>a[1].variantSession.deviceOwners=2,a=>a[1].runtimeSha256='other']){const a=structuredClone(actual);change(a);assert.throws(()=>compareControlVariantResults(entries,a));}
});
