/** Host-only source ABI and immutable independent baseline checks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {decodePreparedWorldReadback} from '../src/direct-candidate/deterministic-prepared-world-readback.mjs';
import {packSelectedWorldTraceV2Control,packSelectedWorldTraceV2PhaseConfig,decodeSelectedWorldTraceV2GPU} from '../src/direct-candidate/canonical-selected-world-trace-v2-gpu.mjs';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {createCanonicalWorldContinuationGPU} from '../src/direct-candidate/canonical-world-continuation.mjs';
import {createLiveWorldCaptureDevice} from '../src/direct-candidate/experimental-live-world-capture.mjs';
const layout={journalBytes:4224,journalAuxBytes:4096,rawStatusBytes:64,ruleBytes:208};
test('world final readback decoder preserves exact source ranges and owned copies',()=>{
 const words=Uint32Array.from({length:2916},(_,i)=>i);words[1]=9;const decoded=decodePreparedWorldReadback(words,layout);
 for(const [name,start,end]of [['words',0,768],['state',0,256],['dense',256,512],['firstPairEntry',512,640],['firstPairResponse',640,768],['journalWords',768,1824],['journalAuxWords',1824,2848],['rawHandoffStatus',2848,2864],['ruleState',2864,2912],['compactResult',2912,2916]])assert.deepEqual(decoded[name],words.slice(start,end),name);
 assert.equal(decoded.nominalRest,true);words.fill(0);assert.equal(decoded.dense[0],256);decoded.words[1]=0;assert.equal(decoded.state[1],9);
 const noRaw=decodePreparedWorldReadback(new Uint32Array(2848),{journalBytes:4224,journalAuxBytes:4096});assert.equal(noRaw.rawHandoffStatus,null);assert.equal(noRaw.ruleState,null);assert.equal(noRaw.compactResult,null);
 for(const bad of [{...layout,rawStatusBytes:60},{...layout,ruleBytes:204},{...layout,journalBytes:-4},{...layout,journalAuxBytes:1}])assert.throws(()=>decodePreparedWorldReadback(new Uint32Array(2916),bad),/layout/);
 assert.throws(()=>decodePreparedWorldReadback(new Uint32Array(2915),layout),/layout/);assert.throws(()=>decodePreparedWorldReadback([],layout),/Owned/);
});
test('trace current control and structural phase packing match original ABI and reject invalid inputs',()=>{
 const args={candidateCount:1,candidateId:0xffffffff,sceneKey:23,requestKey:71,bodyCount:4,maximumRecords:256};
 const control=packSelectedWorldTraceV2Control(args);assert.deepEqual(control,new Uint32Array([0x53574702,0,256,0,0,0,0,0xffffffff,23,71,4,0x4d4d5102,0,0,0,0]));
 const phase=packSelectedWorldTraceV2PhaseConfig({phase:9,mask:15});assert.equal(phase.length,32);assert.equal(phase[0],0x53574702);assert.equal(phase[1],9);assert.equal(phase[14],15);assert.equal(phase.filter(Boolean).length,3);
 for(const change of [{candidateCount:3},{maximumRecords:0},{maximumRecords:513},{candidateId:-1},{pinnedMotionVersion:1}])assert.throws(()=>packSelectedWorldTraceV2Control({...args,...change}),/bounded records/);
 for(const config of [{phase:0,mask:15},{phase:1,mask:0},{phase:1,mask:65536}])assert.throws(()=>packSelectedWorldTraceV2PhaseConfig(config),/phase/);
 const read=new Uint32Array(16+4096*256);read.set(control);const capture=decodeSelectedWorldTraceV2GPU(read);assert.equal(capture.captureComplete,false);assert.equal(capture.recordCount,0);assert.equal(capture.identity.candidateId,0xffffffff);
});
test('original selected source graph, all uploads, and output ranges match portable pre-extraction baseline',async()=>{
 const golden=JSON.parse(await readFile(new URL('./fixtures/selected-source-native-baseline-digests.json',import.meta.url),'utf8'));assert.equal(golden.sourceCommit,'715b503f57f6962d99c7a85a787995284960ee8b');
 const sha=x=>createHash('sha256').update(x).digest('hex'),r=createLiveWorldCaptureDevice({allowCushionIndirect:true}),create=r.device.createBuffer,stop={};let mapCount=0;
 r.device.createBuffer=d=>{const b=create(d);if(d.usage&1)b.mapAsync=async()=>{assert.equal(r.submits,1);mapCount++;throw stop;};return b;};
 const f=mmq2RawFixture({durationTicks:65535}),engine=await createCanonicalWorldContinuationGPU(r.device,f.binding);let caught=false;try{await engine.runRaw(f.batch,{selectedTrace:true,selectedTraceMaxRecords:256});}catch(e){if(e!==stop)throw e;caught=true;}
 assert.equal(caught,true);assert.equal(mapCount,1);assert.equal(r.submits,1);
 for(const [name,records]of [['modules',r.modules.map(m=>({code:m.code,label:m.label}))],['pipelines',r.pipelines.map(p=>({entryPoint:p.entryPoint,layout:p.layout,constants:p.constants,module:p.module.id}))],['commands',r.commands]])assert.deepEqual({count:records.length,sha256:sha(JSON.stringify(records))},golden[name]);
 assert.deepEqual(r.buffers.map(b=>[b.size,b.usage,sha(b.bytes)]),golden.buffers.map(index=>golden.bufferRecords[index]));
 const world=r.buffers.find(b=>b.label==='wasm-output:world:read'),trace=r.buffers.find(b=>b.label==='wasm-output:trace-v2:read');assert.equal(world.size,11664);assert.equal(trace.size,4194368);assert.equal(r.commands.filter(c=>c.kind==='copy'&&c.target===world.id).length,8);assert.equal(r.commands.filter(c=>c.kind==='copy'&&c.target===trace.id).length,2);
 const control=r.buffers.find(b=>b.label==='wasm-input:trace-v2:control');assert.deepEqual(new Uint32Array(control.bytes.buffer),packSelectedWorldTraceV2Control({candidateCount:1,candidateId:f.candidate.candidateId,sceneKey:f.batch.binding.sceneKey,requestKey:f.batch.binding.requestKey,bodyCount:4,maximumRecords:256}));
 for(const b of r.buffers.filter(b=>b.label.startsWith('wasm-fixed:trace-v2:phase:'))){const [phase,mask]=b.label.slice('wasm-fixed:trace-v2:phase:'.length).split(':').map(Number);assert.deepEqual(new Uint32Array(b.bytes.buffer),packSelectedWorldTraceV2PhaseConfig({phase,mask}));}
});
