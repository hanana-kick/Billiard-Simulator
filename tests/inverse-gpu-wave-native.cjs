'use strict';
// Genuine same-realm preparation and original CPU inverse outcomes, followed by
// GPU continuation with every native physics step forbidden. No future fixture
// data enters preparation or numerical owners.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const enabled=process.env.REQUIRE_WEBGPU==='1';
test('actual prepared candidate wave matches original CPU inverse outcomes and stops on original opponent foul',{skip:!enabled,timeout:240000},async t=>{
 const R=require('../vendor/rapier.cjs');globalThis.RAPIER=R;for(const n of ['math','render-cadence','physics','game-rules','route-rules','controller','optimizer-core','inverse-events'])require('../src/'+n);await R.init();
 const {prepareLiveFourBallCandidate}=await import('../src/browser-initial-import/prepare-live-candidate.mjs'),{evaluateInverseGpuWave}=await import('../src/evaluate-inverse-gpu-wave.mjs'),{createSnapshotDecoder}=await import('../tools/rapier-snapshot-decoder/browser.mjs');
 const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.resolve(__dirname,'../../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json'))),decoder=await createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.resolve(__dirname,'../vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 const c=new LabController();c.lab=new PhysicsLab(R);c.state.gameMode='four';c.setupGame();let device,release;
 try{
  for(const [id,x,z]of [[1,.6,0],[2,.95,0],[3,-.4,.4],[4,-.6,-.3]])assert.equal(c.move(id,{x,y:c.lab.get(id).radius+.00005,z}),true);
  for(let i=0;i<2500&&!c.lab.objects.every(o=>o.body.isSleeping());i++)c.lab.step();assert.ok(c.lab.objects.every(o=>o.body.isSleeping()));
  const snapshot=c.lab.snapshot({trails:false}),sourceBytes=c.lab.world.takeSnapshot(),jobs=[],expected=[];
  for(const speed of [1.25,2]){
   const settings={angle:0,elevation:8,speed,tipX:0,tipY:0},topology={id:'opponent-'+speed,events:[{kind:'object',id:3},{kind:'object',id:4}]},req={snapshot,selectedId:1,settings,options:{gameMode:'four',mode:'carom',opponentId:2,targetId:3,secondId:4,fourBallThreeCushion:false,budget:48,horizon:8,spin:false,objective:'shortest',elevationMode:'search',allowKiss:true}};
   const e=LabInverseEvents.begin(R,req,topology,settings,{purpose:'verify'});try{while(!e.done)LabInverseEvents.advance(e,1);expected.push(LabInverseEvents.finish(e));}finally{LabInverseEvents.dispose(e);}
   assert.equal(expected.at(-1).physicalResult.failureReason,'four-ball-opponent-or-off-table','actual original opponent collision, not timeout');
   const prepared=await prepareLiveFourBallCandidate({controller:c,candidate:{settings,rules:{fourBallThreeCushion:false}},decoder});jobs.push({prepared,req,topology,settings,purpose:'verify'});
  }
  assert.deepEqual(c.lab.world.takeSnapshot(),sourceBytes);
  const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE??'/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js').href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();device=await adapter.requestDevice();release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,'same-realm inverse GPU wave');
  const original=R.World.prototype.step;let forbidden=0;R.World.prototype.step=function(){forbidden++;throw Error('Native physics continuation prohibited during GPU wave');};let out,single;const started=performance.now();
  try{single=await evaluateInverseGpuWave({backend:'webgpu',device,candidates:jobs.slice(0,1),getSourceRevision:()=>c.lab.revision});out=await evaluateInverseGpuWave({backend:'webgpu',device,candidates:jobs,getSourceRevision:()=>c.lab.revision});}finally{R.World.prototype.step=original;}
  assert.equal(forbidden,0);assert.deepEqual(c.lab.world.takeSnapshot(),sourceBytes);let max=0;
  function compare(a,b,at='result'){if(typeof b==='number'){if(!Number.isFinite(b)){assert.equal(a,b,at);return;}max=Math.max(max,Math.abs(a-b));const exact=/\.(?:time|stepDt|stepIndex|steps|seconds|firstImpactTime|observedSubsteps)$/.test(at);assert.ok(exact?a===b:Math.abs(a-b)<=1e-6,at+': '+a+' != '+b);}else if(b===null||typeof b!=='object')assert.equal(a,b,at);else{assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),at);for(const k of Object.keys(b))compare(a[k],b[k],at+'.'+k);}}
  assert.equal(single.execution.mode,'single');assert.equal(single.results[0].status,'evaluated',single.results[0].reason);compare(single.results[0].result,expected[0]);assert.equal(out.execution.mode,'batch');assert.ok(out.execution.multiOwnerDispatches>0);assert.equal(out.execution.maxDispatchOwners,2);
  out.results.forEach((row,i)=>{assert.equal(row.status,'evaluated',row.reason);assert.equal(row.worldStatus,'stopped');compare(row.result,expected[i]);});
  t.diagnostic(JSON.stringify({jobs:out.results.map((r,i)=>({index:r.index,status:r.status,worldStatus:r.worldStatus,committedSteps:r.committedSteps,originalOuterSteps:expected[i].steps,physicalFailure:r.result.physicalResult.failureReason})),maximumAbsoluteError:max,nativeContinuationCalls:forbidden,execution:out.execution,elapsedMs:performance.now()-started,memory:process.memoryUsage()}));
 }finally{release?.();if(!release)device?.destroy();clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
});
