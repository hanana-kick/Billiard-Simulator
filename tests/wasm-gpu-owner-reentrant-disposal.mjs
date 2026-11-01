/** Host-only actual WASM scheduler; no native GPU or physical trajectory oracle. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareWasmGpuOwner} from '../src/wasm-gpu/owner-core.mjs';
const moduleBytes=await readFile(new URL('../artifacts/wasm-gpu-runtime.wasm',import.meta.url));
test('synchronous upload observer disposal waits for run drain and adopted lease release',async()=>{
 const events=[];let disposal,releaseLease;
 const releaseGate=new Promise(resolve=>{releaseLease=resolve;});
 const bridge={commandCount:1,beginRun(){assert.fail('Cancelled upload must not start');},encodeChunk(){assert.fail('Cancelled run must not encode');},cancel(){},lose(){},async drain(){events.push('drain');},async dispose(){events.push('destroy');},finish(){assert.fail('Cancelled run must not finish');}};
 const owner=await prepareWasmGpuOwner({moduleBytes,device:{lost:new Promise(()=>{})},bridge,chunkSize:1,snapshotRun:()=>({begin:{},async release(){events.push('release-start');await releaseGate;events.push('release-end');}})});
 const run=owner.run({onExecutionPhase(detail){assert.equal(detail.executionStage,'upload');disposal=owner.dispose();assert.equal(owner.dispose(),disposal);}});
 const rejected=assert.rejects(run,{name:'AbortError'});
 await new Promise(resolve=>setImmediate(resolve));
 const earlyDestroy=events.includes('destroy');
 releaseLease();await rejected;await disposal;
 assert.equal(earlyDestroy,false,'Disposal must not destroy resources while the adopted run still owns its lease');
 assert.deepEqual(events,['drain','release-start','release-end','destroy']);
 assert.equal(owner.status().state,'disposed');
});
test('chunk progress observer disposal cancels immediately but waits for run cleanup',async()=>{
 const events=[];let disposal;
 const bridge={commandCount:1,async beginRun(){events.push('begin');},async encodeChunk(){events.push('encode');},cancel(){events.push('cancel');},lose(){},async drain(){events.push('drain');},async dispose(){events.push('destroy');},finish(){assert.fail('Cancelled progress must not finish');}};
 const owner=await prepareWasmGpuOwner({moduleBytes,device:{lost:new Promise(()=>{})},bridge,chunkSize:1,snapshotRun:()=>({begin:{},async release(){events.push('release');}})});
 await assert.rejects(owner.run({onProgress(){disposal=owner.dispose();assert.equal(owner.dispose(),disposal);assert.ok(events.includes('cancel'));}}),{name:'AbortError'});
 await disposal;assert.ok(events.indexOf('drain')<events.indexOf('release'));assert.ok(events.indexOf('release')<events.indexOf('destroy'));
});
for(const runFirst of [false,true])test('no-active disposal is idempotent '+(runFirst?'after successful finish':'before first run'),async()=>{
 const events=[];
 const bridge={commandCount:1,async beginRun(){},async encodeChunk(){},cancel(){},lose(){},async drain(){events.push('drain');},async dispose(){events.push('destroy');},async finish(){events.push('finish');return new Uint32Array([11]);}};
 const owner=await prepareWasmGpuOwner({moduleBytes,device:{lost:new Promise(()=>{})},bridge,chunkSize:1,snapshotRun:()=>({begin:{},async release(){events.push('release');}})});
 if(runFirst)assert.deepEqual((await owner.run()).result,new Uint32Array([11]));
 const disposal=owner.dispose();assert.equal(owner.dispose(),disposal);await disposal;await owner.dispose();
 assert.equal(events.filter(x=>x==='destroy').length,1);if(runFirst)assert.deepEqual(events,['finish','drain','release','destroy']);
 await assert.rejects(owner.run(),/disposed/);
});
