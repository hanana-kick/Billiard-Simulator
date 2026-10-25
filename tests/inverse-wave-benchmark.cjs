'use strict';
// Opt-in measurement only. Never run concurrently with another numerical owner.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url'),{execFileSync}=require('node:child_process');
const {repetitions,compare}=require('./inverse-wave-benchmark-support.cjs');
const root=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 assert.equal(process.env.REQUIRE_WEBGPU,'1','Exclusive numerical slot and explicit REQUIRE_WEBGPU=1 required');
 const warm=repetitions(process.env.BENCH_WARM_REPETITIONS),report={schema:'original-inverse-wave-performance-v1',warmRepetitions:warm,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),gitStatus:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),stages:{},runs:[],semantics:{cpu:'Original Rapier LabInverseEvents, not cpu-reference arithmetic interpreter',gpu:'Each evaluator call includes owned world construction, lazy pipelines, scoring and cleanup; no artificial decomposition',warm:'Device/process warm only; fresh prepared candidates and owners every repetition. First single is cold, subsequent calls share the device; no pipeline-warm guarantee.',validation:'Outside evaluator timing; original accepted key/exact-clock/1e-6 result gates unchanged',counters:'Logical API counts and host-observed waits, not GPU timestamps or physical VRAM'}};
 async function timed(fn){const start=performance.now(),cpu=process.cpuUsage();const value=await fn();const elapsedMs=performance.now()-start,usage=process.cpuUsage(cpu);return {value,measurement:{elapsedMs,processCpuUserMs:usage.user/1000,processCpuSystemMs:usage.system/1000,memory:process.memoryUsage()}};}
 const files=execFileSync('git',['ls-files','src','vendor/rapier.cjs','tools/rapier-snapshot-decoder'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean).concat(['tests/inverse-wave-benchmark.cjs','tests/inverse-wave-benchmark-support.cjs','tests/webgpu-observation.cjs']);
 report.sources=Object.fromEntries(files.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));report.runtimeAndHarnessSha256=hash(JSON.stringify(report.sources));
 let c,device,gpu,adapter,observer,uncaptured=null;
 try{
  let R,decoder,prepare,evaluate;
  report.stages.engineDecoderSetup=(await timed(async()=>{
   R=require('../vendor/rapier.cjs');globalThis.RAPIER=R;for(const n of ['math','render-cadence','physics','game-rules','route-rules','controller','optimizer-core','inverse-events'])require('../src/'+n);await R.init();
   ({prepareLiveFourBallCandidate:prepare}=await import('../src/browser-initial-import/prepare-live-candidate.mjs'));({evaluateInverseGpuWave:evaluate}=await import('../src/evaluate-inverse-gpu-wave.mjs'));
   const {createSnapshotDecoder}=await import('../tools/rapier-snapshot-decoder/browser.mjs');const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.resolve(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
   decoder=await createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});report.decoderSha256=provenance.wasmSha256;report.engineSha256=hash(fs.readFileSync(path.join(root,'vendor/rapier.cjs')));
  })).measurement;
  report.stages.originalSourceSetup=(await timed(()=>{
   c=new LabController();c.lab=new PhysicsLab(R);c.state.gameMode='four';c.setupGame();for(const [id,x,z]of [[1,.6,0],[2,.95,0],[3,-.4,.4],[4,-.6,-.3]])assert.equal(c.move(id,{x,y:c.lab.get(id).radius+.00005,z}),true);
   for(let i=0;i<2500&&!c.lab.objects.every(o=>o.body.isSleeping());i++)c.lab.step();assert.ok(c.lab.objects.every(o=>o.body.isSleeping()));
  })).measurement;
  const snapshot=c.lab.snapshot({trails:false}),sourceBytes=c.lab.world.takeSnapshot();report.sourceSha256=hash(sourceBytes);
  report.stages.deviceSetup=(await timed(async()=>{
   process.env.VK_ICD_FILENAMES??='/usr/lib/chromium/vk_swiftshader_icd.json';const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE??'/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js').href);Object.assign(globalThis,globals);gpu=create(['backend=vulkan']);adapter=await gpu.requestAdapter();assert.ok(adapter);device=await adapter.requestDevice();device.addEventListener?.('uncapturederror',e=>{uncaptured??=String(e.error?.message??e.error);});
  })).measurement;
  report.adapter=Object.fromEntries(['vendor','architecture','device','description','isFallbackAdapter'].map(k=>[k,adapter.info?.[k]??null]));report.vkIcd=process.env.VK_ICD_FILENAMES;observer=require('./webgpu-observation.cjs').observeWebGpu(device);
  for(let repeat=0;repeat<=warm;repeat++){
   const row={repeat,label:repeat?'device-warm':'cold-sequence',preparation:[],originalCpu:[],singleGpu:[],validation:{},batchGpu:null},jobs=[],expected=[];
   for(const speed of [1.25,2]){
    const settings={angle:0,elevation:8,speed,tipX:0,tipY:0},topology={id:'opponent-'+speed,events:[{kind:'object',id:3},{kind:'object',id:4}]},req={snapshot,selectedId:1,settings,options:{gameMode:'four',mode:'carom',opponentId:2,targetId:3,secondId:4,fourBallThreeCushion:false,budget:48,horizon:8,spin:false,objective:'shortest',elevationMode:'search',allowKiss:true}};
    const native=await timed(()=>{const e=LabInverseEvents.begin(R,req,topology,settings,{purpose:'verify'});try{while(!e.done)LabInverseEvents.advance(e,1);return LabInverseEvents.finish(e);}finally{LabInverseEvents.dispose(e);}});expected.push(native.value);row.originalCpu.push({speed,...native.measurement,includes:'begin/advance/finish/dispose'});
    const prep=await timed(()=>prepare({controller:c,candidate:{settings,rules:{fourBallThreeCushion:false}},decoder}));row.preparation.push({speed,...prep.measurement});jobs.push({prepared:prep.value,req,topology,settings,purpose:'verify'});
   }
   report.requestSha256??=hash(JSON.stringify(jobs.map(({req,settings,topology,purpose})=>({req,settings,topology,purpose}))));
   const original=R.World.prototype.step;let forbidden=0;R.World.prototype.step=function(){forbidden++;throw Error('Native physics continuation prohibited during GPU measurement');};const singles=[];let batch;
   try{
    for(let i=0;i<jobs.length;i++){const phase=`r${repeat}-single${i}`;observer.phase(phase);const measured=await timed(()=>evaluate({backend:'webgpu',device,candidates:[jobs[i]],getSourceRevision:()=>c.lab.revision}));singles.push(measured.value);row.singleGpu.push({...measured.measurement,counters:observer.snapshot().phases[phase],resourcesAfter:observer.snapshot().buffers});}
    const phase=`r${repeat}-batch`;observer.phase(phase);const measured=await timed(()=>evaluate({backend:'webgpu',device,candidates:jobs,getSourceRevision:()=>c.lab.revision}));batch=measured.value;row.batchGpu={...measured.measurement,counters:observer.snapshot().phases[phase],resourcesAfter:observer.snapshot().buffers,execution:batch.execution};
   }finally{R.World.prototype.step=original;}
   row.validation=(await timed(()=>{
    assert.equal(forbidden,0);assert.equal(uncaptured,null);assert.deepEqual(c.lab.world.takeSnapshot(),sourceBytes);let maximumAbsoluteError=0;
    expected.forEach((e,i)=>{assert.equal(e.physicalResult.failureReason,'four-ball-opponent-or-off-table');for(const result of [singles[i].results[0],batch.results[i]]){assert.equal(result.status,'evaluated',result.reason);assert.equal(result.worldStatus,'stopped');maximumAbsoluteError=Math.max(maximumAbsoluteError,compare(result.result,e));}assert.equal(singles[i].execution.mode,'single');});
    assert.equal(batch.execution.mode,'batch');assert.ok(batch.execution.multiOwnerDispatches>0);assert.equal(batch.execution.maxDispatchOwners,2);
    for(const measured of [...row.singleGpu,row.batchGpu]){assert.equal(measured.resourcesAfter.liveCount,0,'Evaluator cleanup releases all observed buffers');assert.equal(measured.resourcesAfter.liveRequestedBytes,0);}
    return {maximumAbsoluteError,nativeContinuationCalls:forbidden,jobs:batch.results.map((r,i)=>({index:r.index,committedSteps:r.committedSteps,originalOuterSteps:expected[i].steps,status:r.status,worldStatus:r.worldStatus}))};
   }));row.validation={...row.validation.measurement,...row.validation.value};report.runs.push(row);console.log(JSON.stringify({schema:report.schema,run:row}));
  }
  for(const [file,digest]of Object.entries(report.sources))assert.equal(hash(fs.readFileSync(path.join(root,file))),digest,'Measured source changed: '+file);
  report.status='validated';
 }finally{
  const start=performance.now();observer?.restore();device?.destroy();device=null;adapter=null;gpu=null;if(c){clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab?.dispose();}report.stages.finalDeviceAndSourceCleanup={elapsedMs:performance.now()-start};
 }
 const output=path.resolve(process.env.BENCH_OUTPUT??path.join(root,'artifacts/inverse-wave-performance.json'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,output,runs:report.runs.length}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
