import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import zlib from 'node:zlib';import esbuild from 'esbuild';
import {buildSelectedSnapshotPlan,instrumentSelectedBridgeSource,createSelectedDiagnosticBridgePlugin} from '../tools/build-selected-diagnostic-bridge.mjs';
import {createSelectedDiagnosticCopies} from './fixtures/selected-diagnostic-copies.mjs';
const root=new URL('../',import.meta.url),artifact=JSON.parse(zlib.gunzipSync(await fs.readFile(new URL('dist/canonical-controller-assets/wasm-gpu-programs/selected-n1.json.gz',root)))),plan=buildSelectedSnapshotPlan(artifact);
test('frozen first16 plan stays within original budget, copies exact COPY_SRC views',()=>{
 assert.equal(plan.diagnosticBytes,1268736);assert.equal(plan.totalOwnedBytes,10054020);assert.equal(plan.diagnosticCopyCount,1264);assert.ok(plan.totalOwnedBytes<12*1024*1024);assert.ok(plan.totalEncodedCommands<131072);
 for(const r of plan.rows){const a=artifact.payload.allocations[r.buffer];assert.ok(a.usage&4);assert.ok(r.offset+r.size<=a.size);}
 const forged=structuredClone(artifact);forged.payload.allocations[0].size+=4;assert.throws(()=>buildSelectedSnapshotPlan(forged),/Frozen/);
});
test('diagnostic mock copies without intermediate map and owns cleanup',async()=>{
 let copies=0,maps=0,destroys=0;const device={createBuffer:o=>({...o,mapAsync:async()=>maps++,getMappedRange:()=>new ArrayBuffer(o.size),unmap(){},destroy(){destroys++;}}),queue:{onSubmittedWorkDone:async()=>{}}};
 const options={artifactSHA256:plan.artifactSHA256,baselineOwnedBytes:plan.baselineOwnedBytes},d=createSelectedDiagnosticCopies(device,plan,options);
 const e={copyBufferToBuffer(source,offset,destination,targetOffset,size){assert.ok(offset+size<=source.size);assert.ok(targetOffset+size<=destination.size);copies++;}};
 for(let i=0;i<plan.baselineCommandCount;i++)for(const when of ['before','after'])d.snapshot(e,i,when,artifact.payload.allocations,()=>{});
 assert.equal(copies,1264);assert.equal(maps,0);assert.equal((await d.finish()).byteLength,1268736);assert.equal(maps,1);await assert.rejects(d.finish(),/Incomplete|repeated/);d.destroy();d.destroy();assert.equal(destroys,1);
 assert.throws(()=>createSelectedDiagnosticCopies(device,plan,{...options,maximumOwnedBytes:10}),/budget/);
 const incomplete=createSelectedDiagnosticCopies(device,plan,options);await assert.rejects(incomplete.finish(),/Incomplete/);incomplete.destroy();assert.equal(destroys,2);
});
test('test-only bundle uses hash-gated original bridge; production remains unchanged',async()=>{
 const sourcePath=new URL('src/wasm-gpu/selected-webgpu-bridge.mjs',root),source=await fs.readFile(sourcePath,'utf8'),helper=await fs.readFile(new URL('tests/fixtures/selected-diagnostic-copies.mjs',root),'utf8');
 assert.throws(()=>instrumentSelectedBridgeSource(source+'\n',helper,plan),/Unreviewed/);
 const built=await esbuild.build({entryPoints:[sourcePath.pathname],bundle:true,write:false,format:'esm',platform:'browser',plugins:[createSelectedDiagnosticBridgePlugin({plan})],logLevel:'silent'});
 assert.equal(built.outputFiles.length,1);assert.match(built.outputFiles[0].text,/__captureSelectedDiagnostic/);assert.equal(await fs.readFile(sourcePath,'utf8'),source);
});
test('host analyzer refuses observer effects before interpreting captured invariant mismatches',async()=>{
 const {analyzeSelectedDiagnostic}=await import('../tools/analyze-selected-diagnostic.mjs');
 const baseline={world:new Uint32Array(2916),trace:new Uint32Array(1048592)},observed={world:baseline.world.slice(),trace:baseline.trace.slice()},words=new Uint32Array(plan.diagnosticBytes/4);
 const write=(name,index,value)=>{const r=plan.rows.find(r=>r.iteration===0&&r.stage==='cushion-owner'&&r.when==='before'&&r.name===name);words[r.destinationOffset/4+index]=value;};
 write('ctx',13,1);write('source',1,7);write('source',2,6);write('source',3,4);write('source',4,65535);write('source',6,0xffffffff);
 const report=analyzeSelectedDiagnostic({plan,words,baseline,observed});assert.equal(report.baselineParity,true);assert.equal(report.ownerChecks[0].active,true);assert.ok(report.ownerChecks[0].mismatches.some(x=>x.name==='rows.horizon'));
 observed.trace[100]=1;assert.throws(()=>analyzeSelectedDiagnostic({plan,words,baseline,observed}),/observer effect/);
});
