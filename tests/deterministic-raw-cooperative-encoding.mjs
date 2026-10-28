/** Host command ordering only. No shader execution, GPU adapter, or physics replay. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRawStrikeGPU,packStrikeScene,packRawStrikes} from '../src/direct-candidate/deterministic-raw-strike.mjs';
import {createRawWorldGPU} from '../src/direct-candidate/deterministic-raw-world.mjs';
import {createLiveWorldCaptureDevice} from '../src/direct-candidate/experimental-live-world-capture.mjs';
import {fixture} from './fixtures/canonical-selected-source.mjs';
const scene=packStrikeScene({kind:'complete-isolated-sphere-fixed-aabbs',complete:true,materialProfile:'physicslab-defaults-v1',support:'cloth',center:[0,.03075,0],floorTop:0,obstacles:[]});
async function strike(maximumSteps=2048){const record=createLiveWorldCaptureDevice(),engine=await createRawStrikeGPU(record.device),bank=engine.createBank(scene,packRawStrikes([{id:1,angle:0,elevation:25,speed:.5,tipX:0,tipY:.2,maximumSteps}]));return{record,bank};}
function scheduler(record,limit){let encoder=record.device.createCommandEncoder(),count=0,inFlight=false;const chunks=[];return{chunks,getEncoder(){assert.equal(inFlight,false,'Never encode next chunk before drain');return encoder;},async afterCommand(){count++;if(count===limit){inFlight=true;chunks.push(count);await new Promise(resolve=>setTimeout(resolve,0));inFlight=false;count=0;encoder=record.device.createCommandEncoder();}},finish(){if(count)chunks.push(count);}};}
for(const maximumSteps of [1,2,2048])test('raw cooperative exact pass ordering across bounded chunks, steps '+maximumSteps,async()=>{
 const {record,bank}=await strike(maximumSteps);bank.encode(record.device.createCommandEncoder());const expected=structuredClone(record.commands);record.commands.length=0;
 const schedule=scheduler(record,256);await bank.encodeCooperatively(schedule);schedule.finish();assert.deepEqual(record.commands,expected);assert.equal(expected.length,bank.dispatches);assert.equal(expected.length,2+4*maximumSteps);assert.ok(schedule.chunks.every(n=>n<=256));assert.equal(schedule.chunks.reduce((a,b)=>a+b,0),expected.length);
 assert.deepEqual(expected.map(x=>x.pipeline),[0,...Array.from({length:maximumSteps},()=>[1,2,3,4]).flat(),5]);bank.dispose();
});
test('raw cancellation at chunk boundary prevents all subsequent passes including finalize',async()=>{
 const {record,bank}=await strike(),controller=new AbortController();let count=0;await assert.rejects(bank.encodeCooperatively({getEncoder:()=>record.device.createCommandEncoder(),afterCommand:async()=>{if(++count===256){await new Promise(resolve=>setTimeout(resolve,0));controller.abort();}},signal:controller.signal}),{name:'AbortError'});assert.equal(record.commands.length,256);assert.ok(record.commands.every(x=>x.pipeline!==5));bank.dispose();
});
test('pre-abort, disposal, and callback failure stop without encoding extra passes',async()=>{
 const {record,bank}=await strike(2),controller=new AbortController();controller.abort();const options={getEncoder:()=>record.device.createCommandEncoder(),afterCommand:async()=>{}};
 await assert.rejects(bank.encodeCooperatively({...options,signal:controller.signal}),{name:'AbortError'});assert.equal(record.commands.length,0);
 await assert.rejects(bank.encodeCooperatively({...options,afterCommand:async()=>{throw Error('drain failed');}}),/drain failed/);assert.equal(record.commands.length,1);
 bank.dispose();await assert.rejects(bank.encodeCooperatively(options),/Disposed/);assert.equal(record.commands.length,1);
});
test('world cooperative handoff follows the identical raw prefix and cannot pass cancellation',async()=>{
 const record=createLiveWorldCaptureDevice(),engine=await createRawWorldGPU(record.device),bank=engine.createBank(fixture().batch);bank.encode(record.device.createCommandEncoder());const expected=structuredClone(record.commands);record.commands.length=0;
 const schedule=scheduler(record,255);await bank.encodeCooperatively(schedule);schedule.finish();assert.deepEqual(record.commands,expected);assert.equal(expected.length,bank.dispatches);assert.equal(record.pipelines[expected.at(-1).pipeline].module.label,'raw_world_handoff');
 record.commands.length=0;const controller=new AbortController();let count=0;
 await assert.rejects(bank.encodeCooperatively({getEncoder:()=>record.device.createCommandEncoder(),afterCommand:async()=>{if(++count===bank.rawPhysicsDispatches)controller.abort();},signal:controller.signal}),{name:'AbortError'});
 assert.deepEqual(record.commands,expected.slice(0,-1));bank.dispose();
});
