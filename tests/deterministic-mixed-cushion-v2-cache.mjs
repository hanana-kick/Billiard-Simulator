import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {rollingWall,material} from './fixtures/mixed-cushion-v2.mjs';
import {wall,scene,hulls} from './fixtures/mixed-motion-query.mjs';
import {sampleMixedMotionV2CPU} from '../src/direct-candidate/deterministic-mixed-motion-v2.mjs';
import {runMixedCushionEntryV2CPU} from '../src/direct-candidate/deterministic-mixed-cushion-v2.mjs';
import {packMixedCushionConfig} from '../src/direct-candidate/deterministic-mixed-cushion-entry.mjs';
import {createMixedCushionEntryV2GPU,MIXED_V2_HULL_ENTRY_WGSL,MIXED_V2_HULL_ENDPOINT_CACHE_WGSL,MIXED_V2_HULL_ENDPOINT_CACHE_WORDS} from '../src/direct-candidate/deterministic-mixed-cushion-v2-gpu.mjs';

test('selected endpoint cache keeps one original full-roster sampler and eight storage bindings',()=>{
 assert.equal(MIXED_V2_HULL_ENDPOINT_CACHE_WORDS,256);
 assert.ok(MIXED_V2_HULL_ENTRY_WGSL.includes('lowState=cachedHullState(body,lo,0u)'));
 assert.ok(MIXED_V2_HULL_ENTRY_WGSL.includes('upperState=cachedHullState(body,hi,endpointSlot)'));
 assert.ok(MIXED_V2_HULL_ENTRY_WGSL.includes('allStates[i]=hs(i,hi)'));
 assert.equal([...MIXED_V2_HULL_ENTRY_WGSL.matchAll(/@binding\((\d+)\)/g)].length,8);
 assert.match(MIXED_V2_HULL_ENDPOINT_CACHE_WGSL,/@workgroup_size\(16\)/);
 assert.ok(MIXED_V2_HULL_ENTRY_WGSL.includes('for(var j=0u;j<80u;j++){valid=valid & (endpointCache[16u+j]==rows[b+j]);}'));
});

