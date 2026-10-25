'use strict';
const{test,before}=require('node:test'),assert=require('node:assert/strict'),F=require('./cue-initialization-fixture.cjs'),Cue=require('../src/experimental-cue-created-stroke-stage');
let record,initial,roster;
const body=b=>{const m=b.mprops,i=m.effective_world_inv_inertia;return{translation:b.pos.position.translation,rotation:b.pos.position.rotation,linear:b.vels.linvel,angular:b.vels.angvel,invMass:m.effective_inv_mass,invInertia:[i.m11,i.m12,i.m13,i.m12,i.m22,i.m23,i.m13,i.m23,i.m33],radius:.03075,dt:Math.fround(1/61440),substeps:12,pgsIterations:4,stabilizationIterations:1};};
before(async()=>{await F.R.init();record=F.captureOriginalCreation({layout:'original-three-ball',selectedIndex:0,settings:{angle:0,elevation:8,tipX:0,tipY:0,speed:2}});initial={...structuredClone(record.cueInitialization),sourceCreation:{created:record.created,roles:record.roles,events:record.events},initializationInputs:F.initializationInputs(record)};roster={selected:body(record.created.bodies.ball),others:[body(record.created.bodies.otherBall1),body(record.created.bodies.otherBall2)]};});
function close(a,b,path,tol=3e-6){assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<=tol,path+'['+i+'] '+a[i]+' vs '+b[i]);}
function compare(state){assert.equal(state.elapsed,1/61440);assert.equal(state.frame,1);assert.equal(state.outerSubstep,1);assert.equal(state.time,record.post.time);for(const role of['shaft','head']){const a=state.cue[role],b=record.post.bodies[role],m=b.mprops.effective_world_inv_inertia;close(a.translation,b.pos.position.translation,role+'.position');close(a.rotation,b.pos.position.rotation,role+'.rotation');close(a.linear,b.vels.linvel,role+'.linear');close(a.angular,b.vels.angvel,role+'.angular');close(a.invInertia,['m11','m12','m13','m22','m23','m33'].map(k=>m[k]),role+'.inertia');}const native=record.post.jointState.joint_graph.graph.edges.map(e=>e.weight);for(let i=0;i<2;i++){close(state.cue.joints[i].impulses,native[i].impulses,'joint'+i+'.impulses',2e-6);close(state.cue.joints[i].limitImpulses,native[i].data.limits.map(x=>x.impulse),'joint'+i+'.limits',2e-6);}}
async function run(stage){try{const before=stage.snapshot(),prepared=await stage.prepare(structuredClone(roster));assert.deepEqual(stage.snapshot(),before,'prepare remains private');assert.equal(prepared.metadata.initialization.phase,'source-user-changes-and-connectivity-complete-pre-collision');assert.equal(prepared.metadata.initialization.jointEventJournal.length,13);close(prepared.linear,roster.selected.linear,'pre-law ball linear');close(prepared.angular,roster.selected.angular,'pre-law ball angular');stage.commit();compare(stage.snapshot());}finally{stage.dispose();}}
test('created-state scalar cue advances first source h without a native first-step input',async()=>{await run(Cue.createReferencePreWorldStage(initial));});
test('created-state actual WGSL cue advances first source h',{timeout:30000},async t=>{if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('REQUIRE_WEBGPU=1');const{pathToFileURL}=require('node:url'),{create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();try{await run(await Cue.createGpuPreWorldStage(device,initial));}finally{device.destroy();}});

async function runDeferred(stage){
 const before=stage.snapshot();
 try{
  const prepared=await stage.prepareApplication(structuredClone(roster));
  assert.equal(prepared.metadata.jointSolved,false);
  assert.equal(prepared.metadata.jointResult,null);
  assert.deepEqual(stage.snapshot(),before,'application prefix remains private');
  assert.throws(()=>stage.commit(),/complete prepared/);
  assert.throws(()=>stage.assertPrepared(),/complete prepared/);
  await assert.rejects(stage.prepareApplication(structuredClone(roster)),/pending/);
  const metadata=await stage.solvePrepared();
  assert.equal(metadata.jointSolved,true);
  assert.deepEqual(metadata.preSolveBodies,prepared.metadata.preSolveBodies,'solver consumes the owned prefix unchanged');
  assert.deepEqual(stage.snapshot(),before,'solve remains private until commit');
  await assert.rejects(stage.solvePrepared(),/unsolved/);
  stage.abort();
  assert.deepEqual(stage.snapshot(),before,'abort rolls back prefix and solve together');
  const retry=await stage.prepareApplication(structuredClone(roster));
  assert.deepEqual(retry,prepared);
  const solved=await stage.solvePrepared();
  assert.deepEqual(solved,metadata);
  stage.commit();compare(stage.snapshot());
  await assert.rejects(stage.solvePrepared(),/unsolved/);
 }finally{stage.dispose();}
}
test('source application prefix and constraint solve have one atomic commit',async()=>runDeferred(Cue.createReferencePreWorldStage(initial)));
test('actual WGSL deferred cue solve preserves rollback and original first h',{timeout:30000},async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('REQUIRE_WEBGPU=1');
 const{pathToFileURL}=require('node:url'),{create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();
 try{await runDeferred(await Cue.createGpuPreWorldStage(device,initial));}finally{device.destroy();}
});
