import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {BVH_LAYOUT,BVH_HEADER,BVH_CAPABILITY,BVH_SCRATCH_WORDS,BVH_SCRATCH_LAYOUT,packBvhState,unpackBvhState,queryPackedBvhForTest,generateBvhWGSL} from '../src/resident-candidate/bvh.mjs';
const require=createRequire(import.meta.url),Source=require('../src/experimental-ccd-bvh-state.js');
const f=Math.fround;
function bounds(id,offset=0,flat=false){const x=f(flat?0:id%5*.25+offset),y=f(flat?0:Math.floor(id/5)*.13);return{min:[x,y,f(-.02)],max:[f(x+.1),f(y+.08),f(.02)]};}
function tree(){const nodes=[],parents=[],map=[];function walk(ids,parent){const w=nodes.length;nodes.push({});parents.push(parent);const mid=Math.floor(ids.length/2);for(const [side,list]of[[0,ids.slice(0,mid)],[1,ids.slice(mid)]]){let node;if(list.length===1){const id=list[0],q=bounds(id);node={mins:q.min,maxs:q.max,data:1,children:id};map[id]=w*2+side;}else{const child=walk(list,w*2+side),n=nodes[child];node={mins:n.left.mins.map((x,i)=>Math.min(x,n.right.mins[i])),maxs:n.left.maxs.map((x,i)=>Math.max(x,n.right.maxs[i])),data:list.length,children:child};}nodes[w][side?'right':'left']=node;}return w;}walk(Array.from({length:22},(_,i)=>i),0);return{nodes,parents,leaf_node_indices:{n:22,v:map},free_wide_nodes:[],optimization:{rebuild_frame_index:0,rebuild_start_index:0}};}
function seed(){return{sourceRevision:Source.SOURCE_REVISION,sourcePipelineCompleted:true,initialSnapshotSha256:'1'.repeat(64),modifiedColliders:[22,23,24].map(index=>({index,generation:0})),initialBroadPhase:{tree:tree(),frame_index:72,changes_since_optimize:0,reinsert_leaf_updates:true,optimization_strategy:'SubtreeOptimizer',adaptive_change_detection_margin:false,pending_set_aabb:[],prev_updated_leaves:[]}};}
const ownership=firstUpdate=>({generations:Array(25).fill(0),removableLeaves:[22,23,24],freshOrder:[22,23,24],firstUpdate,initialLeaves:22,minimumLeaves:22,maximumLeaves:25});
const rows=(ids,off=0,flat=false)=>ids.map(leaf=>({leaf,box:bounds(leaf,off,flat),skin:f(.04)}));
function exact(a,b){assert.deepEqual(a,b);}
async function fresh(s){s.begin();await s.prepareUpdate({updates:rows([22,23,24])});await s.joinDeferredOptimize();s.commit();}

test('full source tree and scheduler pack exactly before and after recurrent original operations',async()=>{
 const stage=await Source.createReferenceStage(seed());let count=0;try{
  exact(unpackBvhState(packBvhState(stage.snapshot(),ownership(true))),stage.snapshot());count++;
  await fresh(stage);
  for(let i=0;i<40;i++){
   stage.begin();await stage.prepareUpdate({updates:rows([16,17,18,19,20,21],i%2?.3:-.3)});
   // Include deferred work, not only the already joined/clean snapshot.
   exact(unpackBvhState(packBvhState(stage.preview(),ownership(false))),stage.preview());count++;
   await stage.joinDeferredOptimize();await stage.setAabbs(rows([16,17,18],i%2?-.1:.1));stage.commit();
   exact(unpackBvhState(packBvhState(stage.snapshot(),ownership(false))),stage.snapshot());count++;
  }
  stage.begin();await stage.prepareUpdate({updates:[],removedLeaves:[23,24,22]});await stage.joinDeferredOptimize();stage.commit();
  exact(unpackBvhState(packBvhState(stage.snapshot(),ownership(false))),stage.snapshot());count++;
  assert.equal(count,82);assert.ok(stage.diagnostics().optimizerRuns>=35);
 }finally{stage.abort();stage.dispose();}
});

test('packed query preserves source leaf traversal order, tails and empty results',async()=>{
 const s=await Source.createReferenceStage(seed());try{await fresh(s);const packed=packBvhState(s.snapshot(),ownership(false));
  for(const q of[{min:[-10,-10,-10],max:[10,10,10]},{min:[20,20,20],max:[21,21,21]},...Array.from({length:25},(_,i)=>bounds(i))]){
   exact(queryPackedBvhForTest(packed,q),s.queryLeaves(q));
  }
  const before=packed.slice();queryPackedBvhForTest(packed,{min:[-10,-10,-10],max:[10,10,10]});exact(packed,before);
 }finally{s.abort();s.dispose();}
});

