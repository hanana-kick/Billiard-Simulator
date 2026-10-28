/** A bounded production-service integration proof, not a browser/hardware test.
 * Generate original CPU packets in a separate process BEFORE the native run:
 * node tests/canonical-compact-search-native.mjs --prepare /tmp/search-reference.json
 */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
const sha=x=>createHash('sha256').update(x).digest('hex'),pinURL=new URL('./fixtures/live-world-upload-host-source-pin.json',import.meta.url);
async function prepare(filename){
 const {fixture}=await import('./fixtures/canonical-selected-source.mjs'),{createCanonicalRequest,createCanonicalCandidate}=await import('../src/direct-candidate/canonical-engine-contract.mjs'),
  {prepareRawWorldBinding,prepareRawWorldBatch}=await import('../src/direct-candidate/deterministic-raw-world.mjs'),
  {prepareCanonicalWorldContinuation,runCanonicalRawWorldContinuationCPU}=await import('../src/direct-candidate/canonical-world-continuation.mjs');
 const f=fixture(),request={scene:f.request.scene,requestId:71,selectedId:f.request.selectedId,purpose:'search',executionProfile:'canonical-local-v1',budget:f.request.budget,rules:{...f.request.rules,search:false}},
  raw={absoluteTick:1234,sceneKey:11,requestKey:23,maximumSteps:2048},continuation={durationTicks:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:128},
  population=[0,45,10,1,330,-1].map((angle,i)=>({candidateId:[100,101,102,0xfffffffe,104,105][i],settings:{...f.candidate.settings,angle}})),
  owned=createCanonicalRequest({...request,epoch:1}),rawBinding=prepareRawWorldBinding(owned,raw),binding=prepareCanonicalWorldContinuation(owned,rawBinding.shotClock,{...continuation,sceneKey:raw.sceneKey,requestKey:raw.requestKey}),packets=[];
 for(const row of population){const c=createCanonicalCandidate(owned,row.candidateId,row.settings);assert.equal(c.admitted,true);const result=runCanonicalRawWorldContinuationCPU(binding,prepareRawWorldBatch(rawBinding,[c],{maximumSteps:raw.maximumSteps}));assert.ok(result.continuation);packets.push(Array.from(result.continuation.compactResult));}
 assert.ok(packets.some(p=>p[1]===1&&p[3]===1));assert.ok(packets.some(p=>p[1]!==1));
 const pin=JSON.parse(await fs.readFile(pinURL,'utf8'));assert.equal(pin.reviewStatus,'reviewed');
 // Exact reviewed source bytes, not just a version label, must still match.
 for(const [name,bytes]of Object.entries(pin.files))assert.equal(await fs.readFile(new URL('../'+name,import.meta.url),'utf8'),bytes,name);
 const output={kind:'canonical-compact-search-native-reference-v1',sourceRevision:sha(JSON.stringify(pin.files)),request,raw,continuation,population,packets};
 await fs.writeFile(filename,JSON.stringify(output));console.log(JSON.stringify({referenceFile:filename,sourceRevision:output.sourceRevision,packets,sha256:sha(JSON.stringify(output))}));
}
if(process.argv[2]==='--prepare')await prepare(process.argv[3]);
else test('sealed production compact search runs N3 twice with exact GOAL/nonpass original CPU packets',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:240000},async t=>{
 const path=process.env.LIVE_WORLD_ENGINE_BUNDLE,expectedArtifact=process.env.LIVE_WORLD_ENGINE_SHA256,referencePath=process.env.CANONICAL_SEARCH_REFERENCE,expectedReference=process.env.CANONICAL_SEARCH_REFERENCE_SHA256;
 assert.ok(path&&expectedArtifact&&referencePath&&expectedReference,'Explicit reviewed artifact and precomputed references required');
 const [artifact,referenceBytes,pinBytes]=await Promise.all([fs.readFile(path),fs.readFile(referencePath),fs.readFile(pinURL,'utf8')]);
 assert.equal(sha(artifact),expectedArtifact);assert.equal(sha(referenceBytes),expectedReference);const reference=JSON.parse(referenceBytes),pin=JSON.parse(pinBytes);
 assert.equal(pin.reviewStatus,'reviewed');assert.equal(reference.kind,'canonical-compact-search-native-reference-v1');assert.equal(reference.sourceRevision,sha(JSON.stringify(pin.files)));
 assert.equal(reference.population.length,6);assert.equal(reference.packets.length,6);assert.ok(reference.packets.every(p=>p.length===4));
 for(const[name,bytes]of Object.entries(pin.files))assert.equal(await fs.readFile(new URL('../'+name,import.meta.url),'utf8'),bytes,name);
 const module=await import('data:text/javascript;base64,'+artifact.toString('base64'));
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice({requiredLimits:{maxStorageBuffersPerShaderStage:9}});
 let pipelineCompiles=0,shaderModules=0;const wrapped=new Proxy(device,{get(target,key){if(key==='createComputePipelineAsync')return options=>{pipelineCompiles++;return target.createComputePipelineAsync(options);};if(key==='createShaderModule')return options=>{shaderModules++;return target.createShaderModule(options);};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
 const service=module.createCanonicalCompactSearchService({device:wrapped,selectedWorldProfile:'mmq1-ball-ball'}),updates=[],started=performance.now();
 try{
  assert.equal(service.sourceRevision,reference.sourceRevision);assert.equal(service.capabilities.implementation,'webgpu-sealed-compact-search-v1');
  console.log('SEARCH_NATIVE_START',JSON.stringify({sourceRevision:reference.sourceRevision,artifactSHA256:expectedArtifact,referenceSHA256:expectedReference}));
  const result=await service.runSearch({...reference,assertCurrent(){},onBatch:update=>{updates.push({tested:update.tested,pipelineCompiles,shaderModules});console.log('SEARCH_NATIVE_BATCH',JSON.stringify(updates.at(-1)));}});
  assert.deepEqual(result.rows.map(r=>r.packet),reference.packets);assert.deepEqual(updates.map(x=>x.tested),[3,6]);
  assert.ok(updates[0].pipelineCompiles>0);assert.equal(updates[1].pipelineCompiles,updates[0].pipelineCompiles);assert.equal(updates[1].shaderModules,updates[0].shaderModules);
  assert.ok(result.counts.pass>0);assert.ok(result.counts.miss+result.counts.incomplete+result.counts.unsupported>0);
  assert.equal(result.metrics.length,2);assert.deepEqual(result.metrics.map(m=>m.readbackBytes),[48,48]);assert.equal(result.tested,6);result.assertCurrent();
  const report={sourceRevision:result.sourceRevision,exactCompactWords:24,packets:result.rows.map(r=>r.packet),counts:result.counts,progress:updates,
   pipelineCompiledOnlyBeforeFirstTile:true,readbackBytes:96,elapsedMs:performance.now()-started,metrics:result.metrics,
   cpuReferenceComputedInSeparateProcess:true,selectedShotReexecutionQualified:false,physicalHardwareVerified:false,browserVerified:false};
  t.diagnostic(JSON.stringify(report));service.cancel('native proof finished');assert.throws(()=>result.assertCurrent(),{code:'SEARCH_CANCELLED'});
 }finally{service.dispose();device.destroy();gpu.destroy?.();}
});
