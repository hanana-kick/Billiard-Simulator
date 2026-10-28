/** Public packaged entry → native compact search → apply → native selected shot.
 * Host DOM callbacks are inert; this is NOT browser/UI qualification.
 */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
const sha=x=>createHash('sha256').update(x).digest('hex');
async function prepare(filename){
 const {createNativeControllerHost}=await import('./fixtures/canonical-controller-native-host.mjs'),host=createNativeControllerHost();
 try{const {createCanonicalPracticePreset}=await import('../src/direct-candidate/canonical-practice-entry.mjs'),{canonicalSearchPopulation}=await import('../src/direct-candidate/canonical-controller-search.mjs'),
  {canonicalApplicationRules}=await import('../src/direct-candidate/canonical-application-adapter.mjs'),{createCanonicalRequest,createCanonicalCandidate}=await import('../src/direct-candidate/canonical-engine-contract.mjs'),
  {prepareRawWorldBinding,prepareRawWorldBatch}=await import('../src/direct-candidate/deterministic-raw-world.mjs'),{prepareCanonicalWorldContinuation,runCanonicalRawWorldContinuationCPU}=await import('../src/direct-candidate/canonical-world-continuation.mjs');
  const preset=createCanonicalPracticePreset(),{population}=canonicalSearchPopulation(preset.searchOptions),game=new FourBallGame([50,19],[8,300],{threeCushion:false}),rules=canonicalApplicationRules(game.snapshot(),50,preset.scene.slotToId),o=preset.requestOptions;
  const requestOptions={scene:preset.scene,requestId:1,selectedId:50,purpose:'search',rules,executionProfile:o.executionProfile,budget:o.budget},packets=[];
  const execute=(requestOpts,row)=>{const request=createCanonicalRequest({...requestOpts,epoch:1}),candidate=createCanonicalCandidate(request,row.candidateId,row.settings),raw=prepareRawWorldBinding(request,o.raw),binding=prepareCanonicalWorldContinuation(request,raw.shotClock,{...o.continuation,sceneKey:o.raw.sceneKey,requestKey:o.raw.requestKey}),result=runCanonicalRawWorldContinuationCPU(binding,prepareRawWorldBatch(raw,[candidate],{maximumSteps:o.raw.maximumSteps}));assert.ok(result.continuation);return result.continuation;};
  for(const row of population)packets.push(Array.from(execute(requestOptions,row).compactResult));
  const pass=population.find((row,i)=>packets[i][1]===1&&packets[i][3]===1);assert.ok(pass,'Real preset must have at least one computed PASS');
  const selected=execute({...requestOptions,purpose:'manual',requestId:2},{candidateId:2,settings:pass.settings});assert.equal(selected.nominalRest,true);assert.equal(selected.compactResult[3],1);
  const pin=JSON.parse(await fs.readFile(new URL('./fixtures/live-world-upload-host-source-pin.json',import.meta.url),'utf8'));
  const output={kind:'public-controller-native-reference-v1',sourceRevision:sha(JSON.stringify(pin.files)),presetSourceSHA256:sha(await fs.readFile(new URL('../src/direct-candidate/canonical-practice-entry.mjs',import.meta.url))),population,packets,passCandidateId:pass.candidateId,passSettings:pass.settings,selectedPacket:Array.from(selected.compactResult),selectedState:Array.from(selected.state.slice(0,256))};
  await fs.writeFile(filename,JSON.stringify(output));console.log(JSON.stringify({referenceFile:filename,sha256:sha(JSON.stringify(output)),packets,passCandidateId:pass.candidateId,selectedPacket:output.selectedPacket,finalTick:output.selectedState[5]}));
 }finally{host.dispose();}
}
if(process.argv[2]==='--prepare')await prepare(process.argv[3]);
else test('public practice entry uses native GPU search then applies and commits one same-model selected shot',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:240000},async t=>{
 const artifactPath=process.env.CANONICAL_CONTROLLER_BUNDLE,manifestPath=process.env.CANONICAL_CONTROLLER_MANIFEST,referencePath=process.env.CANONICAL_CONTROLLER_REFERENCE,referenceSHA=process.env.CANONICAL_CONTROLLER_REFERENCE_SHA256;
 assert.ok(artifactPath&&manifestPath&&referencePath&&referenceSHA,'Exact final public assets and precomputed reference required');
 const [artifact,manifestText,refBytes]=await Promise.all([fs.readFile(artifactPath),fs.readFile(manifestPath,'utf8'),fs.readFile(referencePath)]),manifest=JSON.parse(manifestText),reference=JSON.parse(refBytes);
 assert.equal(sha(artifact),manifest.sha256);assert.equal(sha(refBytes),referenceSHA);assert.equal(reference.kind,'public-controller-native-reference-v1');assert.equal(reference.population.length,9);
 assert.equal(sha(await fs.readFile(new URL('../src/direct-candidate/canonical-practice-entry.mjs',import.meta.url))),reference.presetSourceSHA256);
 for(const [name,hash]of Object.entries(manifest.sources))assert.equal(sha(await fs.readFile(new URL('../'+name,import.meta.url))),hash,name);
 const pin=JSON.parse(await fs.readFile(new URL('./fixtures/live-world-upload-host-source-pin.json',import.meta.url),'utf8'));assert.equal(reference.sourceRevision,sha(JSON.stringify(pin.files)));
 for(const[name,bytes]of Object.entries(pin.files))assert.equal(await fs.readFile(new URL('../'+name,import.meta.url),'utf8'),bytes,name);
 const api=await import('data:text/javascript;base64,'+artifact.toString('base64')),{createNativeControllerHost}=await import('./fixtures/canonical-controller-native-host.mjs'),host=createNativeControllerHost(),c=host;
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']);
 let pipelines=0,modules=0,submissions=0;const devices=[],gpuErrors=[],oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldSecure=Object.getOwnPropertyDescriptor(globalThis,'isSecureContext');
 const wrappedGPU={async requestAdapter(){const adapter=await gpu.requestAdapter();return new Proxy(adapter,{get(target,key){if(key==='requestDevice')return async options=>{const device=await target.requestDevice(options);devices.push(device);device.addEventListener('uncapturederror',e=>gpuErrors.push(e.error.message));const queue=new Proxy(device.queue,{get(q,k){if(k==='submit')return commands=>{submissions++;return q.submit(commands);};const value=Reflect.get(q,k,q);return typeof value==='function'?value.bind(q):value;}});return new Proxy(device,{get(d,k){if(k==='queue')return queue;if(k==='createComputePipelineAsync')return options=>{pipelines++;return d.createComputePipelineAsync(options);};if(k==='createShaderModule')return options=>{modules++;return d.createShaderModule(options);};const value=Reflect.get(d,k,d);return typeof value==='function'?value.bind(d):value;}});};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:wrappedGPU}});Object.defineProperty(globalThis,'isSecureContext',{configurable:true,value:true});
 const originalDynamics={};for(const method of['step','strike','restore']){originalDynamics[method]=PhysicsLab.prototype[method];PhysicsLab.prototype[method]=()=>{throw Error('Forbidden legacy physics '+method);};}
 const progress=[];const unsubscribe=c.subscribe(()=>{const tested=c.state.routeProgress?.tested;if(tested&&progress.at(-1)?.tested!==tested){progress.push({tested,pipelines,modules,submissions});console.log('PUBLIC_NATIVE_PROGRESS',JSON.stringify(progress.at(-1)));}}),started=performance.now();
 try{
  await api.startCanonicalPractice(c);assert.equal(c.canonicalPlayback.implementation,'webgpu-selected-controller');assert.equal(c.state.canonicalPlayback.selectedWorldProfile,'mmq1-ball-ball');assert.equal(c.state.predict,false);
  console.log('PUBLIC_NATIVE_START',JSON.stringify({artifactSHA256:manifest.sha256,sourceRevision:reference.sourceRevision,referenceSHA256:referenceSHA}));
  assert.equal(await c.startSearch(),true,c.state.routeError);assert.equal(c.state.routeStatus,'done');assert.equal(c.state.routeResult.tested,9);
  assert.deepEqual(progress.map(x=>x.tested),[3,6,9]);assert.equal(progress[1].pipelines,progress[0].pipelines);assert.equal(progress[2].pipelines,progress[0].pipelines);assert.equal(submissions,3);
  const expectedPass=reference.population.filter((row,i)=>reference.packets[i][1]===1).map(x=>x.candidateId);assert.deepEqual(c.state.routeResult.results.map(x=>x.id),expectedPass);
  for(const row of c.state.routeResult.results)assert.deepEqual(row.compact,reference.packets[row.id-1]);
  const chosen=c.state.routeResult.results[0];assert.equal(chosen.id,reference.passCandidateId);assert.deepEqual(chosen.settings,reference.passSettings);
  assert.equal(c.applyRoute(chosen.id),true);assert.deepEqual(c.state.settings,reference.passSettings);
  assert.equal(await c.fire(),true,c.state.forecastStatus);assert.equal(c.state.canonicalPlayback.phase,'playing');c.advanceSeconds(20);
  assert.equal(c.state.canonicalPlayback.phase,'rest');assert.equal(c.state.canonicalPlayback.scoreAndTurnCommitted,true);
  const actual=c.canonicalPlayback.readCommittedState();assert.ok(actual instanceof Uint32Array);assert.deepEqual(Array.from(actual),reference.selectedState);actual[0]=0;assert.deepEqual(Array.from(c.canonicalPlayback.readCommittedState()),reference.selectedState);
  assert.equal(c.game.scores[50],1);assert.equal(c.game.activeCue,50);assert.equal(c.state.selectedId,50);assert.equal(c.game.pending,null);assert.equal(c.lab.shots,1);assert.deepEqual(gpuErrors,[]);
  const state=c.canonicalPlayback.readCommittedState();assert.equal(c.undo(),true);assert.equal(c.canonicalPlayback.readCommittedState(),null);assert.equal(c.game.scores[50],0);assert.equal(await c.redo(),true);assert.deepEqual(c.canonicalPlayback.readCommittedState(),state);assert.equal(c.game.scores[50],1);
  t.diagnostic(JSON.stringify({artifactSHA256:manifest.sha256,sourceRevision:reference.sourceRevision,publicEntry:true,actualController:true,nativeGPU:true,searchCandidates:9,searchProgress:progress,passCandidateId:chosen.id,selectedSettings:chosen.settings,selectedPhysicalRest:true,selectedFinalWordsExact:256,score:1,activeCue:50,undoRedoExact:true,totalSubmissions:submissions,pipelines,modules,elapsedMs:performance.now()-started,browserVerified:false,physicalHardwareVerified:false}));
 }finally{unsubscribe();host.dispose();for(const device of devices)device.destroy();gpu.destroy?.();for(const[k,v]of Object.entries(originalDynamics))PhysicsLab.prototype[k]=v;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;if(oldSecure)Object.defineProperty(globalThis,'isSecureContext',oldSecure);else delete globalThis.isSecureContext;}
});
