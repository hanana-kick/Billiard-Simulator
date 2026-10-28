import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {CANONICAL_DEFAULT_PARAMETERS,encodeCanonicalScene,createCanonicalRequest,createCanonicalCandidate} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {prepareRawWorldBinding,prepareRawWorldBatch} from '../src/direct-candidate/deterministic-raw-world.mjs';
import {preparedWorldWords} from '../src/direct-candidate/deterministic-prepared-world-gpu.mjs';
import {prepareCanonicalWorldContinuation,runCanonicalRawWorldContinuationCPU,createCanonicalWorldContinuationGPU} from '../src/direct-candidate/canonical-world-continuation.mjs';
const require=createRequire(import.meta.url),RAPIER=require('../vendor/rapier.cjs');await RAPIER.init();require('../src/math.js');require('../src/physics.js');
const lab=new PhysicsLab(RAPIER),snapshot=lab.snapshot();lab.dispose();
const R=.03075,v=(x=0,y=0,z=0)=>({x,y,z});
snapshot.params={...CANONICAL_DEFAULT_PARAMETERS};
snapshot.objects=[{id:50,p:[0,R,0]},{id:8,p:[.7,R,.3]},{id:300,p:[-.6,R,.45]},{id:19,p:[.9,R,-.4]}].map(x=>({id:x.id,shape:'sphere',kind:'ball',radius:R,mass:.21,pos:v(...x.p),v:v(),w:v(),rot:{x:0,y:0,z:0,w:1}}));
const admission=encodeCanonicalScene(snapshot,{objectIds:snapshot.objects.map(x=>x.id),staticCount:snapshot.statics.length});assert.equal(admission.admitted,true);
const request=createCanonicalRequest({scene:admission.scene,epoch:7,requestId:17,selectedId:50,purpose:'search',executionProfile:'canonical-local-v1',budget:{maximumTicks:2**23,maximumEvents:1024,maximumWorkItems:1000000},rules:{game:4,firstId:8,secondId:300,opponentId:19,threeCushion:false,search:true,method:'carom',minCushions:0,allowKiss:false,kissFacts:false,conditionOnly:false}});
const rawBinding=prepareRawWorldBinding(request,{absoluteTick:1234,sceneKey:11,requestKey:23});
const binding=prepareCanonicalWorldContinuation(request,rawBinding.shotClock,{sceneKey:11,requestKey:23,durationTicks:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:64});
function batch({maximumSteps=2048,speed=.5}={}){return prepareRawWorldBatch(rawBinding,[createCanonicalCandidate(request,100,{angle:35,elevation:25,speed,tipX:.2,tipY:0})],{maximumSteps});}
function outputWords(result){const c=result.continuation;return Uint32Array.from([...result.rawHandoffStatus,...(c?[...c.words,...c.journalWords,...(c.journalAuxWords??[]),...c.ruleState,...c.compactResult]:[])]);}
function cpuWords(result){const c=result.continuation;return Uint32Array.from([...result.rawHandoffStatus,...(c?[...preparedWorldWords(c),...c.journalWords,...(c.journalAuxWords??[]),...c.ruleState,...c.compactResult]:[])]);}

test('full-backend fixture is a genuine owned raw shot and preserves fail/cancel semantics',()=>{
 const normal=batch(),cpu=runCanonicalRawWorldContinuationCPU(binding,normal);assert.equal(cpu.rawHandoffStatus[1],1);assert.equal(cpu.continuation.nominalRest,true);assert.equal(cpu.continuation.compactResult[3],0,'this is a real complete miss, not a goal');assert.ok(cpu.continuation.journalWords[20]);assert.equal(cpu.continuation.ruleTimeOrigin,1234);assert.equal(cpu.continuation.kissCoverage,true);
 for(const maximumSteps of[7,8,9,15,16,17]){const result=runCanonicalRawWorldContinuationCPU(binding,batch({maximumSteps}));assert.equal(result.rawHandoffStatus[1],5);assert.equal(result.continuation,null);}
 assert.equal(runCanonicalRawWorldContinuationCPU(binding,batch({speed:10})).continuation,null);
 const controller=new AbortController();controller.abort();assert.throws(()=>runCanonicalRawWorldContinuationCPU(binding,normal,{signal:controller.signal}),{name:'AbortError'});
});

