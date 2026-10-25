'use strict';
// Initial-only world replay against unchanged, independently recreated Rapier.
// Expected future states are assertions only and never enter the candidate.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),v8=require('node:v8'),crypto=require('node:crypto');
const F=require('./three-ball-scene-fixture.cjs'),Seed=require('./cue-source-input-hull-seed.cjs'),World=require('../src/experimental-three-ball-ccd-world');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
async function run(fixtureModule,originalFile,outFile){
 assert.equal(path.basename(fixtureModule),'yaw-positive-ccd-original-fixture.cjs','Explicit constructor-only positive-clamp fixture required');
 const Original=require(path.resolve(fixtureModule)),baseline=Original.load(originalFile),spec=Original.input;
 assert.deepEqual(spec.placements,[],'This gate does not disguise a placed origin as a constructor layout');
 assert.ok(path.isAbsolute(outFile)&&!fs.existsSync(outFile)&&!fs.existsSync(outFile+'.v8'));
 await F.R.init();const record=F.captureOriginalCreation({layout:'original-three-ball',selectedIndex:0,settings:{...spec.settings}});
 assert.equal(record.created.snapshotSha256,baseline.boundaries.created.snapshotSha256);
 const seed=Seed.exportSeed(record,{settings:spec.settings});assert.ok(!('expected'in seed)&&!('post'in seed));
 const horizon=spec.captureLastWorldStep,lab=new PhysicsLab(F.R),frames=[],boundaries=new Map(),done=Symbol('horizon');
 try{assert.equal(lab.strike(spec.selectedId,{...spec.settings},{saveSnapshot:false}).ok,true);assert.equal(hash(lab.world.takeSnapshot()),record.created.snapshotSha256);
  const patch=lab.angularPatchResistance.bind(lab),vec=v=>[v.x,v.y,v.z],quat=q=>[q.x,q.y,q.z,q.w];
  lab.angularPatchResistance=h=>{patch(h);const n=frames.length+1;frames.push({h:n,objects:lab.objects.map(o=>({translation:vec(o.body.translation()),rotation:quat(o.body.rotation()),linear:vec(o.body.linvel()),angular:vec(o.body.angvel())}))});
   if(n>=spec.captureFirstWorldStep)boundaries.set(n,{snapshot:lab.world.takeSnapshot(),application:Original.state(lab)});
   if(n===horizon){assert.equal(hash(lab.world.takeSnapshot()),baseline.boundaries.afterApplication.snapshotSha256);throw done;}};
  try{while(frames.length<horizon)lab.step();}catch(e){if(e!==done)throw e;}
 }finally{lab.dispose();}
 const sourceFiles=fs.readdirSync(path.resolve(__dirname,'../src')).filter(n=>n.startsWith('experimental-')&&n.endsWith('.js')).map(n=>'src/'+n).concat(['src/physics.js','src/math.js']);
 const sources=Object.fromEntries(sourceFiles.map(p=>[p,hash(fs.readFileSync(path.resolve(__dirname,'..',p)))]));
 const gpuMode=process.env.POSITIVE_CCD_BACKEND==='webgpu';let device,gpuOwner;
 if(gpuMode){const {create,globals}=await import(require('node:url').pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);device=await adapter.requestDevice();gpuOwner={gpu,adapter,device};globalThis.__positiveClampGpuLifetime=gpuOwner;}
 const world=device?await World.createGpuStepper(device,seed):await World.createReferenceStepper(seed);let max=0,collisionPasses=0,lastGood=world.snapshot();const clamps=[],comparisons=[];
 try{for(const expected of frames){const out=await world.step();for(let i=0;i<3;i++)for(const k of ['translation','rotation','linear','angular'])for(let j=0;j<expected.objects[i][k].length;j++){
   const e=Math.abs(out.balls[i].state[k][j]-expected.objects[i][k][j]);max=Math.max(max,e);assert.ok(e<=(['translation','rotation'].includes(k)?1e-6:3e-6),`h${expected.h}/ball${i}/${k}/${j}: ${e}`);}
   const passes=out.lastStep?.ccd?.sourceInternalPasses;collisionPasses+=passes?.length??1;
   for(const [passIndex,pass] of (passes??[]).entries())for(const row of pass.postChecks??[])if(row.clampedPose)clamps.push({h:expected.h,passIndex,body:row.body,solveDt:pass.solveDt,...row});
   if(boundaries.has(expected.h))comparisons.push({h:expected.h,boundary:require('./active-ccd-compare-boundary.cjs').compare(out,record,boundaries.get(expected.h)),graph:require('./active-ccd-compare-graph.cjs').compare(out,record,boundaries.get(expected.h),collisionPasses)});
   lastGood=out;
  }
  assert.ok(clamps.length>0,'A genuine positive post-solve clamp must occur in the candidate, not only a pre-TOI split');
  for(const[p,h]of Object.entries(sources))assert.equal(hash(fs.readFileSync(path.resolve(__dirname,'..',p))),h,'Frozen candidate source');
  const result={status:'positive-clamp-original-created-world-verified',backend:gpuMode?'actual-native-software-webgpu':'cpu-reference',horizon,maxAbsoluteError:max,initialSnapshotSha256:record.created.snapshotSha256,originalArtifactSha256:baseline.manifest.sha256,sources,clamps,comparisons,fullShot:false,generalParity:false};
  fs.writeFileSync(outFile,JSON.stringify(result,null,2)+'\n',{flag:'wx'});fs.writeFileSync(outFile+'.v8',v8.serialize({result,lastGood,createdRecord:record}),{flag:'wx'});return result;
 }finally{world.dispose();device?.destroy();delete globalThis.__positiveClampGpuLifetime;}
}
module.exports={run};if(require.main===module)run(...process.argv.slice(2)).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.stack);process.exitCode=1;});
