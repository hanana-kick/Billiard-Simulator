// These are broad composition/address-order probes, not a physical whole h.
// Native execution is reserved for the parent's single serialized GPU gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {WORLD_BROAD_LAYOUT as L,completeJournalBodyColliderOrder,encodeWorldBroad,createWorldBroadPrograms,generateWorldBroadWGSL} from '../src/resident-candidate/world-broad.mjs';
import {encodeContactJournal,CONTACT_JOURNAL_LAYOUT as J,generateContactJournalWGSL} from '../src/resident-candidate/contact-journal.mjs';
import {generateContactRosterWGSL} from '../src/resident-candidate/contact-roster.mjs';
import {packBvhState,unpackBvhState,BVH_LAYOUT as V,BVH_SCRATCH_WORDS,generateBvhWGSL} from '../src/resident-candidate/bvh.mjs';
import {encodeSceneInitialization} from '../src/resident-candidate/scene-initialization.mjs';
import {SCENE_LAYOUT as S,generateSceneActivationWGSL} from '../src/resident-candidate/scene-activation.mjs';
import {executeLowered,generateNumericLibraryWGSL} from '../src/resident-candidate/numeric-program.mjs';
import {createNativeOwner,dispatchWordStages} from './resident-candidate-gpu-support.mjs';
const require=createRequire(import.meta.url),Bridge=require('../src/experimental-ccd-bvh-world-bridge.js'),Graph=require('../src/experimental-arithmetic-graph.js'),Broad=require('../src/experimental-cue-broad-phase.js'),programs=createWorldBroadPrograms(),U=0xffffffff,f=Math.fround;
const bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0],same=(a,b)=>a.index===b.index&&a.generation===b.generation;
const ROLES=['ball','otherBall1','otherBall2','otherBall3','shaft','head'],ORDER=['head','ball','shaft','otherBall2','otherBall1','otherBall3'];
function assertWords(a,b,label){assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)assert.equal(a[i],b[i],label+' first differing word '+i);}
async function fixture(){
 const {seed}=await originalRegisteredFixture(),raw=seed.cueInitial.sourceCreation.created.bodies,scene=encodeSceneInitialization(seed.cueInitial.sourceCreation,{bodyRegistry:seed.bodyRegistry});
 const wb=7,journal=wb+L.words+7,bvh=journal+J.words+7,sceneBase=bvh+V.words+7,bodyBase=sceneBase+S.words+7,bvhScratch=bodyBase+6*64+7,firstRows=bvhScratch+BVH_SCRATCH_WORDS+7,control=firstRows+27*8+7,state=new Uint32Array(control+8).fill(0x12345678);
 const bindings=[...ROLES,'guide'].map((role,i)=>({body:raw[role].handle,bodyBase:i<6?bodyBase+i*64:U,sceneSlot:scene.template.bodies.findIndex(b=>same(b.handle,raw[role].handle))}));
 const order=completeJournalBodyColliderOrder(seed.cueBroadSeed);state.set(encodeWorldBroad(seed.cueBroadSeed,{bindings}),wb);state.set(encodeContactJournal(seed.contactGraphSeed,{bodyColliderOrder:order}),journal);state.set(scene.sceneWords,sceneBase);
 for(let i=0;i<6;i++){const p=raw[ROLES[i]].pos.position,row=new Float32Array(64);row.set(p.translation,6);row.set(p.rotation,9);state.set(new Uint32Array(row.buffer),bodyBase+i*64);}
 const bridge=await Bridge.createReferenceStage(seed.cueBroadSeed),ownership={generations:seed.cueBroadSeed.colliders.map(c=>c.handle.generation),removableLeaves:seed.contactGraphSeed.cueColliders.map(h=>h.index),freshOrder:seed.cueBroadSeed.modifiedColliders.map(h=>h.index),firstUpdate:true,initialLeaves:24,minimumLeaves:24,maximumLeaves:27};state.set(packBvhState(bridge.snapshot(),ownership),bvh);state.fill(0,bvhScratch,bvhScratch+BVH_SCRATCH_WORDS);state[control]=0;
 const pose=role=>({body:raw[role].handle,translation:[...raw[role].pos.position.translation],rotation:[...raw[role].pos.position.rotation]}),own={cue:{head:pose('head'),shaft:pose('shaft')},balls:ROLES.slice(0,4).map(pose),removedBodies:[],activeBodyOrder:ORDER.map(role=>raw[role].handle)};
 const expectedRows=(handles,poses)=>handles.map(h=>{const c=seed.cueBroadSeed.colliders.find(c=>same(c.handle,h)),p=[...poses.balls,poses.cue.head,poses.cue.shaft].find(p=>same(p.body,c.parent.handle)),input=new Float32Array(24);input.set(p.translation);input.set(p.rotation,3);input.set(c.parent.pos_wrt_parent.translation,7);input[10]=c.shape.value.radius;input[11]=c.shape.value.half_height??0;input[12]=+(c.shape.variant==='Cylinder');input[20]=seed.cueBroadSeed.lengthUnit;input[21]=seed.cueBroadSeed.normalizedPredictionDistance;const output=Graph.execute(input,Broad.PLANS.bounds);assertWords(new Uint32Array(executeLowered(programs.compiled,input,{testOnly:true}).buffer),new Uint32Array(output.buffer),'lowered source bounds');return[c.handle.index,...Array.from(output.slice(0,6),bits),bits(f(f(.04)*seed.cueBroadSeed.lengthUnit))];});
 const fresh=expectedRows(seed.cueBroadSeed.modifiedColliders,own);bridge.begin();await bridge.collision(own);await bridge.beforeQueries();
 // Explicit device-local pose perturbation probes dependency on current body
 // storage. It is not claimed as an integrator, physics result, or valid route.
 for(const p of [...own.balls,own.cue.head,own.cue.shaft])p.translation[0]=f(p.translation[0]+f(.1));
 const moved=expectedRows(own.activeBodyOrder.flatMap(body=>seed.cueBroadSeed.bodyColliders.find(b=>same(b.body,body)).colliders),own);await bridge.moved(own);const expectedBvh=structuredClone(bridge.stage.preview());bridge.abort();bridge.dispose();
 return{seed,state,bindings,wb,journal,bvh,scene:sceneBase,bodyBase,bvhScratch,firstRows,control,fresh,moved,expectedBvh};
}
test('original moving collider order and fixed-parent singleton proof are explicit',async()=>{
 const t=await fixture(),order=completeJournalBodyColliderOrder(t.seed.cueBroadSeed);assert.equal(order.flatMap(b=>b.colliders).length,27);assert.deepEqual(order.find(b=>same(b.body,t.seed.cueBroadSeed.roles.head)).colliders.map(h=>h.index),[26,25]);assert.deepEqual(t.fresh.map(r=>r[0]),[24,26,25]);assert.deepEqual(t.moved.slice(0,2).map(r=>r[0]),[26,25]);
 const broken=structuredClone(t.seed.cueBroadSeed);broken.bodyColliders=broken.bodyColliders.filter(b=>!same(b.body,broken.roles.head));assert.throws(()=>completeJournalBodyColliderOrder(broken),/missing multi-collider or moving/);assert.equal(t.state[t.wb+L.header.status],0);
});
test('world broad exposes a single numeric evaluator outside all source-order walks',()=>{const code=generateWorldBroadWGSL(programs);assert.equal((code.match(/rc_num_eval\(/g)||[]).length,1);for(const name of['begin_collision','begin_post','gather','evaluate','scatter','commit_collision','commit_post','before_queries','narrow','finish'])assert.match(code,new RegExp('fn rc_world_broad_'+name+'\\('));assert.equal(programs.scratchWords,39);assert.equal(L.bytes,4224);assert.doesNotMatch(code,/@compute|@binding|atomic/);});
test('actual staged WGSL broad uses canonical poses and source parent order before BVTT and deferred join',
 {skip:process.env.REQUIRE_WEBGPU!=='1',timeout:180000},async()=>{
 const t=await fixture(),{wb:b,journal:j,bvh:v,scene:s,bodyBase:body,bvhScratch:bs,firstRows:fr,control:c}=t;
 const common=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;\n${generateNumericLibraryWGSL()}\n${generateBvhWGSL()}\n${generateContactRosterWGSL()}\n${generateContactJournalWGSL()}\n${generateSceneActivationWGSL()}\n${generateWorldBroadWGSL(programs)}`;
 const order=ORDER.map(role=>t.bindings.find(b=>same(b.body,t.seed.cueBroadSeed.roles[role])).sceneSlot);
 const bodies=[`if(rc_state[${c}u]==0u){rc_bvh_set_scratch(${v}u,${bs}u);rc_world_broad_begin_collision(${b}u,${v}u,${j}u,${s}u,0xffffffffu);rc_state[${c}u]=1u;}`,
  `if(rc_state[${c}u]==1u||rc_state[${c}u]==3u){rc_world_broad_gather(${b}u,${j}u,${s}u,0u);}`,
  `if(rc_state[${c}u]==1u||rc_state[${c}u]==3u){rc_world_broad_evaluate(${b}u,0u,0u);}`,
  `if(rc_state[${c}u]==1u||rc_state[${c}u]==3u){rc_world_broad_scatter(${b}u,0u);}`,
  `if(rc_state[${c}u]==1u&&rc_state[${b+L.header.cursor}u]==rc_state[${b+L.header.updateCount}u]){for(var i=0u;i<rc_state[${b+L.header.updateCount}u]*8u;i++){rc_state[${fr}u+i]=rc_state[${b+L.updatesOffset}u+i];}rc_world_broad_commit_collision(${b}u,${v}u,${j}u);rc_world_broad_before_queries(${b}u,${v}u);rc_state[${c}u]=2u;}`,
  // Isolate broad post-solve boundary. No narrow/solve result is asserted.
  `if(rc_state[${c}u]==2u&&rc_state[${b}u]==0u){for(var i=0u;i<6u;i++){let p=${body}u+i*64u+6u;rc_state[p]=bitcast<u32>(bitcast<f32>(rc_state[p])+0.1);}rc_state[${s+S.header.awake}u]=0u;rc_state[${s+S.chunkMapOffset}u]=0u;rc_state[${s+S.chunkOffset}u]=0u;rc_state[${s+S.chunkOffset+1}u]=6u;${order.map((slot,i)=>`rc_state[${s+S.chunkOffset+2+i}u]=${slot}u;`).join('')}rc_state[${b+L.header.phase}u]=2u;rc_state[${j+J.header.phase}u]=3u;rc_world_broad_begin_post(${b}u,${j}u,${s}u);rc_state[${c}u]=3u;}`,
  `if(rc_state[${c}u]==3u&&rc_state[${b+L.header.cursor}u]==rc_state[${b+L.header.updateCount}u]){rc_world_broad_commit_post(${b}u,${v}u);rc_state[${c}u]=4u;}`];
 const stages=bodies.map(body=>({code:common+`\n@compute @workgroup_size(1) fn main(){${body}}`}));const owner=await createNativeOwner('resident-world-broad');try{const[actual]=await dispatchWordStages(owner,{stages,cycles:32,buffers:[{input:t.state,readback:true},{input:programs.program},{words:programs.scratchWords}],bindingTypes:['storage','read-only-storage','storage'],workgroups:1,label:'source-world-broad-staged'});assert.equal(actual[c],4,'complete staged collision and post');assert.equal(actual[b],0,'world broad status');assert.equal(actual[j],0,'actual BVTT journal status');assert.equal(actual[v+18],0,'BVH status');assertWords(actual.slice(fr,fr+t.fresh.length*8),Uint32Array.from(t.fresh.flat()),'original fresh order and bounds');assertWords(actual.slice(b+L.updatesOffset,b+L.updatesOffset+t.moved.length*8),Uint32Array.from(t.moved.flat()),'current awake/parent order and exact bounds');assert.deepEqual(unpackBvhState(actual.slice(v,v+V.words)),t.expectedBvh,'independent original broad world owner');console.log(JSON.stringify({scope:'broad-composition-not-whole-h',fresh:t.fresh.length,moved:t.moved.length,deviceCurrentPose:true,parentOrder:true,adapter:owner.adapterInfo}));}finally{await owner.release();}
 });
