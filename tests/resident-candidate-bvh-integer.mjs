import{test}from'node:test';import assert from'node:assert/strict';
import{createRequire}from'node:module';const require=createRequire(import.meta.url);
import{generateBvhIntegerWGSL,BVH_INTEGER_CAPABILITY}from'../src/resident-candidate/bvh-integer.mjs';
import{generateBvhWGSL,BVH_LAYOUT,BVH_HEADER,BVH_SCRATCH_WORDS,packBvhState,unpackBvhState}from'../src/resident-candidate/bvh.mjs';
import{sourceNumberReference as N,numberWords}from'../src/resident-candidate/source-number.mjs';
import{generateProfiledNumericWGSL,NUMERIC_PROFILE as P}from'../src/resident-candidate/numeric-profile.mjs';
import{linkResidentWGSL}from'../src/resident-candidate/wgsl-linker.mjs';
import Source from'../src/experimental-ccd-bvh-state.js';import Graph from'../src/experimental-arithmetic-graph.js';
const one=new Uint32Array(1),float=new Float32Array(one.buffer),bits=x=>(float[0]=x,one[0]),real=w=>(one[0]=w,float[0]),raw=x=>Uint32Array.from(x,bits);
function fn(code,name){const start=code.indexOf('fn '+name+'('),open=code.indexOf('{',start);assert.ok(start>=0);let n=1,end=open+1;for(;n;end++){if(code[end]==='{')n++;else if(code[end]==='}')n--;}return code.slice(start,end);}
const eq=(a,b)=>(a>>>0)===(b>>>0)||((a|b)&0x7fffffff)===0,lt=(a,b)=>{a>>>=0;b>>>=0;return eq(a,b)?false:(a>>>31)!==(b>>>31)?!!(a>>>31):(a>>>31)?a>b:a<b;};
function helpers(){const source=generateBvhIntegerWGSL(),names=['min','max','hit','contains','valid_box','le','uint_word','bin_word','fail','sub','add','mul','div','count','volume','score','merge','zero'],state=new Uint32Array(64);let code=names.map(n=>fn(source,'rc_ibvh_'+n)).join('\n');
 code=code.replace(/fn (\w+)\(([^)]*)\)->(?:u32|bool|RcBvhWordNode)\s*\{/g,(_,name,args)=>`function ${name}(${args.replace(/:(?:vec3<u32>|RcBvhWordNode|u32)/g,'')}){`).replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let').replace(/vec3<u32>\(/g,'vector(');
 const vector=(...x)=>{const v=x.length===1?[x[0],x[0],x[0]]:x;Object.defineProperties(v,{x:{get:()=>v[0]},y:{get:()=>v[1]},z:{get:()=>v[2]}});return v;},node=(lo,hi,data,child)=>({lo:vector(...lo),hi:vector(...hi),data:data>>>0,child});
 const soft=(op,a,b)=>N.toF32(N[{1:'add',2:'sub',3:'mul',4:'div'}[op]](N.fromF32(a),N.fromF32(b)));
 const run=new Function('rc_state','rc_num_eq_bits','rc_num_lt_bits','rc_num_soft_arithmetic','rc_f64_to_f32_bits','rc_f64_from_u32','select','RcBvhWordNode','vector',code+'\nreturn {'+names.map(n=>n+':rc_ibvh_'+n).join(',')+'};')(state,eq,lt,soft,N.toF32,x=>numberWords(x>>>0),(a,b,c)=>c?b:a,node,vector);
 return{...run,node,vector,state};
}
const H=helpers(),edge=[0,0x80000000,1,2,3,0x80000001,0x7fffff,0x800000,0x3f000000,0x3f800000,0x3f800001,0xbf800000,0x40dfffff,0x40e00000,0x40e00001,0x447a0000,0xc47a0000,0x447a0001,0x7f7fffff,0xff7fffff];
test('actual emitted BVH integer primitives retain source rounding, signed zero and strict comparator ties',()=>{
 for(const a of edge)for(const b of edge){assert.equal(H.min(a,b)>>>0,bits(Math.min(real(a),real(b))));assert.equal(H.max(a,b)>>>0,bits(Math.max(real(a),real(b))));assert.equal(H.le(a,b),real(a)<=real(b));for(const[op,calc]of[['add',(a,b)=>a+b],['sub',(a,b)=>a-b],['mul',(a,b)=>a*b],['div',(a,b)=>a/b]]){if(op==='div'&&(b&0x7fffffff)===0)continue;H.state.fill(0);const actual=H[op](0,a,b)>>>0,expected=bits(calc(real(a),real(b)));assert.equal(actual,expected,op);assert.equal(H.state[24],expected,'explicit source rounding store');if(op==='div'&&(expected&0x7f800000)===0x7f800000)assert.equal(H.state[18],2);}}
 for(const n of[0,1,2,27,32,16777215,16777216,16777217,0xffffffff])assert.equal(H.uint_word(n)>>>0,bits(n));
 let seed=0x123bcdae;for(let i=0;i<10000;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const w=seed>>>0;if((w&0x7f800000)===0x7f800000)continue;assert.equal(H.bin_word(w),Math.min(7,Math.max(0,Math.trunc(real(w)))),'source clamped bin conversion');}
});
test('actual emitted word AABB predicates and merge match source for subnormal/signed-zero boundaries',()=>{
 const boxes=[];for(const w of edge){const x=real(w),lo=Math.min(x,0),hi=Math.max(x,0);boxes.push(H.node(raw([lo,-0,-1]),raw([hi,0,1]),1,boxes.length));}
 for(const a of boxes){const lo=Array.from(a.lo,real),hi=Array.from(a.hi,real),valid=[...lo,...hi].every(x=>Number.isFinite(x)&&Math.abs(x)<=1000)&&lo.every((x,i)=>x<=hi[i]);assert.equal(H.valid_box(a.lo,a.hi),valid);for(const b of boxes){assert.equal(H.hit(a,b),a.lo.every((x,i)=>real(x)<=real(b.hi[i])&&real(a.hi[i])>=real(b.lo[i])));assert.equal(H.contains(a,b),a.lo.every((x,i)=>real(x)<=real(b.lo[i])&&real(a.hi[i])>=real(b.hi[i])));const m=H.merge(a,b,17);assert.deepEqual(Uint32Array.from(m.lo),raw(a.lo.map((x,i)=>Math.min(real(x),real(b.lo[i])))));assert.deepEqual(Uint32Array.from(m.hi),raw(a.hi.map((x,i)=>Math.max(real(x),real(b.hi[i])))));assert.equal(m.child,17);}}
 for(const bad of[0x7f800000,0xff800000,0x7fc00000,0xffc00000])assert.equal(H.valid_box(H.vector(bad,0,0),H.vector(bad,0,0)),false);
 const tiny=H.node(raw([real(1),0,0]),raw([real(2),0,0]),1,0),zero=H.zero();assert.equal(H.hit(tiny,zero),false,'positive subnormal gap cannot flush to overlap');
});
test('source BVH arithmetic plans retain every rounded volume/score/center/scale/bin operation',()=>{
 const graph=(name,x)=>Graph.execute(Float32Array.from(x),Source.PLANS[name]);let seed=0xcafebabe,random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/2**32;};
 for(let i=0;i<500;i++){const alo=Array.from({length:3},()=>Math.fround(random()*10-5)),ahi=alo.map(x=>Math.fround(x+random())),blo=alo.map(x=>Math.fround(x+random())),bhi=blo.map(x=>Math.fround(x+random())),ac=1+i%27,bc=1+(i*7)%27,a=H.node(raw(alo),raw(ahi),ac,0),b=H.node(raw(blo),raw(bhi),bc,0);assert.equal(H.score(0,a,b)>>>0,bits(graph('score',[...alo,...ahi,ac,...blo,...bhi,bc])[0]));
  const center=alo.map((x,k)=>H.mul(0,H.add(0,bits(x),bits(ahi[k])),0x3f000000)>>>0);assert.deepEqual(Uint32Array.from(center),raw(graph('center',[...alo,...ahi])));const lo=Math.min(...Array.from(center,real)),hi=Math.max(...Array.from(center,real));if(hi!==lo){const numerator=H.mul(0,0x41000000,H.sub(0,0x3f800000,0x3727c5ac)),scale=H.div(0,numerator,H.sub(0,bits(hi),bits(lo)));assert.equal(scale>>>0,bits(graph('scale',[lo,hi])[0]));for(const c of center)assert.equal(H.mul(0,scale,H.sub(0,c,bits(lo)))>>>0,bits(graph('bin',[real(scale),real(c),lo])[0]));}
 }
});
test('integer BVH is opt-in word API, preserves all source controller functions, rejects mixed profile linkage',()=>{
 const code=generateBvhIntegerWGSL(),clean=code.replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');assert.doesNotMatch(clean,/\bf32\b|\bf16\b|\bbitcast\b|\d+\.\d+/);assert.match(code,/RcBvhWordNode \{ lo:vec3<u32>, hi:vec3<u32>/);for(const[,name]of generateBvhWGSL().matchAll(/\bfn rc_bvh_(\w+)\(/g))assert.match(code,new RegExp('fn rc_ibvh_'+name+'\\('));
 const main='@compute @workgroup_size(1) fn main(){rc_ibvh_query(0u,vec3<u32>(0u),vec3<u32>(0u),0u);}';assert.doesNotThrow(()=>linkResidentWGSL([code,generateProfiledNumericWGSL(P.INTEGER_F32),main]));assert.throws(()=>linkResidentWGSL([code,generateProfiledNumericWGSL(P.PRESERVED_F32),main]),/Conflicting WGSL declaration/);assert.equal(BVH_INTEGER_CAPABILITY.nativeQualified,false);assert.equal(BVH_INTEGER_CAPABILITY.baselineChanged,false);assert.equal(BVH_INTEGER_CAPABILITY.otherGeometryQualified,false);
});

// Unchanged full source recurrence fixture from resident-candidate-bvh.mjs.
// Only native numerical implementation and word-boundary call signatures differ.
const f=Math.fround;
function bounds(id,offset=0,flat=false){const x=f(flat?0:id%5*.25+offset),y=f(flat?0:Math.floor(id/5)*.13);return{min:[x,y,f(-.02)],max:[f(x+.1),f(y+.08),f(.02)]};}
function tree(){const nodes=[],parents=[],map=[];function walk(ids,parent){const w=nodes.length;nodes.push({});parents.push(parent);const mid=Math.floor(ids.length/2);for(const [side,list]of[[0,ids.slice(0,mid)],[1,ids.slice(mid)]]){let node;if(list.length===1){const id=list[0],q=bounds(id);node={mins:q.min,maxs:q.max,data:1,children:id};map[id]=w*2+side;}else{const child=walk(list,w*2+side),n=nodes[child];node={mins:n.left.mins.map((x,i)=>Math.min(x,n.right.mins[i])),maxs:n.left.maxs.map((x,i)=>Math.max(x,n.right.maxs[i])),data:list.length,children:child};}nodes[w][side?'right':'left']=node;}return w;}walk(Array.from({length:22},(_,i)=>i),0);return{nodes,parents,leaf_node_indices:{n:22,v:map},free_wide_nodes:[],optimization:{rebuild_frame_index:0,rebuild_start_index:0}};}
function seed(){return{sourceRevision:Source.SOURCE_REVISION,sourcePipelineCompleted:true,initialSnapshotSha256:'1'.repeat(64),modifiedColliders:[22,23,24].map(index=>({index,generation:0})),initialBroadPhase:{tree:tree(),frame_index:72,changes_since_optimize:0,reinsert_leaf_updates:true,optimization_strategy:'SubtreeOptimizer',adaptive_change_detection_margin:false,pending_set_aabb:[],prev_updated_leaves:[]}};}
const ownership=firstUpdate=>({generations:Array(25).fill(0),removableLeaves:[22,23,24],freshOrder:[22,23,24],firstUpdate,initialLeaves:22,minimumLeaves:22,maximumLeaves:25});
const rows=(ids,off=0,flat=false)=>ids.map(leaf=>({leaf,box:bounds(leaf,off,flat),skin:f(.04)}));
function exact(a,b){assert.deepEqual(a,b);}
async function fresh(s){s.begin();await s.prepareUpdate({updates:rows([22,23,24])});await s.joinDeferredOptimize();s.commit();}

test('actual native integer BVH preserves full original recurrence and source query order',{timeout:180000},async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('explicit globally serialized GPU slot required');
 const {createNativeOwner,dispatchWords}=await import('./resident-candidate-gpu-support.mjs');
 const owner=await createNativeOwner('resident-integer-bvh-recurrence'),s=await Source.createReferenceStage(seed());
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
  const code=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;\n${generateBvhIntegerWGSL()}\n@compute @workgroup_size(1) fn main(){
    if(rc_ibvh_set_scratch(0u,${scratchAt}u)!=0u){return;}
    for(var cmd=0u;cmd<${commands.length}u;cmd++){let p=${commandBase}u+cmd*${commandStride}u;let op=rc_state[p];
      if(op==0u){rc_ibvh_prepare_update(0u,rc_state[p+1u],rc_state[p+2u],rc_state[p+3u],rc_state[p+4u],rc_state[p+5u],rc_state[p+6u],rc_state[p+7u],rc_state[p+8u],rc_state[p+9u]);}
      else if(op==1u){rc_ibvh_join(0u);}
      else if(op==2u){rc_ibvh_set_aabbs(0u,rc_state[p+1u],rc_state[p+2u],rc_state[p+3u]);}
      else if(op==3u){for(var j=0u;j<${BVH_LAYOUT.words}u;j++){rc_state[rc_state[p+1u]+j]=rc_state[j];}}
      else if(op==4u){let q=rc_state[p+1u];let out=rc_state[p+2u];rc_state[out]=rc_ibvh_query(0u,vec3<u32>(rc_state[q],rc_state[q+1u],rc_state[q+2u]),vec3<u32>(rc_state[q+3u],rc_state[q+4u],rc_state[q+5u]),out+1u);}
      else if(op==5u){let out=rc_state[p+1u];rc_state[out]=rc_ibvh_bvtt(0u,out+1u,351u);}
      if(rc_state[18u]!=0u){rc_state[19u]=cmd;return;}
    }
  }`;
  const [actual]=await dispatchWords(owner,{code,buffers:[{input:Uint32Array.from(words),readback:true}],label:'resident-integer-bvh-complete-source-recurrence'});
  assert.equal(actual[BVH_HEADER.error],0,'resident draft failed at command '+actual[19]);
  for(let i=0;i<expected.length;i++)exact(unpackBvhState(actual.slice(checkpointPointers[i],checkpointPointers[i]+BVH_LAYOUT.words)),expected[i]);
  const queryExpected=s.queryLeaves(q);exact(Array.from(actual.slice(queryAt+1,queryAt+1+actual[queryAt])),queryExpected);
  const First=require('../src/experimental-cue-bvh-insertion.js'),pairs=First.sourceTreeCandidates(s.snapshot().tree).candidates;
  assert.equal(actual[pairAt],pairs.length);exact(Array.from({length:pairs.length},(_,i)=>Array.from(actual.slice(pairAt+1+i*2,pairAt+3+i*2))),pairs);
  console.log(JSON.stringify({scope:'resident-integer-bvh-component-not-full-world',integerOnly:true,hardwarePerformance:false,checkpoints:expected.length,commands:commands.length,singleDispatch:true,hostStateContinuation:false,adapter:owner.adapterInfo}));
 }finally{s.abort();s.dispose();owner.release();}
});