test('packed scheduler preserves ordered duplicate pending IDs and generation identity',async()=>{
 const s=await Source.createReferenceStage(seed());try{await fresh(s);const source=s.snapshot();source.pending_set_aabb=[{index:16,generation:0},{index:17,generation:0},{index:16,generation:0}];
  const words=packBvhState(source,ownership(false));exact(unpackBvhState(words),source);
  source.pending_set_aabb[2].generation=1;assert.throws(()=>packBvhState(source,ownership(false)),/generation/);
 }finally{s.abort();s.dispose();}
});

test('capacity, invalid source fields and failed draft are explicit errors, never truncated',async()=>{
 const s=await Source.createReferenceStage(seed());try{
  const initial=s.snapshot(),words=packBvhState(initial,ownership(true));assert.equal(words.byteLength,8720);assert.equal(words.length,BVH_LAYOUT.words);
  assert.throws(()=>queryPackedBvhForTest(words,{min:[-1,-1,-1],max:[1,1,1]}),/boundary/);
  const failed=words.slice();failed[BVH_HEADER.error]=1;assert.throws(()=>unpackBvhState(failed),/terminal error/);
  assert.throws(()=>packBvhState({...initial,pending_set_aabb:Array.from({length:257},()=>({index:0,generation:0}))},ownership(true)),/capacity/);
  assert.throws(()=>packBvhState({...initial,optimization_strategy:'None'},ownership(true)),/optimizer/);
  const holes=ownership(true);holes.generations[0]=null;assert.throws(()=>packBvhState(initial,holes),/complete generation/);
  assert.throws(()=>unpackBvhState(words.subarray(0,words.length-1)),/span/);
 }finally{s.abort();s.dispose();}
});

test('WGSL library owns ordered traversals and substantive source mutators without host runtime callbacks',()=>{
 const code=generateBvhWGSL();for(const fn of ['query','bvtt','remove','rotate','insert','full_refit','partial_refit','update_leaf'])assert.match(code,new RegExp('fn rc_bvh_'+fn+'\\('));
 assert.doesNotMatch(code,/@compute|@binding|atomicAdd|hostCallback/);
 assert.doesNotMatch(code,/var\s+\w+\s*:\s*array\s*</,'candidate-sized scratch must not become per-invocation private arrays');
 assert.equal(BVH_SCRATCH_WORDS*4,16384);assert.equal(BVH_HEADER.scratch,20);
 const spans=Object.values(BVH_SCRATCH_LAYOUT).sort((a,b)=>a.offset-b.offset);
 for(let i=0;i<spans.length;i++){assert.ok(spans[i].offset+spans[i].words<=BVH_SCRATCH_WORDS);if(i)assert.ok(spans[i-1].offset+spans[i-1].words<=spans[i].offset);}
 assert.equal(BVH_CAPABILITY.hostForwardFallback,false);assert.equal(BVH_CAPABILITY.deviceOptimizer,true);assert.equal(BVH_CAPABILITY.deviceLifecycle,true);
 assert.match(code,/single\(\) emitting right leaves before descending/);
});

test('bounded optimizer configuration table matches every source leaf count and scheduling regime',()=>{
 for(let n=22;n<=27;n++)for(let frame=0;frame<128;frame++){
  const source=Source.optimizationConfig(n,frame,27);
  assert.deepEqual(source,{targetRoot:n>=26?6:5,targetSubtree:n===22?19:n>=26?21:20,targetSubtreeCount:frame%2===0?1:0,rootMode:frame%2===0?'skip':Math.floor(frame/2)%16===0?'breadth-first':'priority-queue'});
 }
});