test('native selected endpoint cache preserves full entry and rejects stale source rail clock and slot bindings',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:180000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();
 const owned=[];const alloc=(data,usage=128|4|8)=>{const b=device.createBuffer({size:typeof data==='number'?data:data.byteLength,usage});owned.push(b);if(typeof data!=='number')device.queue.writeBuffer(b,0,data);return b;};
 try{
  const engine=await createMixedCushionEntryV2GPU(device,material);let parityWords=0;
  const old=wall.packet.slice();for(let b=0;b<old.length;b+=80)old[b]=0x4d4d5102;
  for(const rs of[rollingWall(),rollingWall(1),rollingWall(2*23767),rollingWall(2*23768),old]){
   const expected=runMixedCushionEntryV2CPU(rs,scene,hulls,{},material),actual=await engine.run(rs,scene,hulls,{});
   for(const key of['query','times','entry','admission','motion','states','advanced','response','state']){const value=key==='times'?new Uint32Array(expected.times.flatMap(x=>Array.from(x))):expected[key];assert.deepEqual(actual[key],value,key);parityWords+=value.length;}
   assert.equal(actual.metrics.endpointCacheBytes,1024);assert.equal(actual.metrics.dispatches,16);
  }
  const rows=rollingWall(),expected=runMixedCushionEntryV2CPU(rows,scene,hulls,{},material),ledger=expected.query,selected=ledger[4],z=32+8*selected,body=ledger[z+1],rail=ledger[z+2],n=rows.length/80;
  const rs=alloc(rows),hull=alloc(hulls[rail]),q=alloc(ledger),cfg=alloc(packMixedCushionConfig(rows,scene,rail,material)),cache=alloc(1024),entry=alloc(512),packets=alloc(768),advanced=alloc(640),read=alloc(1920,1|8);
  const readBuffers=async buffers=>{const e=device.createCommandEncoder();let at=0;for(const [b,size]of buffers){e.copyBufferToBuffer(b,0,read,at,size);at+=size;}device.queue.submit([e.finish()]);await read.mapAsync(1);const out=new Uint32Array(read.getMappedRange()).slice(0,at/4);read.unmap();return out;};
  let original;let sampledWords=0;
  for(const extension of[1,64,255,256]){
   const config=packMixedCushionConfig(rows,scene,rail,{...material,maxExtensionTicks:extension});device.queue.writeBuffer(cfg,0,config);
   const e=device.createCommandEncoder();engine.encode(e,6,[rs,hull,q,cfg,cache]);device.queue.submit([e.finish()]);const c=await readBuffers([[cache,1024]]);
   assert.deepEqual(c.slice(16,96),rows.slice(body*80,body*80+80));
   for(let slot=0;slot<10;slot++){const at=96+16*slot,width=slot===0?0:2**(slot-1);if(slot&&width>extension){assert.equal(c.slice(at,at+16).some(x=>x),false);continue;}const time=slot===0?ledger[z+4]:Math.min(ledger[2],ledger[z+5]+width-1),sample=sampleMixedMotionV2CPU(rows,body,time);assert.equal(c[at],sample[1]===1?1:0);assert.equal(c[at+1],time);assert.deepEqual(c.slice(at+6,at+15),sample.slice(64,73));sampledWords+=9;}
   if(extension===64)original=c;
  }
  device.queue.writeBuffer(cfg,0,packMixedCushionConfig(rows,scene,rail,material));
  const slots=[...Array.from({length:14},(_,i)=>i),...Array.from({length:80},(_,i)=>16+i)];
  for(let slot=0;slot<8;slot++)for(const offset of[1,2,3,4,5,15])slots.push(96+16*slot+offset);
  const initialEntry=new Uint32Array(128);initialEntry.set([0x4d434501,6,0xffffffff,0xffffffff,0,0,1]);
  const initialAdvanced=new Uint32Array(160);initialAdvanced.set([0x4d434501,6,0,n]);
  for(const changed of[-1,...slots]){
   const c=original.slice();if(changed>=0)c[changed]^=1;device.queue.writeBuffer(cache,0,c);device.queue.writeBuffer(entry,0,initialEntry);device.queue.writeBuffer(advanced,0,initialAdvanced);device.queue.writeBuffer(packets,0,new Uint32Array(192));
   const e=device.createCommandEncoder();engine.encode(e,3,[rs,hull,q,cfg,entry,packets,advanced,cache]);device.queue.submit([e.finish()]);const got=await readBuffers([[entry,512],[packets,768],[advanced,640]]);
   if(changed===-1){assert.deepEqual(got.slice(0,128),expected.entry);assert.deepEqual(got.slice(320),expected.advanced);}else{assert.equal(got[1],6,'no impulse admission: '+changed);assert.equal(got[6],7,'stale source/cache refusal: '+changed);assert.equal(got.slice(128,320).some(x=>x),false);assert.deepEqual(got.slice(320),initialAdvanced);}
  }
  const ledgerMutations=[['selected-body',z+1],['lower-bracket',z+4],['upper-bracket',z+5],['horizon',2]];
  for(const [label,index]of ledgerMutations){
   const next=ledger.slice();next[index]++;device.queue.writeBuffer(q,0,next);device.queue.writeBuffer(cache,0,original);device.queue.writeBuffer(entry,0,initialEntry);device.queue.writeBuffer(advanced,0,initialAdvanced);device.queue.writeBuffer(packets,0,new Uint32Array(192));
   const e=device.createCommandEncoder();engine.encode(e,3,[rs,hull,q,cfg,entry,packets,advanced,cache]);device.queue.submit([e.finish()]);const got=await readBuffers([[entry,512],[packets,768],[advanced,640]]);
   assert.equal(got[1],6,label);assert.equal(got[6],7,label);assert.equal(got.slice(128,320).some(x=>x),false,label);assert.deepEqual(got.slice(320),initialAdvanced,label);
  }
  device.queue.writeBuffer(q,0,ledger);
  const changedRows=rows.slice();changedRows[body*80+8]++;device.queue.writeBuffer(rs,0,changedRows);device.queue.writeBuffer(cache,0,original);device.queue.writeBuffer(entry,0,initialEntry);device.queue.writeBuffer(advanced,0,initialAdvanced);device.queue.writeBuffer(packets,0,new Uint32Array(192));
  const staleEncoder=device.createCommandEncoder();engine.encode(staleEncoder,3,[rs,hull,q,cfg,entry,packets,advanced,cache]);device.queue.submit([staleEncoder.finish()]);const stale=await readBuffers([[entry,512],[packets,768],[advanced,640]]);assert.equal(stale[1],6);assert.equal(stale[6],7);assert.equal(stale.slice(128,320).some(x=>x),false);assert.deepEqual(stale.slice(320),initialAdvanced);
  t.diagnostic(JSON.stringify({fullEntryCases:5,parityWords,cachedSampleWords:sampledWords,staleCacheCases:slots.length,changedLedgerCases:ledgerMutations.length,changedCurrentSourceCases:1,cacheBytes:1024,compileMs:engine.compileMs,exactCPUAndGPU:true,scope:'selected cache and entry only'}));
 }finally{owned.forEach(b=>b.destroy());device.destroy();gpu.destroy?.();}
});
