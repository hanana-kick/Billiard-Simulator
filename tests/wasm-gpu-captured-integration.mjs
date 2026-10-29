/** Genuine captured MMQ2 N1 host integration. No adapter, GPU execution, or physics assertions. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {captureLiveWorldPlan,createLiveWorldCaptureDevice} from '../src/direct-candidate/experimental-live-world-capture.mjs';
import {lowerLiveWorldPlans,liveBoundsResultGateSource} from '../src/direct-candidate/experimental-live-world-batch.mjs';
import {captureRawWorldResourceFacts} from '../src/direct-candidate/experimental-live-world-raw-resources.mjs';
import {createRawWorldGPU} from '../src/direct-candidate/deterministic-raw-world.mjs';
import {createWasmGpuEngineArtifact,loadWasmGpuEngineArtifact} from '../src/wasm-gpu/engine-artifact.mjs';
import {createWasmGpuRawArtifact} from '../src/wasm-gpu/raw-artifact-builder.mjs';
import {loadWasmGpuRawArtifact} from '../src/wasm-gpu/raw-artifact.mjs';
import {prepareWasmGpuEngine} from '../src/wasm-gpu/engine.mjs';

test('genuine captured raw + lowered MMQ2 graph traverses artifact/WASM/concrete bridge twice, host only',async()=>{
 const f=mmq2RawFixture(),revision='captured-integration-host-only';
 const plan=await captureLiveWorldPlan(f.binding,f.batch,{profile:'mmq2-cushion'}),lowered=await lowerLiveWorldPlans([plan]);
 const structuralConfig={profile:'mmq2-cushion',strikeBackend:'staged',maximumSteps:f.batch.effectiveMaximumSteps};
 const rawFacts=await captureRawWorldResourceFacts(f.batch);
 const {engine,initialUploads}=await (async()=>{
  const {artifact,initialUploads}=await createWasmGpuEngineArtifact({lowered,count:1,sourceRevision:revision,structuralConfig,rawAllocations:rawFacts});
  return {initialUploads,engine:await loadWasmGpuEngineArtifact(JSON.stringify(artifact),{expectedArtifactSha256:artifact.sha256,expectedSourceRevision:revision,expectedStructuralConfig:structuralConfig,expectedCount:1})};
 })();
 const {rawEngine,rawUploads}=await (async()=>{
  const {artifact,initialUploads}=await createWasmGpuRawArtifact({batch:f.batch,sourceRevision:revision});
  return {rawUploads:initialUploads,rawEngine:await loadWasmGpuRawArtifact(JSON.stringify(artifact),{expectedArtifactSha256:artifact.sha256,expectedSourceRevision:revision,expectedCount:1,expectedMaximumSteps:f.batch.effectiveMaximumSteps})};
 })();
 // Independently invoke the original raw factory on the nonexecuting recorder.
 const original=createLiveWorldCaptureDevice(),rawFactory=await createRawWorldGPU(original.device),bank=rawFactory.createBank(f.batch);
 bank.encode(original.device.createCommandEncoder());bank.dispose();assert.equal(original.submits,0);
 assert.equal(original.commands.length,rawEngine.commands.length);
 assert.deepEqual(engine.lowered.commands,lowered.commands);assert.deepEqual(engine.lowered.definitions,lowered.definitions);
 original.buffers.forEach((b,i)=>assert.deepEqual(rawUploads[i],{index:i,initial:b.bytes}));
 const originalRawDefinitions=original.pipelines.map(p=>({code:p.module.code,layout:p.layout}));
 const rawLength=original.commands.length,worldLength=lowered.commands.length,stride=plan.allocations[plan.readback].size/4;
 const buffers=[],worldIds=[],rawIds=rawEngine.allocations.map((_,i)=>i);let next=rawIds.length;
 for(const a of plan.allocations)worldIds.push(a.external?rawIds[rawEngine.outputs[a.external]]:next++);
 const faultId=next++,idsId=next++,readId=next++;
 let cursor=0,compiled=0,submits=0,writes=0,runNumber=0;
 const checkedPipelines=new WeakMap();
 const pipelineMatches=(pipeline,definition)=>{
  let seen=checkedPipelines.get(pipeline);if(!seen){seen=new Set();checkedPipelines.set(pipeline,seen);}if(seen.has(definition))return;
  assert.equal(pipeline.code,definition.code??definition.source);assert.deepEqual(pipeline.layout,definition.layout);assert.equal(pipeline.entryPoint,'main');seen.add(definition);
 };
 const bindingView=entries=>entries.map(e=>({binding:e.binding,buffer:e.resource.buffer.id,offset:e.resource.offset??0,size:e.resource.size??e.resource.buffer.size}));
 const gateDefinition={code:liveBoundsResultGateSource(stride),layout:'auto'};
 function verify(command){
  if(cursor<rawLength){const expected=original.commands[cursor];assert.equal(command.kind,'dispatch');pipelineMatches(command.pipeline,originalRawDefinitions[expected.pipeline]);assert.deepEqual(command.xyz,[expected.x,1,1]);assert.deepEqual(bindingView(command.entries),expected.entries.map(e=>({...e,buffer:rawIds[e.buffer]})));}
  else if(cursor<rawLength+worldLength){const expected=lowered.commands[cursor-rawLength];assert.equal(command.kind,expected.kind);
   if(expected.kind==='clear')assert.deepEqual(command,{kind:'clear',buffer:worldIds[expected.buffer],offset:expected.offset,size:expected.size});
   else{const definition=lowered.definitions[expected.definition];pipelineMatches(command.pipeline,definition);assert.deepEqual(command.xyz,[expected.x,1,1]);const entries=expected.entries.map(e=>({...e,buffer:worldIds[e.buffer]}));if(definition.faultBinding!==null)entries.push({binding:definition.faultBinding,buffer:faultId,offset:0,size:4});assert.deepEqual(bindingView(command.entries),entries);}
  }else if(cursor===rawLength+worldLength){assert.equal(command.kind,'dispatch');pipelineMatches(command.pipeline,gateDefinition);assert.deepEqual(command.xyz,[1,1,1]);assert.deepEqual(bindingView(command.entries),[{binding:0,buffer:faultId,offset:0,size:4},{binding:1,buffer:worldIds[plan.readback],offset:0,size:stride*4},{binding:2,buffer:idsId,offset:0,size:4}]);}
  else{assert.equal(cursor,rawLength+worldLength+1);assert.deepEqual(command,{kind:'copy',source:worldIds[plan.readback],sourceOffset:(stride-4)*4,target:readId,targetOffset:0,size:16});}
  cursor++;
 }
 const device={lost:new Promise(()=>{}),limits:{...engine.resources.requiredLimits,minStorageBufferOffsetAlignment:256},pushErrorScope(){},async popErrorScope(){return null;},
  createShaderModule:({code})=>({code,getCompilationInfo:async()=>({messages:[]})}),createBindGroupLayout:x=>x,createPipelineLayout:x=>x,
  async createComputePipelineAsync({layout,compute}){compiled++;return{code:compute.module.code,layout,entryPoint:compute.entryPoint,getBindGroupLayout:()=>({})};},
  createBuffer({size,usage}){const b={id:buffers.length,size,usage,dead:false,bytes:new Uint8Array(size),destroy(){b.dead=true;},async mapAsync(){},getMappedRange(){return b.bytes.buffer;},unmap(){}};buffers.push(b);return b;},
  createBindGroup:x=>x,
  createCommandEncoder(){const pending=[];return{beginComputePass(){let pipeline,entries;return{setPipeline:p=>pipeline=p,setBindGroup:(i,g)=>{assert.equal(i,0);entries=g.entries;},dispatchWorkgroups:(x,y=1,z=1)=>pending.push({kind:'dispatch',pipeline,entries,xyz:[x,y,z]}),end(){}};},clearBuffer:(b,offset=0,size=b.size-offset)=>pending.push({kind:'clear',buffer:b.id,offset,size}),copyBufferToBuffer:(a,sourceOffset,b,targetOffset,size)=>pending.push({kind:'copy',source:a.id,sourceOffset,target:b.id,targetOffset,size}),finish:()=>pending};},
  queue:{writeBuffer(b,offset,data){assert.equal(b.dead,false);const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);b.bytes.set(bytes,offset);writes++;},submit(batch){submits++;for(const commands of batch)for(const c of commands)verify(c);},async onSubmittedWorkDone(){}}
 };
 const owner=await prepareWasmGpuEngine({moduleBytes:await readFile(new URL('../artifacts/wasm-gpu-runtime.wasm',import.meta.url)),device,engine,rawEngine,maximumOwnedBytes:engine.resources.totalOwnedBytes,chunkSize:256});
 const allocationCount=buffers.length,compilationCount=compiled;
 assert.equal(allocationCount,next);assert.equal(buffers.reduce((n,b)=>n+b.size,0),engine.resources.totalOwnedBytes);
 const worldUploads=initialUploads.filter(u=>!plan.allocations[u.index].external);
 try{for(runNumber=1;runNumber<=2;runNumber++){
  cursor=0;const raw=rawUploads.map(u=>({index:u.index,initial:u.initial.slice()})),world=worldUploads.map(u=>({index:u.index,initial:u.initial.slice()}));
  // Deliberately changed host bytes establish fresh upload plumbing, NOT valid new physics.
  if(runNumber===2){raw[0].initial[0]^=1;world[0].initial[0]^=1;}
  const result=await owner.run({rawUploads:raw,initialUploads:world,candidateIds:new Uint32Array([100])});
  assert.equal(result.generation,runNumber);assert.equal(result.result.length,4);assert.equal(cursor,rawLength+worldLength+2);
  for(const u of raw)assert.deepEqual(buffers[rawIds[u.index]].bytes,u.initial);
  for(const u of world)assert.deepEqual(buffers[worldIds[u.index]].bytes,u.initial);
  assert.equal(buffers.length,allocationCount);assert.equal(compiled,compilationCount);
 }}finally{await owner.dispose();}
 assert.ok(buffers.every(b=>b.dead));assert.equal(writes,2*(rawUploads.length+worldUploads.length+2));assert.ok(submits>2);
 console.log(JSON.stringify({hostOnly:true,rawCommands:rawLength,worldCommands:worldLength,runs:2,submits,compiled,maxRSSKiB:process.resourceUsage().maxRSS}));
});
