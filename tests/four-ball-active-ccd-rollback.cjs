'use strict';
// Throw only after an actual completed source-sized CCD slice. Expected source
// boundaries are assertions, never candidate inputs or restored checkpoints.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8');
const F=require('./four-ball-active-ccd-fixture.cjs'),C=require('./four-ball-created-fixture.cjs'),Seed=require('./four-ball-world-seed.cjs'),Observer=require('./four-ball-world-observer.cjs'),Post=require('./four-ball-active-ccd-native-postapp.cjs'),Compare=require('./four-ball-active-ccd-native-compare.cjs');
function assertPublicUnchanged(actual,before){
 assert.deepEqual(actual,before,'Entire public world remains at h388 after completed-slice failure');
 assert.deepEqual(actual.ownedBvh,before.ownedBvh,'Owned committed BVH is unchanged');
 assert.deepEqual(actual.contactGraph,before.contactGraph,'Graph/registry/queue publication is unchanged');
 assert.deepEqual(actual.game,before.game,'Scores, pending game adjudication and active cue are unchanged');
 assert.deepEqual(actual.contactEvents,before.contactEvents,'No partial-slice events are published');
 for(const key of ['frame','time','outerStep','outerSubstep','subdivisions','sourceApplicationSteps','scoreResult','shotComplete'])assert.deepEqual(actual[key],before[key],'Clock/score boundary '+key);
}
async function run(){
 const input=process.env.FOUR_BALL_ACTIVE_CCD_REPLAY||process.env.FOUR_BALL_ACTIVE_CCD_V8,postapp=process.env.FOUR_ACTIVE_POSTAPP,sourceFile=process.env.FOUR_BALL_ACTIVE_CCD_SOURCE;
 assert.ok(input&&postapp&&sourceFile,'Explicit frozen original trajectory, postApplication and source CCD trace required');
 const original=F.load(input),sourceBytes=fs.readFileSync(sourceFile),sourceManifest=JSON.parse(fs.readFileSync(sourceFile+'.json'));assert.equal(C.hash(sourceBytes),sourceManifest.sha256);const source=JSON.parse(sourceBytes);assert.equal(source.inputSha256,original.manifest.sha256);
 const source389=source.rows.find(r=>r.h===389);assert.ok(source389);assert.equal(source389.observed.passes,1,'This original four-ball witness completes one actual CCD solve, not the three-ball two-pass fixture');assert.ok(source389.clamps.some(c=>c.changedNextPose&&c.fraction>0&&c.fraction<1));
 const expected=new Map(Post.load(postapp,input).rows.map(r=>[r.h,r]));assert.ok(expected.has(388)&&expected.has(389));
 const early=process.env.FOUR_ACTIVE_EARLY_CACHE?new Map(require('./four-ball-cue-empty-native-capture.cjs').load(process.env.FOUR_ACTIVE_EARLY_CACHE,input).rows.map(r=>[r.h,r])):new Map(),earlyComparisons=[];
 const seed=Seed.exportInitialSeed(original.initial),observer=Observer.instrument();let device,owner;
 if(process.env.FOUR_ACTIVE_BACKEND==='webgpu'){const {create,globals}=await import(require('node:url').pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);device=await adapter.requestDevice();owner={gpu,adapter,device};}
 const world=device?await observer.World.createGpuStepper(device,seed):await observer.World.createReferenceStepper(seed);let passes=0;
 try{
  for(let h=1;h<=388;h++){const before=world.snapshot();observer.begin();const out=await world.step();observer.verify(out,before);assert.equal(out.frame,h);passes+=out.lastStep.ccd?.sourceInternalPasses.length??1;const frame=original.frames[h-1];assert.equal(out.cue.present,frame.cuePresent);assert.deepEqual(out.game,frame.game);if(early.has(h))earlyComparisons.push(require('./four-ball-cue-empty-native-compare.cjs').compare(out,early.get(h)));}
  const before=world.snapshot();assert.equal(before.frame,388);assert.equal(before.cue.present,false);const beforeComparison=Compare.compare(before,seed,expected.get(388),passes),privateBefore=observer.snapshotStages();assert.ok(privateBefore.length>0);
  observer.armPassFailure(source389.observed.passes);
  for(let attempt=1;attempt<=2;attempt++){
   observer.begin();await assert.rejects(()=>world.step(),/^Error: Injected completed CCD pass failure 1$/);assert.equal(observer.passFailureHits(),attempt,'Failure hook was reached after actual numerical integration, not before the solve');
   assertPublicUnchanged(world.snapshot(),before);observer.assertUnchanged(privateBefore);
  }
  observer.clearPassFailure();observer.begin();const after=await world.step(),observed=observer.verify(after,before),slices=after.lastStep.ccd.sourceInternalPasses;
  assert.equal(after.frame,389);assert.equal(slices.length,1);assert.equal(observed.passes.length,1);assert.equal(slices[0].solveDt,Math.fround(1/960));assert.equal(observed.passes[0].dt,slices[0].solveDt);assert.ok(observed.passes[0].counts.some(n=>n===1),'At least one real ball integration completed in the failed/retried slice');
  assert.ok(slices[0].postChecks.some(r=>r.clampedPose&&r.fraction===0.8679085969924927),'Retry recomputes the original positive clamp');assert.equal(observer.passFailureHits(),2);
  const afterComparison=Compare.compare(after,seed,expected.get(389),passes+slices.length);
  for(const [file,hash]of Observer.sourceHashes)assert.equal(C.hash(fs.readFileSync(file)),hash,'Observer never changes production source files');
  const result={schema:'four-ball-active-ccd-completed-slice-rollback-v1',backend:device?'actual-software-webgpu':'cpu-reference',initialSnapshotSha256:seed.initialSnapshotSha256,originalSha256:original.manifest.sha256,failedH:389,completedSlicesBeforeFailure:1,repeatedAborts:2,allPublicPrivateBvhScoreEventClockStateUnchanged:true,retryPositiveClamp:true,beforeComparison,afterComparison,sourceHashes:Observer.sourceHashes,instrumentedSourceSha256:Observer.instrumentedSourceSha256,instrumentedSharedSourceSha256:Observer.instrumentedSharedSourceSha256,earlyComparisons,manualInput:false,generalParity:false};
  const output=process.env.FOUR_ACTIVE_ROLLBACK_OUTPUT;if(output){assert.ok(!fs.existsSync(output)&&!fs.existsSync(output+'.v8'));fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});fs.writeFileSync(output+'.v8',v8.serialize({result,before,after}),{flag:'wx'});}return result;
 }finally{world.dispose();device?.destroy();owner=null;}
}
module.exports={run};test('four-ball h389 completed active CCD slice aborts twice atomically and retries against original postApplication',{timeout:600000},async()=>{const result=await run();assert.equal(result.completedSlicesBeforeFailure,1);});