test('actual resident WGSL owns complete recurrent BVH schedule and query order without host state continuation',{timeout:180000},async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('explicit globally serialized GPU slot required');
 const {createNativeOwner,dispatchWords}=await import('./resident-candidate-gpu-support.mjs');
 const owner=await createNativeOwner('resident-bvh-recurrence'),s=await Source.createReferenceStage(seed());
 try{
  const commandBase=2208,commandStride=12,commandCapacity=256,dataBase=commandBase+commandStride*commandCapacity;
  const words=Array(dataBase).fill(0);words.splice(0,BVH_LAYOUT.words,...packBvhState(s.snapshot(),ownership(true)));
  const commands=[],expected=[],checkpointPointers=[];const put=values=>{const at=words.length;words.push(...values);return at;};
  const raw=floats=>Array.from(new Uint32Array(Float32Array.from(floats).buffer));
  const updateRows=rs=>put(rs.flatMap(u=>[u.leaf,...raw([...u.box.min,...u.box.max,u.skin])]));
  let live=Array.from({length:25},(_,i)=>i),liveAt=put(live);const statuses=2180;
  const command=(op,...args)=>{assert.ok(commands.length<commandCapacity);commands.push([op,...args,...Array(commandStride-1-args.length).fill(0)]);};
  const update=async(rs,removed=[],forced=[])=>{if(removed.length){live=live.filter(id=>!removed.includes(id));liveAt=put(live);}command(0,updateRows(rs),rs.length,put(removed),removed.length,put(forced),forced.length,liveAt,live.length,statuses);return s.prepareUpdate({updates:rs,removedLeaves:removed,forcedReinsertLeaves:forced,liveLeaves:live});};
  const join=async()=>{command(1);await s.joinDeferredOptimize();};
  const moved=async rs=>{command(2,updateRows(rs),rs.length,statuses);await s.setAabbs(rs);};
  const checkpoint=()=>{expected.push(s.snapshot());const p=put(Array(BVH_LAYOUT.words).fill(0));checkpointPointers.push(p);command(3,p);};
  s.begin();await update(rows([22,23,24]));await join();s.commit();checkpoint();
  for(let frame=0;frame<40;frame++){
   s.begin();await update(rows([16,17,18,19,20,21],frame%2?.3:-.3));await join();await moved(rows([16,17,18],frame%2?-.1:.1));s.commit();checkpoint();
  }
  s.begin();await update([], [23,24,22]);await join();s.commit();checkpoint();
  for(let i=0;i<9;i++){s.begin();await update([]);await join();s.commit();}
  s.begin();await moved(rows([16],2));s.commit();checkpoint();
  s.begin();await update(rows([17],1),[],[17]);await join();s.commit();checkpoint();
  const q={min:[-10,-10,-10],max:[10,10,10]},queryAt=put(Array(28).fill(0));command(4,put(raw([...q.min,...q.max])),queryAt);
  const pairAt=put(Array(703).fill(0));command(5,pairAt);
  const scratchAt=put(Array(BVH_SCRATCH_WORDS).fill(0));
  commands.forEach((c,i)=>{for(let j=0;j<commandStride;j++)words[commandBase+i*commandStride+j]=c[j];});
  const code=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;\n${generateBvhWGSL()}\n@compute @workgroup_size(1) fn main(){
    if(rc_bvh_set_scratch(0u,${scratchAt}u)!=0u){return;}
    for(var cmd=0u;cmd<${commands.length}u;cmd++){let p=${commandBase}u+cmd*${commandStride}u;let op=rc_state[p];
      if(op==0u){rc_bvh_prepare_update(0u,rc_state[p+1u],rc_state[p+2u],rc_state[p+3u],rc_state[p+4u],rc_state[p+5u],rc_state[p+6u],rc_state[p+7u],rc_state[p+8u],rc_state[p+9u]);}
      else if(op==1u){rc_bvh_join(0u);}
      else if(op==2u){rc_bvh_set_aabbs(0u,rc_state[p+1u],rc_state[p+2u],rc_state[p+3u]);}
      else if(op==3u){for(var j=0u;j<${BVH_LAYOUT.words}u;j++){rc_state[rc_state[p+1u]+j]=rc_state[j];}}
      else if(op==4u){let q=rc_state[p+1u];let out=rc_state[p+2u];rc_state[out]=rc_bvh_query(0u,vec3<f32>(bitcast<f32>(rc_state[q]),bitcast<f32>(rc_state[q+1u]),bitcast<f32>(rc_state[q+2u])),vec3<f32>(bitcast<f32>(rc_state[q+3u]),bitcast<f32>(rc_state[q+4u]),bitcast<f32>(rc_state[q+5u])),out+1u);}
      else if(op==5u){let out=rc_state[p+1u];rc_state[out]=rc_bvh_bvtt(0u,out+1u,351u);}
      if(rc_state[18u]!=0u){rc_state[19u]=cmd;return;}
    }
  }`;
  const [actual]=await dispatchWords(owner,{code,buffers:[{input:Uint32Array.from(words),readback:true}],label:'resident-bvh-complete-source-recurrence'});
  assert.equal(actual[BVH_HEADER.error],0,'resident draft failed at command '+actual[19]);
  for(let i=0;i<expected.length;i++)exact(unpackBvhState(actual.slice(checkpointPointers[i],checkpointPointers[i]+BVH_LAYOUT.words)),expected[i]);
  const queryExpected=s.queryLeaves(q);exact(Array.from(actual.slice(queryAt+1,queryAt+1+actual[queryAt])),queryExpected);
  const First=require('../src/experimental-cue-bvh-insertion.js'),pairs=First.sourceTreeCandidates(s.snapshot().tree).candidates;
  assert.equal(actual[pairAt],pairs.length);exact(Array.from({length:pairs.length},(_,i)=>Array.from(actual.slice(pairAt+1+i*2,pairAt+3+i*2))),pairs);
  console.log(JSON.stringify({scope:'resident-source-bvh-component-not-full-world',checkpoints:expected.length,commands:commands.length,singleDispatch:true,hostStateContinuation:false,adapter:owner.adapterInfo}));
 }finally{s.abort();s.dispose();owner.release();}
});
