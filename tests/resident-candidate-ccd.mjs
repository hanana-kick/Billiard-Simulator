import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CCD_LAYOUT,CCD_HEADER,CCD_CAPABILITY,createCcdPrograms,generateCcdWGSL,pruneCcdWGSL} from '../src/resident-candidate/ccd.mjs';
import {executeLowered,generateNumericLibraryWGSL} from '../src/resident-candidate/numeric-program.mjs';
import {generateBvhWGSL} from '../src/resident-candidate/bvh.mjs';
const require=createRequire(import.meta.url),M=require('../src/experimental-ccd-sweep-math.js'),T=require('../src/experimental-ccd-sweep-toi.js'),S=require('../src/experimental-ccd-substep.js');
const captured=require('./fixtures/active-ccd/original-e35-queries.json');
const pose=s=>({localCenter:s.local_center,c1:s.c1,c2:s.c2,q1:s.q1,q2:s.q2});
const queries=captured.map(q=>({pointsA:q.proxy_a.points,radiusA:q.proxy_a.radius,radiusB:q.proxy_b.radius,a:pose(q.sweep_a),b:pose(q.sweep_b),maxFraction:q.max_fraction,linearSlop:q.linear_slop}));
const floatsToWords=a=>new Uint32Array(Float32Array.from(a).buffer);
function packSweep(q,n=64){const a=new Float32Array(n);for(const [s,k]of[[q.a,0],[q.b,17]]){a.set(s.localCenter,k);a.set(s.c1,k+3);a.set(s.c2,k+6);a.set(s.q1,k+9);a.set(s.q2,k+13);}a[35]=q.radiusA;a[36]=q.radiusB;a[37]=q.linearSlop;return a;}
function run(programs,name,input){const e=programs.entries[name],out=executeLowered(e.compiled,input,{testOnly:true}),result={};for(const[k,v]of Object.entries(e.plan.layout??{})){const r=Array.from(out.slice(v.offset,v.offset+v.length));result[k]=v.length===1?r[0]:r;}return result;}

test('explicit source input references keep repeated equal-valued inputs distinct',()=>{
 const a=M.sourceInput(0),b=M.sourceInput(1),p=M.buildSourcePlan('difference',{a,b},{inputFloats:2});
 assert.throws(()=>M.buildSourcePlan('difference',{a,b}),/explicit/i);assert.throws(()=>M.sourceInput(-1));
 const G=require('../src/experimental-arithmetic-graph.js');assert.equal(G.execute(Float32Array.of(4,3),p)[0],1);assert.equal(G.execute(Float32Array.of(3,4),p)[0],-1);
});

test('dynamic source sweep templates preserve every tested original arithmetic result',()=>{
 const programs=createCcdPrograms({pointCounts:[...new Set(queries.map(q=>q.pointsA.length))]});
 for(const q of queries)for(const t of [0,Math.fround(.125),Math.fround(.4004574120044708),1]){
  const input=packSweep(q);input[34]=t;
  assert.deepEqual(run(programs,'shift',input),M.reference('shift',{a:q.a,b:q.b}));
  assert.deepEqual(run(programs,'target',input),M.reference('target',{radiusA:q.radiusA,radiusB:q.radiusB,slop:q.linearSlop}));
  assert.deepEqual(run(programs,'relative',input),M.reference('relative',{a:q.a,b:q.b,t}));
  assert.deepEqual(run(programs,'transform',input),M.reference('transform',{sweep:q.b,t}));
  assert.deepEqual(run(programs,'sphereBounds',input),M.reference('sphereBounds',{c1:q.b.c1,c2:q.b.c2,radius:q.radiusB}));
  const points=[...q.pointsA[0],...q.pointsA[1],...q.pointsA[2]];input.set(points,53);
  const face=M.reference('face',{a:q.a,b:q.b,t,points:q.pointsA.slice(0,3)});assert.deepEqual(run(programs,'face',input),face);
  input.set(face.witness1,47);input.set(face.witness2,50);
  for(const name of ['findFace','evaluateFace'])assert.deepEqual(run(programs,name,input),M.reference(name==='findFace'?'find':'evaluate',{a:q.a,b:q.b,t,type:'FaceA',...face}));
  const dynamic=packSweep(q,64+q.pointsA.length*3);dynamic[34]=t;dynamic.set([1,0,0],47);dynamic.set(q.pointsA.flat(),64);
  assert.deepEqual(run(programs,'findVertices'+q.pointsA.length,dynamic),M.reference('find',{a:q.a,b:q.b,t,type:'Vertices',witness1:[1,0,0],witness2:[0,0,0],pointsA:q.pointsA}));
 }
});

