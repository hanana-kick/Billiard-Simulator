'use strict';
// Original-created seed is the ONLY candidate world input. Persisted later
// native frames and BVH operation diagnostics are assertions, never recurrence.
const fs=require('node:fs'),assert=require('node:assert/strict'),{test}=require('node:test');
const F=require('./three-ball-scene-fixture.cjs'),Seed=require('./cue-source-input-hull-seed.cjs'),Original=require('./multi-toi-original-fixture.cjs');
function rollbackWorld(){
 const Module=require('node:module'),filename=require.resolve('../src/experimental-three-ball-ccd-world'),source=fs.readFileSync(filename,'utf8'),needle='passRecords.push({collisionDt,solveDt,remainingTime:remaining,remainingSubsteps:count,firstImpact,preChecks,postChecks});';assert.equal(source.split(needle).length,2);
 let blocked=true,count=0;const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;const req=Module.createRequire(filename);m.require=n=>n==='__owned_bvh_rollback_observer__'?frame=>{if(frame===395&&blocked){count++;throw Error('sentinel after owned corner BVH writes');}}:req(n);m._compile("const __ownedBvhRollbackObserve=require('__owned_bvh_rollback_observer__');\n"+source.replace(needle,needle+'__ownedBvhRollbackObserve(next.frame);'),filename);return{World:m.exports,allow(){blocked=false;},count:()=>count};
}
const originalFile=process.env.MULTI_TOI_ORIGINAL_REPLAY,traceFile=process.env.OWNED_CCD_BVH_NATIVE_TRACE;
test('created-only world owns all BVH recurrence and source shrinking-bound corner clamp',{skip:!originalFile||!traceFile,timeout:1200000},async()=>{
 const native=Original.load(originalFile),trace=JSON.parse(fs.readFileSync(traceFile,'utf8'));await F.R.init();
 const record=F.captureOriginalCreation({layout:'original-three-ball',selectedIndex:0,settings:Original.input.settings}),seed=Seed.exportSeed(record,{settings:Original.input.settings});
 assert.equal(record.created.snapshotSha256,native.boundaries.created.snapshotSha256);assert.equal(record.created.snapshotSha256,trace.initialSnapshotSha256);
 // Persisted fixture frames are pre-application-patch. Independently recreate
 // post-application assertions instead of weakening angular tolerances.
 const lab=new PhysicsLab(F.R),frames=[],done=Symbol('assertion horizon');
 try{assert.equal(lab.strike(Original.input.selectedId,{...Original.input.settings},{saveSnapshot:false}).ok,true);assert.equal(Original.hash(lab.world.takeSnapshot()),record.created.snapshotSha256);const patch=lab.angularPatchResistance.bind(lab);lab.angularPatchResistance=h=>{patch(h);frames.push(Original.state(lab));if(frames.length===Original.input.captureLastWorldStep){assert.equal(Original.hash(lab.world.takeSnapshot()),native.boundaries.afterApplication.snapshotSha256);throw done;}};try{while(frames.length<Original.input.captureLastWorldStep)lab.step();}catch(e){if(e!==done)throw e;}}finally{lab.dispose();}
 const gpuMode=process.env.OWNED_CCD_WORLD_BACKEND==='webgpu';let device,lifetime;
 if(gpuMode){assert.ok(process.env.GPU_NATIVE_MODULE);const {create,globals}=await import(require('node:url').pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);device=await adapter.requestDevice();lifetime={gpu,adapter,device};}
 const rollback=rollbackWorld(),Candidate=rollback.World,world=device?await Candidate.createGpuStepper(device,seed):await Candidate.createReferenceStepper(seed);let max=0,last;
 try{for(const diagnostic of trace.frames){const expected={h:diagnostic.h,...frames[diagnostic.h-1]};if(diagnostic.h===396){const before=world.snapshot();for(let attempt=0;attempt<2;attempt++){await assert.rejects(world.step(),/sentinel after owned corner BVH writes/);assert.deepEqual(world.snapshot(),before,'complete BVH, queues, poses and events must roll back');}assert.equal(rollback.count(),2);rollback.allow();}const out=await world.step();last=out;
   assert.equal(out.frame,expected.h);assert.deepEqual(out.ownedBvh.tree,diagnostic.expectedNativeBroad.tree,'owned tree at h'+expected.h);
   for(const k of ['frame_index','changes_since_optimize','reinsert_leaf_updates','prev_updated_leaves','pending_set_aabb'])assert.deepEqual(out.ownedBvh[k],diagnostic.expectedNativeBroad[k],k+' at h'+expected.h);
   for(let i=0;i<3;i++)for(const k of ['translation','rotation','linear','angular'])for(let j=0;j<expected.objects[i][k].length;j++){const delta=Math.abs(out.balls[i].state[k][j]-expected.objects[i][k][j]);max=Math.max(max,delta);assert.ok(delta<=(['translation','rotation'].includes(k)?1e-6:3e-6),`h${expected.h}/ball${i}/${k}/${j}: ${delta}`);}
   if(process.env.OWNED_CCD_WORLD_PROGRESS==='1'&&(expected.h%32===0||expected.h===396))console.error(JSON.stringify({h:expected.h,backend:gpuMode?'webgpu':'cpu-reference',maxAbsoluteError:max}));
  }
  assert.equal(last.frame,396);const passes=last.lastStep.ccd.sourceInternalPasses;assert.equal(passes.length,1);assert.equal(last.lastStep.ccd.applicationPatchCount,1);
  const pre=passes[0].preChecks.find(x=>x.body.index===16),post=passes[0].postChecks.find(x=>x.body.index===16);assert.equal(pre.fraction,.9360221028327942);assert.equal(post.fraction,.9357571601867676);assert.ok(post.clampedPose);assert.deepEqual(last.balls[0].state.translation,native.frames[395].objects[0].translation);
  console.log(JSON.stringify({scope:'created-only-world-through-real-multi-target-corner-h396',backend:gpuMode?'actual-webgpu':'cpu-reference',frames:last.frame,exactNativeBvhFrames:trace.frames.length,maxAbsoluteError:max,preFraction:pre.fraction,postFraction:post.fraction,wholeWorldParity:false}));
 }finally{world.dispose();device?.destroy();lifetime=null;}
});
