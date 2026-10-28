import test from 'node:test';
import assert from 'node:assert/strict';
import {createRawWorldGPU} from '../src/direct-candidate/deterministic-raw-world.mjs';
import {createRawStrikeGPU} from '../src/direct-candidate/deterministic-raw-strike.mjs';
import {createLiveWorldCaptureDevice} from '../src/direct-candidate/experimental-live-world-capture.mjs';
function fake(){const r=createLiveWorldCaptureDevice(),events=[];r.device.lost=new Promise(()=>{});const make=r.device.createShaderModule;r.device.createShaderModule=d=>{events.push(['module',d.label]);const m=make(d);m.getCompilationInfo=async()=>{events.push(['info',d.label]);return{messages:[]};};return m;};const compile=r.device.createComputePipelineAsync;r.device.createComputePipelineAsync=async d=>{events.push(['pipeline',d.compute.module.label]);return compile(d);};return{...r,events};}
test('raw staged full preflight precedes lowering; repeated device retains seven pipelines',async()=>{
 const r=fake(),observed=[];await createRawWorldGPU(r.device,{reusePipelines:true,onCompileStage:x=>observed.push([x.name,x.phase])});
 assert.equal(r.modules.length,7);assert.equal(r.pipelines.length,7);
 assert.equal(r.events.slice(0,r.events.findIndex(x=>x[0]==='pipeline')).filter(x=>x[0]==='info').length,7);
 assert.equal(observed.filter(x=>x[1]==='parse-complete').length,7);
 assert.equal(observed.filter(x=>x[1]==='start').length,6);
 assert.equal(observed.filter(x=>x[1]==='complete').length,7);
 const again=[];await createRawWorldGPU(r.device,{reusePipelines:true,onCompileStage:x=>again.push([x.name,x.phase])});
 assert.equal(r.modules.length,14);assert.equal(r.pipelines.length,7);assert.deepEqual(again,observed);
 const other=fake();await createRawWorldGPU(other.device,{reusePipelines:true});assert.equal(other.pipelines.length,7);
});
test('observer cancellation during full preflight never starts pipeline lowering',async()=>{
 const r=fake();await assert.rejects(createRawWorldGPU(r.device,{reusePipelines:true,onCompileStage:x=>{if(x.name==='raw_world_handoff')throw Error('cancelled');}}),/cancelled/);
 assert.equal(r.modules.length,7);assert.equal(r.pipelines.length,0);
});
test('capture device remains non-native and accepts unchanged recording contract',async()=>{
 const r=createLiveWorldCaptureDevice();await createRawWorldGPU(r.device);assert.equal(r.modules.length,13);assert.equal(r.pipelines.length,7);
});
test('abort during native raw pipeline completion cannot populate restart cache',async()=>{
 const r=fake(),abort=new AbortController(),compile=r.device.createComputePipelineAsync;let once=true;
 r.device.createComputePipelineAsync=async d=>{const p=await compile(d);if(once){once=false;abort.abort();}return p;};
 await assert.rejects(createRawWorldGPU(r.device,{reusePipelines:true,signal:abort.signal}),{name:'AbortError'});
 assert.equal(r.pipelines.length,1);await createRawWorldGPU(r.device,{reusePipelines:true});assert.equal(r.pipelines.length,8);
});

test('native standalone raw default preserves historical module and pipeline counts',async()=>{const r=fake();await createRawWorldGPU(r.device);await createRawWorldGPU(r.device);assert.equal(r.modules.length,26);assert.equal(r.pipelines.length,14);});
test('raw reuse requires an explicit boolean before allocation',async()=>{const r=fake();for(const factory of [createRawWorldGPU,createRawStrikeGPU])await assert.rejects(factory(r.device,{reusePipelines:'true'}),/Explicit pipeline reuse flag/);assert.equal(r.modules.length,0);});