test('source four-pass schedule templates retain exact absorption and final-pass semantics',()=>{
 const p=createCcdPrograms();for(const remaining of [Math.fround(1/960),Math.fround(1/61440)])for(let steps=1;steps<=4;steps++)for(const fraction of [null,0,.1,.9]){
  if(steps===1&&fraction!==null)continue;const q={remainingTime:remaining,remainingSubsteps:steps,minCcdDt:Math.fround(1/6000),firstImpact:fraction===null?null:Math.fround(remaining*fraction)};
  const actual=run(p,'schedule',S.pack(q)),expected=S.reference(q);assert.equal(actual.dt,expected.dt);assert.equal(actual.remainingTime,expected.remainingTime);assert.equal(actual.remainingSubsteps,expected.remainingSubsteps);
 }
 assert.equal(CCD_CAPABILITY.hostForwardFallback,false);const code=generateCcdWGSL(p);for(const name of ['begin','pre_pass','post_pass','advance_pass','sweep','body'])assert.match(code,new RegExp('fn rc_ccd_'+name+'\\('));assert.doesNotMatch(code,/@binding|@compute/);assert.equal(CCD_LAYOUT.words*4,5120);assert.equal(p.program[p.proxyIterationLimitOffset],32,'original GJK iteration limit is immutable program metadata, not a reduced budget');
 const pruned=pruneCcdWGSL(code+'\n@compute @workgroup_size(1) fn main(){rc_ccd_begin(0u,0.01,0.0);}');assert.match(pruned,/fn rc_ccd_begin\(/);assert.doesNotMatch(pruned,/fn rc_ccd_pd_proxyDistance\(|fn rc_num_eval\(/);
});

test('native resident sweep owns source root/GJK/cache loops in one dispatch',{timeout:180000},async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('explicit globally serialized GPU slot required');
 const {createNativeOwner,dispatchWordStages}=await import('./resident-candidate-gpu-support.mjs');
 const rows=[...queries,...queries.map(q=>({...q,maxFraction:Math.fround(.25)})),...queries.map(q=>({...q,maxFraction:Math.fround(.5)}))];
 const programs=createCcdPrograms({pointCounts:[...new Set(rows.map(q=>q.pointsA.length))]}),expected=[];for(const q of rows)expected.push(await T.reference(q));
 const state=Array(rows.length*CCD_LAYOUT.words).fill(0),metadata=[];
 for(let i=0;i<rows.length;i++){const q=rows[i],base=i*CCD_LAYOUT.words;const input=floatsToWords(packSweep(q));for(let j=0;j<input.length;j++)state[base+CCD_LAYOUT.work+j]=input[j];const points=state.length;state.push(...floatsToWords(q.pointsA.flat()));metadata.push({points,count:q.pointsA.length,fraction:q.maxFraction});}
 const metaAt=state.length;state.push(...metadata.flatMap(m=>[m.points,m.count,floatsToWords([m.fraction])[0]]));
 const owner=await createNativeOwner('resident-ccd-sweep');try{
  const code=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(1) var<storage,read> rc_program:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
${generateNumericLibraryWGSL()}\n${generateBvhWGSL()}\n${generateCcdWGSL(programs)}
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){let row=gid.x;if(row>=${rows.length}u){return;}let b=row*${CCD_LAYOUT.words}u;let m=${metaAt}u+row*3u;let r=rc_ccd_sweep(b,rc_state[m],rc_state[m+1u],bitcast<f32>(rc_state[m+2u]),row*${programs.scratchWords}u,0u);let out=b+800u;rc_state[out]=r.status;rc_ccd_put(out+1u,r.fraction);rc_ccd_vec(out+2u,r.point);rc_ccd_vec(out+5u,r.normal);rc_state[out+8u]=r.distanceQueries;rc_state[out+9u]=r.rootIterations;rc_state[out+10u]=r.pushBacks;
if(rc_state[b]!=0u){return;}
// Timing-controller fixture only: no body solve is claimed by this marker.
let dt=select(bitcast<f32>(${floatsToWords([Math.fround(1/960)])[0]}u),bitcast<f32>(${floatsToWords([Math.fround(1/61440)])[0]}u),row%2u==1u);let minDt=select(0.0,bitcast<f32>(${floatsToWords([Math.fround(1/6000)])[0]}u),row%2u==1u);if(rc_ccd_begin(b,dt,minDt)!=0u){return;}var passes=0u;
loop{if(rc_state[b+1u]==3u){break;}if(passes>=4u){rc_ccd_fail(b,5u);return;}rc_state[b+10u]=u32(rc_state[b+3u]>1u);rc_state[b+9u]=0u;if(rc_ccd_select_pass(b,row*${programs.scratchWords}u,0u)!=0u){return;}let trace=b+820u+passes*5u;rc_state[trace]=rc_state[b+5u];rc_state[trace+1u]=rc_state[b+6u];rc_state[trace+2u]=rc_state[b+4u];rc_state[trace+3u]=rc_state[b+11u];rc_state[trace+4u]=rc_state[b+12u];rc_state[b+13u]=1u;if(rc_ccd_advance_pass(b)!=0u){return;}passes++;}rc_state[b+840u]=passes;}`;
  const staged=process.env.RESIDENT_CCD_STAGED==='1';let stages=[{code}],cycles=1;
  if(staged){
   const prefix=code.slice(0,code.lastIndexOf('@compute')),finish=code.slice(code.indexOf('let out=b+800u;'),code.indexOf('// Timing-controller fixture'));
   const common=`let row=gid.x;if(row>=${rows.length}u){return;}let b=row*${CCD_LAYOUT.words}u;let m=${metaAt}u+row*3u;`;
   const timingPrepare=`rc_state[b+10u]=u32(rc_state[b+3u]>1u);rc_state[b+9u]=0u;if(rc_ccd_select_pass_prepare(b)!=0u){rc_state[b+960u]=4u;return;}`;
   const evalMain=`@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){${common}let tag=rc_state[b+960u];if(rc_state[b]!=0u||tag==0u||tag>=3u){return;}var request=vec2<u32>(${programs.entries.schedule.id}u,b+448u);if(tag==1u){if(rc_state[b+896u]==0u){return;}request=rc_ccd_sweep_numeric_request(b);}rc_ccd_eval(b,request.y,request.x,row*${programs.scratchWords}u,0u);}`;
   const controlMain=`@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){${common}let tag=rc_state[b+960u];if(rc_state[b]!=0u){rc_state[b+960u]=4u;return;}if(tag==0u){rc_ccd_sweep_begin(b,rc_state[m],rc_state[m+1u],bitcast<f32>(rc_state[m+2u]));rc_state[b+960u]=1u;return;}if(tag>=3u){return;}
if(tag==2u){if(rc_ccd_select_pass_finish(b)!=0u){rc_state[b+960u]=4u;return;}let passes=rc_state[b+961u];if(passes>=4u){rc_ccd_fail(b,5u);return;}let trace=b+820u+passes*5u;rc_state[trace]=rc_state[b+5u];rc_state[trace+1u]=rc_state[b+6u];rc_state[trace+2u]=rc_state[b+4u];rc_state[trace+3u]=rc_state[b+11u];rc_state[trace+4u]=rc_state[b+12u];rc_state[b+13u]=1u;rc_ccd_advance_pass(b);rc_state[b+961u]++;if(rc_state[b+1u]==3u){rc_state[b+840u]=rc_state[b+961u];rc_state[b+960u]=3u;return;}${timingPrepare}return;}
if(rc_state[b+896u]!=0u){rc_ccd_sweep_step(b,row*${programs.scratchWords}u,0u);}if(rc_state[b]!=0u){rc_state[b+960u]=4u;return;}if(rc_state[b+896u]!=0u){return;}let r=rc_ccd_sweep_result(b);${finish}
let dt=select(bitcast<f32>(${floatsToWords([Math.fround(1/960)])[0]}u),bitcast<f32>(${floatsToWords([Math.fround(1/61440)])[0]}u),row%2u==1u);let minDt=select(0.0,bitcast<f32>(${floatsToWords([Math.fround(1/6000)])[0]}u),row%2u==1u);if(rc_ccd_begin(b,dt,minDt)!=0u){return;}rc_state[b+961u]=0u;${timingPrepare}rc_state[b+960u]=2u;}`;
   stages=[{code:prefix+evalMain},{code:prefix+controlMain}];cycles=512;
  }
  stages=stages.map(stage=>({...stage,code:pruneCcdWGSL(stage.code)}));if(staged)assert.doesNotMatch(stages[1].code,/fn rc_num_eval\(|fn rc_ccd_eval\(|fn rc_ccd_pd_proxyDistance\(/,'control stage cannot embed any numeric interpreter or monolithic GJK');
  const [actual]=await dispatchWordStages(owner,{stages,cycles,bindingTypes:['storage','read-only-storage','storage'],buffers:[{input:Uint32Array.from(state),readback:true},{input:programs.program},{words:rows.length*programs.scratchWords}],workgroups:rows.length,label:'resident-source-ccd-sweep'});
  const statuses=['Separated','Hit','Overlapped','Failed'];for(let i=0;i<rows.length;i++){const b=i*CCD_LAYOUT.words,out=b+800,e=expected[i];assert.equal(actual[b+CCD_HEADER.error],0,'CCD draft error for row '+i);if(staged)assert.equal(actual[b+960],3,'fixed device-cycle budget must finish, never treat pending as miss');const f=new Float32Array(actual.buffer);assert.equal(statuses[actual[out]],e.status,'status row '+i);assert.equal(f[out+1],e.fraction,'fraction row '+i);assert.deepEqual(Array.from(f.slice(out+2,out+5)),e.point,'point row '+i);assert.deepEqual(Array.from(f.slice(out+5,out+8)),e.normal,'normal row '+i);assert.deepEqual(Array.from(actual.slice(out+8,out+11)),[e.diagnostics.distanceQueries,e.diagnostics.rootIterations,e.diagnostics.pushBacks],'source continuation counters row '+i);
   let remaining=Math.fround(i%2?1/61440:1/960),collisionDt=remaining,steps=4,passes=0;const minCcdDt=i%2?Math.fround(1/6000):0;
   while(steps){const result=S.reference({remainingTime:remaining,remainingSubsteps:steps,minCcdDt,firstImpact:steps>1?0:null}),at=b+820+passes*5;assert.deepEqual(Array.from(f.slice(at,at+4)),[collisionDt,result.dt,remaining,result.remainingTime]);assert.equal(actual[at+4],result.remainingSubsteps);remaining=result.remainingTime;steps=result.remainingSubsteps;collisionDt=result.dt;passes++;}assert.equal(actual[b+840],passes);assert.equal(actual[b+CCD_HEADER.phase],3);
  }
  console.log(JSON.stringify({scope:'source-ccd-sweep-component-not-full-world',rows:rows.length,singleDispatch:!staged,deviceStages:stages.length,cycles,hostContinuation:false,scratchWords:programs.scratchWords,adapter:owner.adapterInfo}));
 }finally{owner.release();}
});

test('native registered four-ball roster owns BVH lifecycle, pre-force selection and post-solve clamp',{timeout:240000},async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('explicit globally serialized GPU slot and original artifact required');
 const {originalRegisteredFixture}=await import('./resident-candidate-original-fixture.mjs');
 const {packRegisteredCcdSeed,packWorldCcdBody,packCcdBody}=await import('../src/resident-candidate/ccd.mjs');
 const {BVH_LAYOUT,BVH_SCRATCH_WORDS,packBvhState,unpackBvhState}=await import('../src/resident-candidate/bvh.mjs');
 const {createNativeOwner,dispatchWordStages}=await import('./resident-candidate-gpu-support.mjs');
 const B=require('../src/experimental-ccd-bvh-state.js'),Broad=require('../src/experimental-cue-broad-phase.js'),Graph=require('../src/experimental-arithmetic-graph.js'),F=require('../src/experimental-ccd-fixed-sphere.js');
 const {seed}=await originalRegisteredFixture(),packed=packRegisteredCcdSeed(seed),raw=seed.cueInitial.sourceCreation.created;
 assert.deepEqual(packed.pointCounts,[8,22]);assert.deepEqual(packed.bodyKeys,seed.balls.map(b=>b.body.index+':'+b.body.generation));
 const bvh=await B.createReferenceStage({...seed.cueBroadSeed,sourcePipelineCompleted:true}),fixed=F.createReferenceStage(packed.source);
 const ownership={generations:Array.from({length:27},(_,i)=>seed.cueBroadSeed.colliders.find(c=>c.handle.index===i)?.handle.generation??null),removableLeaves:[24,25,26],freshOrder:seed.cueBroadSeed.modifiedColliders.map(h=>h.index),firstUpdate:true,initialLeaves:24,minimumLeaves:24,maximumLeaves:27};
 const initialBvh=packBvhState(bvh.snapshot(),ownership),same=(a,b)=>a.index===b.index&&a.generation===b.generation;
 const fresh=seed.cueBroadSeed.modifiedColliders.map(h=>{const c=seed.cueBroadSeed.colliders.find(c=>same(c.handle,h)),body=same(c.parent.handle,seed.cueBroadSeed.roles.shaft)?seed.cueInitial.cue.shaft:seed.cueInitial.cue.head,input=new Float32Array(24);input.set(body.translation);input.set(body.rotation,3);input.set(c.parent.pos_wrt_parent.translation,7);input[10]=c.shape.value.radius;input[11]=c.shape.value.half_height??0;input[12]=Number(c.shape.variant==='Cylinder');input[20]=seed.cueBroadSeed.lengthUnit;input[21]=seed.cueBroadSeed.normalizedPredictionDistance;const out=Graph.execute(input,Broad.PLANS.bounds);return{leaf:h.index,box:{min:Array.from(out.slice(0,3)),max:Array.from(out.slice(3,6))},skin:Math.fround(Math.fround(.04)*seed.cueBroadSeed.lengthUnit)};});
 const removed=[24,25,26],live=Array.from({length:27},(_,i)=>i),remaining=live.filter(i=>!removed.includes(i));
 // This is an independently captured CURRENT active-body predicate input, not
 // its native predicted endpoint. Other bodies and the full static roster are
 // the authenticated registered four-ball seed. It is a component probe only.
 const q=require('./fixtures/active-ccd/original-e35-prediction.json'),m=q.massProperties,ii=m.effective_world_inv_inertia;
 const active={kind:'dynamic-body-ccd-check',bodyType:'dynamic',sleeping:false,softFrame:false,ccdEnabled:true,maxCcdSubsteps:4,softCcdPrediction:0,linear:q.velocities.linvel,angular:q.velocities.angvel,translation:q.position.translation,rotation:q.position.rotation,force:q.forces.force,torque:q.forces.torque,invMass:m.effective_inv_mass,invInertia:[ii.m11,ii.m12,ii.m13,ii.m12,ii.m22,ii.m23,ii.m13,ii.m23,ii.m33],localCom:m.local_mprops.local_com,dt:q.nativeDt,maxExtent:m.max_extent,ccdThickness:q.ccd.ccd_thickness};
 const programs=createCcdPrograms({pointCounts:packed.pointCounts}),state=Array(CCD_LAYOUT.words).fill(0),put=a=>{const at=state.length;state.push(...a);return at;};
 seed.balls.forEach((ball,i)=>{const data=i===0?packCcdBody(active,{principalFrame:m.local_mprops.principal_inertia_local_frame,invPrincipalInertia:m.local_mprops.inv_principal_inertia,sleeping:false}):packWorldCcdBody(ball.state);for(let j=0;j<data.length;j++)state[CCD_LAYOUT.body+i*CCD_LAYOUT.bodyWords+j]=data[j];});
 const bvhAt=put(initialBvh),scratchAt=put(Array(BVH_SCRATCH_WORDS).fill(0)),seedAt=put(packed.words),freshAt=put(fresh.flatMap(r=>[r.leaf,...floatsToWords([...r.box.min,...r.box.max,r.skin])])),removedAt=put(removed),liveAt=put(live),remainingAt=put(remaining),statusesAt=put(Array(27).fill(0)),activeAt=put([0]);
 const initCommandsAt=put([freshAt,3,0,0,0,0,liveAt,27,statusesAt,0,0,removedAt,3,0,0,remainingAt,24,statusesAt]);
 try{
  bvh.begin();await bvh.prepareUpdate({updates:fresh,liveLeaves:live});await bvh.joinDeferredOptimize();bvh.commit();bvh.begin();await bvh.prepareUpdate({updates:[],removedLeaves:removed,liveLeaves:remaining});await bvh.joinDeferredOptimize();bvh.commit();const expectedBvh=bvh.snapshot();
  bvh.begin();const pre=await fixed.pre(active,seed.balls[0].body,{cuePresent:false,allDynamicBodiesAreOriginalBullets:true,bvhStage:bvh});assert.equal(pre.admitted,true);assert.equal(pre.activation.active,true);assert.ok(pre.fraction>0&&pre.fraction<1);
  const impact=M.reference('multiply',{a:pre.fraction,b:active.dt}).value,schedule=S.reference({remainingTime:active.dt,remainingSubsteps:4,minCcdDt:raw.integration.min_ccd_dt,firstImpact:impact});
  const prediction=M.reference('predictSphereCenter',{dt:Math.fround(active.dt*2),localCenter:active.localCom,translation:active.translation,linear:active.linear,force:active.force,invMass:active.invMass});
  const post=await fixed.post({...active,dt:schedule.dt,nextTranslation:prediction.c2,nextRotation:active.rotation},seed.balls[0].body,{cuePresent:false,allDynamicBodiesAreOriginalBullets:true,bvhStage:bvh});assert.equal(post.admitted,true);assert.ok(post.clampedPose,'original source endpoint probe must exercise an actual clamp');const inertia=M.reference('worldInvInertia',{rotation:post.clampedPose.rotation,principalFrame:m.local_mprops.principal_inertia_local_frame,invPrincipalInertia:m.local_mprops.inv_principal_inertia}).invInertia;
  const owner=await createNativeOwner('resident-ccd-registered-pre-post');try{
   const code=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(1) var<storage,read> rc_program:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
${generateNumericLibraryWGSL()}\n${generateBvhWGSL()}\n${generateCcdWGSL(programs)}
@compute @workgroup_size(1) fn main(){let bvh=${bvhAt}u;if(rc_bvh_set_scratch(bvh,${scratchAt}u)!=0u){return;}if(rc_bvh_prepare_update(bvh,${freshAt}u,3u,0u,0u,0u,0u,${liveAt}u,27u,${statusesAt}u)!=0u){return;}rc_bvh_join(bvh);if(rc_bvh_prepare_update(bvh,0u,0u,${removedAt}u,3u,0u,0u,${remainingAt}u,24u,${statusesAt}u)!=0u){return;}rc_bvh_join(bvh);rc_ccd_begin(0u,bitcast<f32>(${floatsToWords([active.dt])[0]}u),bitcast<f32>(${floatsToWords([raw.integration.min_ccd_dt])[0]}u));rc_ccd_pre_pass(0u,${seedAt}u,bvh,${activeAt}u,1u,0u,0u);}`;
   const prefix=code.slice(0,code.lastIndexOf('@compute'));
   const initialize=pruneCcdWGSL(prefix+`@compute @workgroup_size(1) fn main(){if(rc_state[0u]!=0u||rc_state[960u]!=0u){return;}let bvh=${bvhAt}u;let cursor=rc_state[962u];if(cursor<2u){if(cursor==0u&&rc_bvh_set_scratch(bvh,${scratchAt}u)!=0u){return;}let command=${initCommandsAt}u+cursor*9u;if(rc_bvh_prepare_update(bvh,rc_state[command],rc_state[command+1u],rc_state[command+2u],rc_state[command+3u],rc_state[command+4u],rc_state[command+5u],rc_state[command+6u],rc_state[command+7u],rc_state[command+8u])!=0u){return;}rc_bvh_join(bvh);rc_state[962u]++;return;}if(cursor!=2u){rc_ccd_fail(0u,4u);return;}rc_ccd_begin(0u,bitcast<f32>(${floatsToWords([active.dt])[0]}u),bitcast<f32>(${floatsToWords([raw.integration.min_ccd_dt])[0]}u));rc_ccd_pre_begin(0u,${seedAt}u,bvh,${activeAt}u,1u);rc_state[962u]=3u;rc_state[960u]=1u;}`);
   const evaluate=pruneCcdWGSL(prefix+`@compute @workgroup_size(1) fn main(){if(rc_state[0u]!=0u){return;}let tag=rc_state[960u];if(tag==0u||tag>=5u){return;}var request=vec2<u32>(${programs.entries.predict.id}u,448u);if(tag==1u){request=rc_ccd_pre_numeric_request(0u);}else if(tag==4u){request=rc_ccd_body_numeric_request(0u);}else if(tag!=3u){rc_ccd_fail(0u,4u);return;}if(rc_state[961u]!=0u){rc_ccd_fail(0u,4u);return;}if(rc_ccd_eval(0u,request.y,request.x,0u,0u)){rc_state[961u]=tag;}}`);
   const preControl=pruneCcdWGSL(prefix+`@compute @workgroup_size(1) fn main(){if(rc_state[0u]!=0u||rc_state[960u]!=1u||rc_state[961u]!=1u){return;}rc_state[961u]=0u;rc_ccd_pre_control(0u,0u,0u);if(rc_state[0u]==0u&&rc_state[14u]==0u){rc_ccd_copy(820u,352u,24u);rc_ccd_copy(448u,32u,64u);rc_state[484u]=${floatsToWords([Math.fround(active.dt*2)])[0]}u;rc_state[960u]=3u;}}`);
   const predictControl=pruneCcdWGSL(prefix+`@compute @workgroup_size(1) fn main(){if(rc_state[0u]!=0u||rc_state[960u]!=3u||rc_state[961u]!=3u){return;}rc_state[961u]=0u;rc_ccd_copy(69u,707u,3u);rc_ccd_copy(72u,41u,4u);rc_ccd_post_begin(0u,${seedAt}u,${bvhAt}u);rc_state[960u]=4u;}`);
   const postControl=pruneCcdWGSL(prefix+`@compute @workgroup_size(1) fn main(){if(rc_state[0u]!=0u||rc_state[960u]!=4u||rc_state[961u]!=4u){return;}rc_state[961u]=0u;rc_ccd_post_control(0u,0u,0u);if(rc_state[0u]==0u&&rc_state[14u]==0u){rc_state[960u]=5u;}}`);
   for(const control of[initialize,preControl,predictControl,postControl])assert.doesNotMatch(control,/fn rc_num_eval\(|fn rc_ccd_eval\(|fn rc_ccd_pd_proxyDistance\(/);
   assert.doesNotMatch(preControl,/fn rc_bvh_prepare_update\(|fn rc_ccd_post_control\(/);assert.doesNotMatch(postControl,/fn rc_bvh_prepare_update\(|fn rc_ccd_pre_control\(/);
   const [actual]=await dispatchWordStages(owner,{stages:[{code:initialize},{code:evaluate},{code:preControl},{code:predictControl},{code:postControl}],cycles:4096,bindingTypes:['storage','read-only-storage','storage'],buffers:[{input:Uint32Array.from(state),readback:true},{input:programs.program},{words:programs.scratchWords}],label:'resident-registered-four-ball-bvh-ccd-pre'});assert.equal(actual[960],5,'resident pre and post continuation must finish before admission');
   assert.equal(actual[bvhAt+18],0,'BVH draft error');assert.deepEqual(unpackBvhState(actual.slice(bvhAt,bvhAt+BVH_LAYOUT.words)),expectedBvh);assert.equal(actual[CCD_HEADER.error],0,'CCD draft error');const f=new Float32Array(actual.buffer);assert.equal(actual[CCD_HEADER.phase],2);assert.equal(f[820],pre.fraction);assert.equal(f[CCD_LAYOUT.result],post.fraction);assert.equal(actual[CCD_LAYOUT.result+2],1);assert.deepEqual(Array.from(f.slice(CCD_LAYOUT.result+4,CCD_LAYOUT.result+11)),[...post.clampedPose.translation,...post.clampedPose.rotation]);assert.deepEqual(Array.from(f.slice(CCD_LAYOUT.result+11,CCD_LAYOUT.result+20)),inertia);assert.equal(f[CCD_HEADER.firstImpact],impact);assert.equal(f[CCD_HEADER.solveDt],schedule.dt);assert.equal(f[CCD_HEADER.afterTime],schedule.remainingTime);assert.equal(actual[CCD_HEADER.afterSteps],schedule.remainingSubsteps);assert.equal(f[CCD_HEADER.collisionDt],active.dt);
   console.log(JSON.stringify({scope:'registered-four-ball-roster-active-current-body-component-probe-not-full-world',sourceSnapshot:raw.snapshotSha256,singleDispatch:false,deviceStages:5,cycles:4096,nativeFutureEndpoints:false,hostContinuation:false,preFraction:pre.fraction,postFraction:post.fraction,postEndpoint:'calculated on device by original prediction graph; component probe not a solver',adapter:owner.adapterInfo}));
  }finally{owner.release();}
 }finally{bvh.abort();bvh.dispose();fixed.dispose();}
});