test('invalid full-wrapper backend rejects before device compilation',async()=>{for(const strikeBackend of [null,'auto','chunked-8',16])await assert.rejects(createCanonicalWorldContinuationGPU({},binding,{strikeBackend}),/backend/);});

test('owned staged and K16 raw banks feed the same resident world journal and rules',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:300000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']);
 const inputs=[batch(),batch({speed:10}),...[7,8,9,15,16,17].map(maximumSteps=>batch({maximumSteps}))];
 const expected=inputs.map(input=>runCanonicalRawWorldContinuationCPU(binding,input)),baseline=[];let compared=0;const metrics=[];
 for(const strikeBackend of['staged','chunked-16']){
  const adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();
  try{
   const engine=await createCanonicalWorldContinuationGPU(device,binding,{strikeBackend});assert.equal(engine.strikeBackend,strikeBackend,'requested execution backend is not silently ignored');
   const aborted=new AbortController();aborted.abort();await assert.rejects(engine.runRaw(inputs[0],{signal:aborted.signal}),{name:'AbortError'});
   for(let i=0;i<inputs.length;i++){
    const result=await engine.runRaw(inputs[i]),words=outputWords(result);assert.deepEqual(words,cpuWords(expected[i]),`${strikeBackend} case${i} CPU words`);compared+=words.length;
    if(strikeBackend==='staged')baseline.push(words);else assert.deepEqual(words,baseline[i],`K16 case${i} original staged words`);
    if(i===0){assert.equal(result.continuation.nominalRest,true);assert.deepEqual(result.continuation.gameplayVerdict,expected[i].continuation.gameplayVerdict);assert.equal(result.continuation.elapsedTicks,expected[i].continuation.elapsedTicks);assert.equal(result.continuation.remainingTicks,expected[i].continuation.remainingTicks);assert.equal(result.continuation.ruleTimeOrigin,1234);assert.equal(result.continuation.metrics.intermediateReadbacks,0);assert.equal(result.continuation.metrics.hostPhysicsBetweenPhases,0);metrics.push({strikeBackend,compileMs:engine.compileMs,worldMetrics:result.continuation.metrics});}
    else assert.equal(result.continuation,null,'failed/incomplete raw bank cannot become a world/gameplay result');
   }
   // Cancellation after command submission suppresses the result; it does not
   // claim to cancel already submitted hardware work. The owning bank is cleaned
   // up by the wrapper's finally path, and a following run must still work.
   const cancelled=new AbortController(),originalSubmit=device.queue.submit;let submissions=0;
   device.queue.submit=function(commands){submissions++;originalSubmit.call(this,commands);cancelled.abort();};
   try{await assert.rejects(engine.runRaw(inputs[0],{signal:cancelled.signal}),{name:'AbortError'});assert.equal(submissions,1);}finally{device.queue.submit=originalSubmit;}
   const recovered=await engine.runRaw(inputs[0]);assert.deepEqual(outputWords(recovered),cpuWords(expected[0]));compared+=outputWords(recovered).length;
  }finally{device.destroy();}
 }
 t.diagnostic(JSON.stringify({fullOwnedRawWorldJournalRules:true,comparedCandidateExecutions:18,cancelledAfterSubmitExecutions:2,comparedWords:compared,exactCPUAndOriginalStagedGPU:true,beforeSubmitAndAfterSubmitCancellationChecked:true,defaultBackendUnchanged:'staged',scope:'admitted default-material no-contact whole shot plus raw failures/budgets',metrics,softwareVulkanOnly:true}));
});
