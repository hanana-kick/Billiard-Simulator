/* SPDX-License-Identifier: Apache-2.0
 * Resident packing and device traversal/mutation of the existing source BVH.
 * Source: Parry 0.31.1; Rapier b716d375efc0201003f0cd9ef7168eee0b62c177.
 * The original source owner is the independent validation oracle. Host helpers
 * here are import/export and test diagnostics, never a forward CPU fallback.
 */
import '../experimental-ccd-bvh-state.js';
const Source = globalThis.LabCcdBvhStateExperimental;
const U = 0xffffffff;
export const BVH_LAYOUT = Object.freeze({
  version:1, maxLeaves:27, maxWide:96, maxPending:256,
  header:0, headerWords:32, nodes:32, nodeWords:8,
  parents:1568, free:1664, leaves:1760, generations:1787,
  previous:1814, pending:1841, fresh:2097, removable:2124,
  words:2180,
});
export const BVH_SCRATCH_WORDS = 4096;
// Disjoint spans preserve outer-function live values across nested device calls.
// No candidate-sized private arrays: software Vulkan backends also impose stack
// limits, independently of the WebGPU storage-buffer limits.
export const BVH_SCRATCH_LAYOUT = Object.freeze(Object.fromEntries([
 ['query',0,54],['bvttKinds',54,128],['bvttA',182,128],['bvttB',310,128],
 ['refitSource',438,1536],['refitParents',1974,96],['refitMapping',2070,96],
 ['refitOrder',2166,96],['refitStack',2262,96],['optimizerRoots',2358,27],
 ['optimizerStack',2385,54],['optimizerOffsets',2439,54],['optimizerPseudo',2493,216],
 ['optimizerQueue',2709,54],['optimizerHeapIds',2763,27],['optimizerHeapScores',2790,27],
 ['collectStack',2817,54],['collectedLeaves',2871,216],['rebuildLeaves',3087,216],
 ['rebuildStarts',3303,27],['rebuildLengths',3330,27],['rebuildTargets',3357,27],
 ['rebuildPhases',3384,27],['rebuildMids',3411,27],['rebuildChildren',3438,27],
 ['rebuildCenters',3465,81],['rebuildBinIds',3546,27],['rebuildBins',3573,64],
 ['rebuildCounts',3637,8],['rebuildPrefix',3645,64],['rebuildSuffix',3709,64],
 ['rebuildPrefixCounts',3773,8],['rebuildSuffixCounts',3781,8],['updateUsed',3789,27],
 ['updateForced',3816,27],['updateLive',3843,27],['updateCurrent',3870,27],
 ['updateMissing',3897,27],['setAabbsSeen',3924,27],
].map(([name,offset,words])=>[name,Object.freeze({offset,words})])));
export const BVH_HEADER = Object.freeze({nodes:0,leaves:1,mapLength:2,free:3,
  optimizerFrame:4,optimizerStart:5,frame:6,changes:7,reinsert:8,
  previous:9,pending:10,deferred:11,first:12,minimum:13,maximum:14,
  initial:15,fresh:16,removable:17,error:18,scratch:20});
export const BVH_STATUS = Object.freeze({ok:0,overflow:1,malformed:2,unsupported:3});
export const BVH_CAPABILITY = Object.freeze({sourceRevision:Source.SOURCE_REVISION,
  hostForwardFallback:false,packedState:true,orderedQuery:true,orderedBvtt:true,
  deviceRemove:true,deviceInsertion:true,deviceFullRefit:true,devicePartialRefit:true,
  deviceLeafUpdate:true,deviceOptimizer:true,deviceLifecycle:true,
  numericParity:'requires-independent-native-gpu-gate'});
const need=(x,m)=>{if(!x)throw new RangeError('Resident BVH: '+m);};
const uint=x=>Number.isInteger(x)&&x>=0&&x<=U;
const bitsBuffer=new ArrayBuffer(4),bitsF=new Float32Array(bitsBuffer),bitsU=new Uint32Array(bitsBuffer);
const bits=x=>{bitsF[0]=x;return bitsU[0];};
const real=x=>{bitsU[0]=x;return bitsF[0];};
function arrayIds(a,max,label,duplicate=false){need(Array.isArray(a)&&a.length<=max&&a.every(x=>uint(x)&&x<27)&&(duplicate||new Set(a).size===a.length),label);return a;}
function validateOwnership(c,s){
  need(c&&Object.keys(c).every(k=>['generations','removableLeaves','freshOrder','firstUpdate','initialLeaves','minimumLeaves','maximumLeaves'].includes(k)),'explicit ownership config required');
  need(Array.isArray(c.generations)&&c.generations.length<=27&&c.generations.every(x=>x===null||uint(x)),'bounded generation roster required');
  arrayIds(c.removableLeaves,27,'removable leaf roster');arrayIds(c.freshOrder,27,'fresh queue');
  need(typeof c.firstUpdate==='boolean','explicit first-update phase required');
  for(const k of ['initialLeaves','minimumLeaves','maximumLeaves'])need(Number.isInteger(c[k])&&c[k]>=22&&c[k]<=27,k);
  need(c.minimumLeaves<=c.initialLeaves&&c.initialLeaves<=c.maximumLeaves,'ordered leaf capacities');
  need(s.tree.leaf_node_indices.n>=c.minimumLeaves&&s.tree.leaf_node_indices.n<=c.maximumLeaves,'leaf count outside ownership');
  need(c.generations.filter(x=>x!==null).length===c.maximumLeaves,'complete generation roster');
  for(let id=0;id<s.tree.leaf_node_indices.v.length;id++)if(s.tree.leaf_node_indices.v[id]!==null)need(c.generations[id]!==null&&c.generations[id]!==undefined,'current leaf lacks generation');
  for(const id of [...c.freshOrder,...c.removableLeaves])need(c.generations[id]!==null&&c.generations[id]!==undefined,'unknown owned leaf');
}
/** Initial import only. Native future trees must never be used to continue a GPU world. */
export function packBvhState(snapshot,ownership){
  const s=structuredClone(snapshot);Source.validateTree(s.tree);validateOwnership(ownership,s);
  need(s.optimization_strategy==='SubtreeOptimizer'&&s.adaptive_change_detection_margin===false,'unchanged source optimizer required');
  need(uint(s.frame_index)&&uint(s.changes_since_optimize),'source scheduler counters');
  need(typeof s.reinsert_leaf_updates==='boolean'&&typeof s.deferred_optimize_pending==='boolean','source scheduler flags');
  arrayIds(s.prev_updated_leaves,27,'previous update queue',true);
  need(Array.isArray(s.pending_set_aabb)&&s.pending_set_aabb.length<=BVH_LAYOUT.maxPending,'pending capacity');
  const pending=s.pending_set_aabb.map(h=>{need(h&&uint(h.index)&&h.index<27&&h.generation===ownership.generations[h.index],'pending generation identity');return h.index;});
  const out=new Uint32Array(BVH_LAYOUT.words),H=BVH_HEADER,L=BVH_LAYOUT,t=s.tree;
  Object.entries({nodes:t.nodes.length,leaves:t.leaf_node_indices.n,mapLength:t.leaf_node_indices.v.length,free:t.free_wide_nodes.length,optimizerFrame:t.optimization.rebuild_frame_index,optimizerStart:t.optimization.rebuild_start_index,frame:s.frame_index,changes:s.changes_since_optimize,reinsert:+s.reinsert_leaf_updates,previous:s.prev_updated_leaves.length,pending:pending.length,deferred:+s.deferred_optimize_pending,first:+ownership.firstUpdate,minimum:ownership.minimumLeaves,maximum:ownership.maximumLeaves,initial:ownership.initialLeaves,fresh:ownership.freshOrder.length,removable:ownership.removableLeaves.length}).forEach(([k,v])=>out[H[k]]=v);
  t.nodes.forEach((w,i)=>[w.left,w.right].forEach((n,side)=>{const p=L.nodes+(2*i+side)*8;out.set([...n.mins.map(bits),...n.maxs.map(bits),n.data,n.children],p);}));
  out.set(t.parents,L.parents);out.set(t.free_wide_nodes,L.free);out.fill(U,L.leaves,L.leaves+27);t.leaf_node_indices.v.forEach((v,i)=>out[L.leaves+i]=v??U);
  out.fill(U,L.generations,L.generations+27);ownership.generations.forEach((v,i)=>out[L.generations+i]=v??U);
  out.set(s.prev_updated_leaves,L.previous);out.set(pending,L.pending);out.set(ownership.freshOrder,L.fresh);out.set(ownership.removableLeaves,L.removable);
  return out;
}
export function unpackBvhState(input){
  need(input instanceof Uint32Array&&input.length===BVH_LAYOUT.words,'exact packed state span');
  const a=input,L=BVH_LAYOUT,H=BVH_HEADER;need(a[H.error]===0,'device state has terminal error '+a[H.error]);
  need(a[H.nodes]>0&&a[H.nodes]<=96&&a[H.mapLength]<=27&&a[H.free]<=96&&a[H.previous]<=27&&a[H.pending]<=256,'packed lengths');
  const node=p=>({mins:Array.from(a.subarray(p,p+3),real),maxs:Array.from(a.subarray(p+3,p+6),real),data:a[p+6],children:a[p+7]});
  const tree={nodes:Array.from({length:a[H.nodes]},(_,i)=>({left:node(L.nodes+i*16),right:node(L.nodes+i*16+8)})),parents:Array.from(a.subarray(L.parents,L.parents+a[H.nodes])),leaf_node_indices:{n:a[H.leaves],v:Array.from(a.subarray(L.leaves,L.leaves+a[H.mapLength]),x=>x===U?null:x)},free_wide_nodes:Array.from(a.subarray(L.free,L.free+a[H.free])),optimization:{rebuild_frame_index:a[H.optimizerFrame],rebuild_start_index:a[H.optimizerStart]}};
  Source.validateTree(tree);
  return{tree,frame_index:a[H.frame],changes_since_optimize:a[H.changes],reinsert_leaf_updates:!!a[H.reinsert],prev_updated_leaves:Array.from(a.subarray(L.previous,L.previous+a[H.previous])),pending_set_aabb:Array.from(a.subarray(L.pending,L.pending+a[H.pending]),index=>({index,generation:a[L.generations+index]})),deferred_optimize_pending:!!a[H.deferred],optimization_strategy:'SubtreeOptimizer',adaptive_change_detection_margin:false};
}
/** Diagnostic only; the runtime must call rc_bvh_query on resident state. */
export function queryPackedBvhForTest(input,aabb){
 const s=unpackBvhState(input);need(!input[BVH_HEADER.first]&&!s.deferred_optimize_pending,'created joined BVH query boundary');
 need(aabb&&[aabb.min,aabb.max].every(a=>Array.isArray(a)&&a.length===3&&a.every(x=>Number.isFinite(x)&&x===Math.fround(x)&&Math.abs(x)<=1000))&&aabb.min.every((x,i)=>x<=aabb.max[i]),'exact query bounds');
 const hit=n=>n.mins.every((x,i)=>x<=aabb.max[i]&&n.maxs[i]>=aabb.min[i]);
 const result=[],stack=[],root=s.tree.nodes[0];let next=null;if(hit(root.left))next=root.left;if(hit(root.right))stack.push(root.right);
 while(next||stack.length){const n=next||stack.pop();next=null;if((n.data&0x3fffffff)===1){result.push(n.children);continue;}const w=s.tree.nodes[n.children];if(hit(w.left))next=w.left;if(hit(w.right)){if(next)stack.push(w.right);else next=w.right;}}
 return result;
}

/** No bindings or entry point. Caller declares `var<storage,read_write> rc_state:array<u32>`.
 * Query and BVTT results are written to an explicit caller-owned output span in
 * rc_state; no atomic append or global scheduling changes candidate-local order.
 * Caller must first call rc_bvh_set_scratch(base, absoluteScratchBase); scratch
 * is BVH_SCRATCH_WORDS u32 words and must not overlap persistent state.
 * Every error is sticky in the draft's error word; the owner must abort the h.
 */
export function generateBvhWGSL(){return `
const RC_BVH_NODES:u32=32u;
const RC_BVH_PARENTS:u32=1568u;
const RC_BVH_FREE:u32=1664u;
const RC_BVH_LEAVES:u32=1760u;
const RC_BVH_NULL:u32=0xffffffffu;
struct RcBvhNode { lo:vec3<f32>, hi:vec3<f32>, data:u32, child:u32 }
fn rc_bvh_s(b:u32,offset:u32)->u32{return rc_state[b+20u]+offset;}
fn rc_bvh_set_scratch(b:u32,s:u32)->u32{if(s>arrayLength(&rc_state)||arrayLength(&rc_state)-s<4096u||(s<b+2180u&&s+4096u>b)){return rc_bvh_fail(b,1u);}rc_state[b+20u]=s;return 0u;}
fn rc_bvh_mem_node(a:u32)->RcBvhNode{return RcBvhNode(vec3<f32>(bitcast<f32>(rc_state[a]),bitcast<f32>(rc_state[a+1u]),bitcast<f32>(rc_state[a+2u])),vec3<f32>(bitcast<f32>(rc_state[a+3u]),bitcast<f32>(rc_state[a+4u]),bitcast<f32>(rc_state[a+5u])),rc_state[a+6u],rc_state[a+7u]);}
fn rc_bvh_mem_put(a:u32,n:RcBvhNode){for(var i=0u;i<3u;i++){rc_state[a+i]=bitcast<u32>(n.lo[i]);rc_state[a+3u+i]=bitcast<u32>(n.hi[i]);}rc_state[a+6u]=n.data;rc_state[a+7u]=n.child;}
fn rc_bvh_fail(b:u32,e:u32)->u32 { if(rc_state[b+18u]==0u){rc_state[b+18u]=e;} return e; }
fn rc_bvh_node(b:u32,p:u32)->RcBvhNode { let a=b+RC_BVH_NODES+p*8u;return RcBvhNode(vec3<f32>(bitcast<f32>(rc_state[a]),bitcast<f32>(rc_state[a+1u]),bitcast<f32>(rc_state[a+2u])),vec3<f32>(bitcast<f32>(rc_state[a+3u]),bitcast<f32>(rc_state[a+4u]),bitcast<f32>(rc_state[a+5u])),rc_state[a+6u],rc_state[a+7u]); }
fn rc_bvh_put(b:u32,p:u32,n:RcBvhNode){let a=b+RC_BVH_NODES+p*8u;for(var i=0u;i<3u;i++){rc_state[a+i]=bitcast<u32>(n.lo[i]);rc_state[a+3u+i]=bitcast<u32>(n.hi[i]);}rc_state[a+6u]=n.data;rc_state[a+7u]=n.child;}
fn rc_bvh_count(n:RcBvhNode)->u32{return n.data&0x3fffffffu;}
fn rc_bvh_leaf(n:RcBvhNode)->bool{return rc_bvh_count(n)==1u;}
fn rc_bvh_changed(n:RcBvhNode)->bool{return (n.data>>30u)==1u;}
fn rc_bvh_pending(n:RcBvhNode)->bool{return (n.data>>30u)==3u;}
fn rc_bvh_min(a:f32,c:f32)->f32{if(a==0.0&&c==0.0){return bitcast<f32>(bitcast<u32>(a)|bitcast<u32>(c));}return select(c,a,a<c);}
fn rc_bvh_max(a:f32,c:f32)->f32{if(a==0.0&&c==0.0){return bitcast<f32>(bitcast<u32>(a)&bitcast<u32>(c));}return select(c,a,a>c);}
fn rc_bvh_merge(a:RcBvhNode,c:RcBvhNode,child:u32)->RcBvhNode{var n=RcBvhNode(vec3<f32>(0.0),vec3<f32>(0.0),(rc_bvh_count(a)+rc_bvh_count(c))|(((a.data>>30u)|(c.data>>30u))<<30u),child);for(var i=0u;i<3u;i++){n.lo[i]=rc_bvh_min(a.lo[i],c.lo[i]);n.hi[i]=rc_bvh_max(a.hi[i],c.hi[i]);}return n;}
fn rc_bvh_resolve(n:RcBvhNode)->RcBvhNode{var r=n;r.data=rc_bvh_count(n)|select(0u,0x40000000u,rc_bvh_pending(n));return r;}
fn rc_bvh_zero()->RcBvhNode{return RcBvhNode(vec3<f32>(0.0),vec3<f32>(0.0),0u,0u);}
fn rc_bvh_hit(a:RcBvhNode,c:RcBvhNode)->bool{return all(a.lo<=c.hi)&&all(a.hi>=c.lo);}
fn rc_bvh_contains(a:RcBvhNode,c:RcBvhNode)->bool{return all(a.lo<=c.lo)&&all(a.hi>=c.hi);}
fn rc_bvh_valid_box(lo:vec3<f32>,hi:vec3<f32>)->bool{return all(lo<=hi)&&all(abs(lo)<=vec3<f32>(1000.0))&&all(abs(hi)<=vec3<f32>(1000.0));}
fn rc_bvh_relocate(b:u32,n:RcBvhNode,p:u32){if(rc_bvh_leaf(n)){rc_state[b+RC_BVH_LEAVES+n.child]=p;}else{rc_state[b+RC_BVH_PARENTS+n.child]=p;}}
// Result: count, or 0xffffffff on draft failure. Caller supplies 27 words.
fn rc_bvh_query(b:u32,lo:vec3<f32>,hi:vec3<f32>,out:u32)->u32{
 if(rc_state[b+18u]!=0u){return RC_BVH_NULL;}if(rc_state[b+12u]!=0u||rc_state[b+11u]!=0u){rc_bvh_fail(b,3u);return RC_BVH_NULL;}
 if(!rc_bvh_valid_box(lo,hi)){rc_bvh_fail(b,2u);return RC_BVH_NULL;}
 let q=RcBvhNode(lo,hi,0u,0u);var top=0u;var next=RC_BVH_NULL;var total=0u;var visits=0u;
 if(rc_bvh_hit(rc_bvh_node(b,0u),q)){next=0u;}if(rc_bvh_hit(rc_bvh_node(b,1u),q)){rc_state[rc_bvh_s(b,0u)+(top)]=1u;top++;}
 loop{if(next==RC_BVH_NULL&&top==0u){break;}visits++;if(visits>54u){rc_bvh_fail(b,2u);return RC_BVH_NULL;}
 var p=next;if(p==RC_BVH_NULL){top--;p=rc_state[rc_bvh_s(b,0u)+(top)];}next=RC_BVH_NULL;let n=rc_bvh_node(b,p);
 if(rc_bvh_leaf(n)){if(total>=27u){rc_bvh_fail(b,1u);return RC_BVH_NULL;}rc_state[out+total]=n.child;total++;continue;}
 if(n.child>=rc_state[b]){rc_bvh_fail(b,2u);return RC_BVH_NULL;}let l=n.child*2u;let r=l+1u;
 if(rc_bvh_hit(rc_bvh_node(b,l),q)){next=l;}if(rc_bvh_hit(rc_bvh_node(b,r),q)){if(next!=RC_BVH_NULL){if(top>=54u){rc_bvh_fail(b,1u);return RC_BVH_NULL;}rc_state[rc_bvh_s(b,0u)+(top)]=r;top++;}else{next=r;}}
 }return total;
}
// Frame kinds: 0 self(w), 1 dispatch(p,q), 2 cross(w,w), 3 single(p,w).
// Explicit LIFO continuations preserve the source recursive order, including
// single() emitting right leaves before descending an internal left child.
fn rc_bvh_bvtt(b:u32,out:u32,capacity:u32)->u32{
 if(rc_state[b+18u]!=0u){return RC_BVH_NULL;}var top=1u;rc_state[rc_bvh_s(b,54u)+(0)]=0u;rc_state[rc_bvh_s(b,182u)+(0)]=0u;rc_state[rc_bvh_s(b,310u)+(0)]=0u;var total=0u;var visits=0u;
 loop{if(top==0u){break;}visits++;if(visits>4096u){rc_bvh_fail(b,2u);return RC_BVH_NULL;}top--;let k=rc_state[rc_bvh_s(b,54u)+(top)];let a=rc_state[rc_bvh_s(b,182u)+(top)];let c=rc_state[rc_bvh_s(b,310u)+(top)];
 if(k==0u){let l=rc_bvh_node(b,a*2u);let r=rc_bvh_node(b,a*2u+1u);if(!rc_bvh_changed(l)&&!rc_bvh_changed(r)){continue;}if(top+3u>128u){rc_bvh_fail(b,1u);return RC_BVH_NULL;}
 if(rc_bvh_hit(l,r)){rc_state[rc_bvh_s(b,54u)+(top)]=1u;rc_state[rc_bvh_s(b,182u)+(top)]=a*2u;rc_state[rc_bvh_s(b,310u)+(top)]=a*2u+1u;top++;}if(rc_bvh_changed(r)&&!rc_bvh_leaf(r)){rc_state[rc_bvh_s(b,54u)+(top)]=0u;rc_state[rc_bvh_s(b,182u)+(top)]=r.child;top++;}if(rc_bvh_changed(l)&&!rc_bvh_leaf(l)){rc_state[rc_bvh_s(b,54u)+(top)]=0u;rc_state[rc_bvh_s(b,182u)+(top)]=l.child;top++;}
 }else if(k==1u){let l=rc_bvh_node(b,a);let r=rc_bvh_node(b,c);if(rc_bvh_leaf(l)&&rc_bvh_leaf(r)){if(total>=capacity||l.child==r.child){rc_bvh_fail(b,1u);return RC_BVH_NULL;}rc_state[out+2u*total]=l.child;rc_state[out+2u*total+1u]=r.child;total++;}else{if(top>=128u){rc_bvh_fail(b,1u);return RC_BVH_NULL;}if(rc_bvh_leaf(l)){rc_state[rc_bvh_s(b,54u)+(top)]=3u;rc_state[rc_bvh_s(b,182u)+(top)]=a;rc_state[rc_bvh_s(b,310u)+(top)]=r.child;}else if(rc_bvh_leaf(r)){rc_state[rc_bvh_s(b,54u)+(top)]=3u;rc_state[rc_bvh_s(b,182u)+(top)]=c;rc_state[rc_bvh_s(b,310u)+(top)]=l.child;}else{rc_state[rc_bvh_s(b,54u)+(top)]=2u;rc_state[rc_bvh_s(b,182u)+(top)]=l.child;rc_state[rc_bvh_s(b,310u)+(top)]=r.child;}top++;}
 }else if(k==2u){if(top+4u>128u){rc_bvh_fail(b,1u);return RC_BVH_NULL;}for(var j=4u;j>0u;j--){let z=j-1u;let p=a*2u+z/2u;let q=c*2u+z%2u;let l=rc_bvh_node(b,p);let r=rc_bvh_node(b,q);if((rc_bvh_changed(l)||rc_bvh_changed(r))&&rc_bvh_hit(l,r)){rc_state[rc_bvh_s(b,54u)+(top)]=1u;rc_state[rc_bvh_s(b,182u)+(top)]=p;rc_state[rc_bvh_s(b,310u)+(top)]=q;top++;}}
 }else{let n=rc_bvh_node(b,a);let l=rc_bvh_node(b,c*2u);let r=rc_bvh_node(b,c*2u+1u);let lh=(rc_bvh_changed(n)||rc_bvh_changed(l))&&rc_bvh_hit(n,l);let rh=(rc_bvh_changed(n)||rc_bvh_changed(r))&&rc_bvh_hit(n,r);
 if(lh&&rc_bvh_leaf(l)){if(total>=capacity){rc_bvh_fail(b,1u);return RC_BVH_NULL;}rc_state[out+2u*total]=n.child;rc_state[out+2u*total+1u]=l.child;total++;}if(rh&&rc_bvh_leaf(r)){if(total>=capacity){rc_bvh_fail(b,1u);return RC_BVH_NULL;}rc_state[out+2u*total]=n.child;rc_state[out+2u*total+1u]=r.child;total++;}
 if(top+2u>128u){rc_bvh_fail(b,1u);return RC_BVH_NULL;}if(rh&&!rc_bvh_leaf(r)){rc_state[rc_bvh_s(b,54u)+(top)]=3u;rc_state[rc_bvh_s(b,182u)+(top)]=a;rc_state[rc_bvh_s(b,310u)+(top)]=r.child;top++;}if(lh&&!rc_bvh_leaf(l)){rc_state[rc_bvh_s(b,54u)+(top)]=3u;rc_state[rc_bvh_s(b,182u)+(top)]=a;rc_state[rc_bvh_s(b,310u)+(top)]=l.child;top++;}
 }
 }return total;
}
fn rc_bvh_remove(b:u32,id:u32)->u32{
 if(id>=27u){return rc_bvh_fail(b,2u);}let p=rc_state[b+RC_BVH_LEAVES+id];if(p==RC_BVH_NULL){return 0u;}if(rc_state[b+3u]>=96u){return rc_bvh_fail(b,1u);}
 rc_state[b+RC_BVH_LEAVES+id]=RC_BVH_NULL;rc_state[b+1u]--;let w=p/2u;let sibling=rc_bvh_node(b,p^1u);
 if(w==0u){if(rc_bvh_leaf(sibling)){return rc_bvh_fail(b,3u);}let old=sibling.child;let l=rc_bvh_node(b,old*2u);let r=rc_bvh_node(b,old*2u+1u);rc_bvh_put(b,0u,l);rc_bvh_put(b,1u,r);rc_bvh_put(b,old*2u,rc_bvh_zero());rc_bvh_put(b,old*2u+1u,rc_bvh_zero());rc_state[b+RC_BVH_FREE+rc_state[b+3u]]=old;rc_state[b+3u]++;rc_bvh_relocate(b,l,0u);rc_bvh_relocate(b,r,1u);
 }else{let parent=rc_state[b+RC_BVH_PARENTS+w];rc_bvh_relocate(b,sibling,parent);rc_bvh_put(b,parent,sibling);rc_bvh_put(b,w*2u,rc_bvh_zero());rc_bvh_put(b,w*2u+1u,rc_bvh_zero());rc_state[b+RC_BVH_FREE+rc_state[b+3u]]=w;rc_state[b+3u]++;var curr=parent/2u;var depth=0u;loop{if(curr==0u){break;}depth++;if(depth>27u){return rc_bvh_fail(b,2u);}let q=rc_state[b+RC_BVH_PARENTS+curr];rc_bvh_put(b,q,rc_bvh_merge(rc_bvh_node(b,curr*2u),rc_bvh_node(b,curr*2u+1u),curr));curr=q/2u;}}
 return 0u;
}
// Round each source arithmetic operation independently via storage words.
// The dedicated three-word area is in header padding, local to this candidate.
fn rc_bvh_sub(b:u32,a:f32,c:f32)->f32{rc_state[b+24u]=bitcast<u32>(a-c);return bitcast<f32>(rc_state[b+24u]);}
fn rc_bvh_add(b:u32,a:f32,c:f32)->f32{rc_state[b+24u]=bitcast<u32>(a+c);return bitcast<f32>(rc_state[b+24u]);}
fn rc_bvh_mul(b:u32,a:f32,c:f32)->f32{rc_state[b+24u]=bitcast<u32>(a*c);return bitcast<f32>(rc_state[b+24u]);}
fn rc_bvh_volume(b:u32,n:RcBvhNode)->f32{let x=rc_bvh_sub(b,n.hi.x,n.lo.x);let y=rc_bvh_sub(b,n.hi.y,n.lo.y);let z=rc_bvh_sub(b,n.hi.z,n.lo.z);return rc_bvh_mul(b,rc_bvh_mul(b,x,y),z);}
fn rc_bvh_score(b:u32,a:RcBvhNode,c:RcBvhNode)->f32{let x=rc_bvh_mul(b,rc_bvh_volume(b,a),f32(rc_bvh_count(a)));let y=rc_bvh_mul(b,rc_bvh_volume(b,c),f32(rc_bvh_count(c)));return rc_bvh_add(b,x,y);}
fn rc_bvh_rotate(b:u32,w:u32)->u32{
 let l=rc_bvh_node(b,w*2u);let r=rc_bvh_node(b,w*2u+1u);if(rc_bvh_leaf(l)&&rc_bvh_leaf(r)){return 0u;}let original=rc_bvh_score(b,l,r);var d0=bitcast<f32>(0x7f7fffffu);var d1=d0;var up0=false;var up1=false;
 if(!rc_bvh_leaf(l)){let x=rc_bvh_node(b,l.child*2u);let y=rc_bvh_node(b,l.child*2u+1u);let a=rc_bvh_score(b,x,rc_bvh_merge(y,r,0u));let c=rc_bvh_score(b,y,rc_bvh_merge(x,r,0u));up0=a<c;d0=rc_bvh_sub(b,select(c,a,up0),original);}
 if(!rc_bvh_leaf(r)){let x=rc_bvh_node(b,r.child*2u);let y=rc_bvh_node(b,r.child*2u+1u);let a=rc_bvh_score(b,x,rc_bvh_merge(y,l,0u));let c=rc_bvh_score(b,y,rc_bvh_merge(x,l,0u));up1=a<c;d1=rc_bvh_sub(b,select(c,a,up1),original);}
 if(!(d0<0.0||d1<0.0)){return 0u;}if(d0<d1){let id=l.child;rc_state[b+RC_BVH_PARENTS+id]=w*2u+1u;let p=id*2u+select(1u,0u,up0);let lifted=rc_bvh_node(b,p);rc_bvh_put(b,w*2u,lifted);rc_bvh_put(b,p,r);rc_bvh_relocate(b,lifted,w*2u);rc_bvh_relocate(b,r,p);rc_bvh_put(b,w*2u+1u,rc_bvh_merge(rc_bvh_node(b,id*2u),rc_bvh_node(b,id*2u+1u),id));}
 else{let id=r.child;rc_state[b+RC_BVH_PARENTS+id]=w*2u;let p=id*2u+select(1u,0u,up1);let lifted=rc_bvh_node(b,p);rc_bvh_put(b,w*2u+1u,lifted);rc_bvh_put(b,p,l);rc_bvh_relocate(b,lifted,w*2u+1u);rc_bvh_relocate(b,l,p);rc_bvh_put(b,w*2u,rc_bvh_merge(rc_bvh_node(b,id*2u),rc_bvh_node(b,id*2u+1u),id));}return 0u;
}
fn rc_bvh_insert(b:u32,id:u32,lo:vec3<f32>,hi:vec3<f32>)->u32{
 if(id>=27u||rc_state[b+RC_BVH_LEAVES+id]!=RC_BVH_NULL||!rc_bvh_valid_box(lo,hi)){return rc_bvh_fail(b,2u);}if(rc_state[b+1u]>=27u){return rc_bvh_fail(b,1u);}rc_state[b+2u]=max(rc_state[b+2u],id+1u);rc_state[b+RC_BVH_LEAVES+id]=0u;rc_state[b+1u]++;let fresh=RcBvhNode(lo,hi,0xc0000001u,id);var w=0u;var depth=0u;
 loop{depth++;if(depth>27u){return rc_bvh_fail(b,2u);}rc_bvh_rotate(b,w);let l=rc_bvh_node(b,w*2u);let r=rc_bvh_node(b,w*2u+1u);let lc=rc_bvh_count(l);let rc=rc_bvh_count(r);let a=rc_bvh_score(b,rc_bvh_merge(l,fresh,0u),r);let c=rc_bvh_score(b,rc_bvh_merge(r,fresh,0u),l);let left=a<c||(a==c&&lc<rc);let p=w*2u+select(1u,0u,left);let old=rc_bvh_node(b,p);
 if(rc_bvh_leaf(old)){var child=rc_state[b];if(rc_state[b+3u]>0u){rc_state[b+3u]--;child=rc_state[b+RC_BVH_FREE+rc_state[b+3u]];}else{if(child>=96u){return rc_bvh_fail(b,1u);}rc_state[b]++;}rc_state[b+RC_BVH_PARENTS+child]=p;let oldp=child*2u+select(1u,0u,left);let newp=child*2u+select(0u,1u,left);rc_bvh_put(b,oldp,old);rc_bvh_put(b,newp,fresh);rc_state[b+RC_BVH_LEAVES+old.child]=oldp;rc_state[b+RC_BVH_LEAVES+id]=newp;var merged=rc_bvh_merge(old,fresh,child);merged.data=old.data+1u;rc_bvh_put(b,p,merged);return 0u;}
 var merged=rc_bvh_merge(old,fresh,old.child);merged.data=old.data+1u;rc_bvh_put(b,p,merged);w=old.child;
 }
}
fn rc_bvh_full_refit(b:u32,resolveFlags:bool)->u32{
 let oldCount=rc_state[b];if(oldCount==0u||oldCount>96u){return rc_bvh_fail(b,2u);}for(var i=0u;i<oldCount*2u;i++){rc_bvh_mem_put(rc_bvh_s(b,438u)+(i)*8u,rc_bvh_node(b,i));}for(var i=0u;i<96u;i++){rc_state[rc_bvh_s(b,2070u)+(i)]=RC_BVH_NULL;}var top=1u;rc_state[rc_bvh_s(b,2262u)+(0)]=0u;var total=0u;
 loop{if(top==0u){break;}top--;let w=rc_state[rc_bvh_s(b,2262u)+(top)];if(w>=oldCount||rc_state[rc_bvh_s(b,2070u)+(w)]!=RC_BVH_NULL||total>=96u){return rc_bvh_fail(b,2u);}rc_state[rc_bvh_s(b,2070u)+(w)]=total;rc_state[rc_bvh_s(b,2166u)+(total)]=w;total++;let l=rc_bvh_mem_node(rc_bvh_s(b,438u)+(w*2u)*8u);let r=rc_bvh_mem_node(rc_bvh_s(b,438u)+(w*2u+1u)*8u);if(!rc_bvh_leaf(r)){if(top>=96u){return rc_bvh_fail(b,1u);}rc_state[rc_bvh_s(b,2262u)+(top)]=r.child;top++;}if(!rc_bvh_leaf(l)){if(top>=96u){return rc_bvh_fail(b,1u);}rc_state[rc_bvh_s(b,2262u)+(top)]=l.child;top++;}}
 rc_state[rc_bvh_s(b,1974u)+(0)]=0u;for(var rev=total;rev>0u;rev--){let destination=rev-1u;let w=rc_state[rc_bvh_s(b,2166u)+(destination)];for(var side=0u;side<2u;side++){var n=rc_bvh_mem_node(rc_bvh_s(b,438u)+(w*2u+side)*8u);let p=destination*2u+side;if(rc_bvh_leaf(n)){if(resolveFlags){n=rc_bvh_resolve(n);}rc_state[b+RC_BVH_LEAVES+n.child]=p;}else{let child=rc_state[rc_bvh_s(b,2070u)+(n.child)];rc_state[rc_bvh_s(b,1974u)+(child)]=p;n=rc_bvh_merge(rc_bvh_node(b,child*2u),rc_bvh_node(b,child*2u+1u),child);}rc_bvh_put(b,p,n);}}
 for(var i=0u;i<total;i++){rc_state[b+RC_BVH_PARENTS+i]=rc_state[rc_bvh_s(b,1974u)+(i)];}for(var i=total*2u;i<oldCount*2u;i++){rc_bvh_put(b,i,rc_bvh_zero());}rc_state[b]=total;rc_state[b+3u]=0u;return 0u;
}
// previous/current are explicit source-ordered ID spans, never a set.
fn rc_bvh_partial_refit(b:u32,previous:u32,np:u32,current:u32,nc:u32)->u32{
 if(np>27u||nc>27u){return rc_bvh_fail(b,1u);}for(var j=0u;j<np;j++){let id=rc_state[previous+j];if(id>=27u){return rc_bvh_fail(b,2u);}let p=rc_state[b+RC_BVH_LEAVES+id];if(p!=RC_BVH_NULL){let n=rc_bvh_node(b,p);if(!rc_bvh_pending(n)&&rc_bvh_changed(n)){rc_bvh_put(b,p,rc_bvh_resolve(n));}}}
 for(var j=0u;j<nc;j++){let id=rc_state[current+j];if(id>=27u){return rc_bvh_fail(b,2u);}let p=rc_state[b+RC_BVH_LEAVES+id];if(p!=RC_BVH_NULL){let n=rc_bvh_node(b,p);if(rc_bvh_pending(n)){rc_bvh_put(b,p,rc_bvh_resolve(n));}}}
 for(var j=0u;j<np+nc;j++){var id=0u;if(j<np){id=rc_state[previous+j];}else{id=rc_state[current+j-np];}let p=rc_state[b+RC_BVH_LEAVES+id];if(p==RC_BVH_NULL){continue;}var w=p/2u;var depth=0u;loop{if(w==0u){break;}depth++;if(depth>27u){return rc_bvh_fail(b,2u);}let parent=rc_state[b+RC_BVH_PARENTS+w];var n=rc_bvh_merge(rc_bvh_node(b,w*2u),rc_bvh_node(b,w*2u+1u),w);if((n.data>>30u)!=0u){n.data=rc_bvh_count(n)|0x40000000u;}rc_bvh_put(b,parent,n);w=parent/2u;}}
 return 0u;
}
// Return: 0 unchanged, 1 updated, 2 absent, 0xffffffff draft failure.
fn rc_bvh_update_leaf(b:u32,id:u32,lo:vec3<f32>,hi:vec3<f32>,skin:f32,reinsert:bool,propagate:bool)->u32{
 if(id>=27u||!(skin>=0.0&&skin<=1.0)||!rc_bvh_valid_box(lo,hi)){rc_bvh_fail(b,2u);return RC_BVH_NULL;}let p=rc_state[b+RC_BVH_LEAVES+id];if(p==RC_BVH_NULL){return 2u;}var n=rc_bvh_node(b,p);let raw=RcBvhNode(lo,hi,1u,id);
 if(reinsert||skin>0.0){if(rc_bvh_contains(n,raw)){return 0u;}var flo=lo;var fhi=hi;for(var i=0u;i<3u;i++){flo[i]=rc_bvh_sub(b,lo[i],skin);fhi[i]=rc_bvh_add(b,hi[i],skin);}if(!rc_bvh_valid_box(flo,fhi)){rc_bvh_fail(b,2u);return RC_BVH_NULL;}if(reinsert){if(rc_bvh_remove(b,id)!=0u||rc_bvh_insert(b,id,flo,fhi)!=0u){return RC_BVH_NULL;}return 1u;}n.lo=flo;n.hi=fhi;n.data=n.data|0xc0000000u;}else{n.lo=lo;n.hi=hi;}rc_bvh_put(b,p,n);
 if(propagate){var w=p/2u;var depth=0u;loop{if(w==0u){break;}depth++;if(depth>27u){rc_bvh_fail(b,2u);return RC_BVH_NULL;}let parent=rc_state[b+RC_BVH_PARENTS+w];let ancestor=rc_bvh_node(b,parent);if(rc_bvh_contains(ancestor,raw)){break;}var merged=rc_bvh_merge(ancestor,raw,ancestor.child);merged.data=ancestor.data;rc_bvh_put(b,parent,merged);w=parent/2u;}}
 return 1u;
}

// Source optimizer config on the admitted 22..27-leaf domain. The integer table
// is exhaustively checked against optimizationConfig; it avoids replacing the
// source f32 sqrt/log2 chain with backend-specific WGSL transcendental results.
fn rc_bvh_optimizer_target(n:u32)->u32{return select(5u,6u,n>=26u);}
fn rc_bvh_optimizer_subtree(n:u32)->u32{if(n==22u){return 19u;}return select(20u,21u,n>=26u);}
fn rc_bvh_div(b:u32,a:f32,c:f32)->f32{rc_state[b+24u]=bitcast<u32>(a/c);if((rc_state[b+24u]&0x7f800000u)==0x7f800000u){rc_bvh_fail(b,2u);}return bitcast<f32>(rc_state[b+24u]);}
fn rc_bvh_collect(b:u32,root:u32)->u32{
 var result=0u;var top=2u;rc_state[rc_bvh_s(b,2817u)+(0)]=root*2u+1u;rc_state[rc_bvh_s(b,2817u)+(1)]=root*2u;var visits=0u;
 loop{if(top==0u){break;}visits++;if(visits>54u){rc_bvh_fail(b,2u);return result;}top--;let n=rc_bvh_node(b,rc_state[rc_bvh_s(b,2817u)+(top)]);if(rc_bvh_leaf(n)){if(result>=27u){rc_bvh_fail(b,1u);return result;}rc_bvh_mem_put(rc_bvh_s(b,2871u)+result*8u,n);result++;}else{if(top+2u>54u){rc_bvh_fail(b,1u);return result;}rc_state[rc_bvh_s(b,2817u)+(top)]=n.child*2u+1u;rc_state[rc_bvh_s(b,2817u)+(top+1u)]=n.child*2u;top+=2u;}}
 return result;
}
// DFS continuation frames preserve source append allocation order. In particular,
// the right internal child is allocated only after the entire left rebuild.
fn rc_bvh_rebuild_binned(b:u32,root:u32,input:u32,inputLength:u32)->u32{
 if(inputLength<2u||inputLength>27u){return rc_bvh_fail(b,2u);}for(var i=0u;i<inputLength;i++){rc_bvh_mem_put(rc_bvh_s(b,3087u)+i*8u,rc_bvh_mem_node(input+i*8u));}
 var top=1u;
 rc_state[rc_bvh_s(b,3303u)+(0)]=0u;rc_state[rc_bvh_s(b,3330u)+(0)]=inputLength;rc_state[rc_bvh_s(b,3357u)+(0)]=root;rc_state[rc_bvh_s(b,3384u)+(0)]=0u;
 loop{if(top==0u){break;}let at=top-1u;let start=rc_state[rc_bvh_s(b,3303u)+(at)];let length=rc_state[rc_bvh_s(b,3330u)+(at)];let destination=rc_state[rc_bvh_s(b,3357u)+(at)];
 if(rc_state[rc_bvh_s(b,3384u)+(at)]==0u){
  var lo=vec3<f32>(bitcast<f32>(0x7f7fffffu));var hi=-lo;
  for(var j=0u;j<length;j++){let n=rc_bvh_mem_node(rc_bvh_s(b,3087u)+(start+j)*8u);var center=vec3<f32>(0.0);for(var axis=0u;axis<3u;axis++){center[axis]=rc_bvh_mul(b,rc_bvh_add(b,n.lo[axis],n.hi[axis]),0.5);lo[axis]=rc_bvh_min(lo[axis],center[axis]);hi[axis]=rc_bvh_max(hi[axis],center[axis]);}for(var k=0u;k<3u;k++){rc_state[rc_bvh_s(b,3465u)+j*3u+k]=bitcast<u32>(center[k]);}}
  var ext=vec3<f32>(0.0);for(var j=0u;j<3u;j++){ext[j]=rc_bvh_sub(b,hi[j],lo[j]);}var axis=0u;if(ext[1]>ext[axis]){axis=1u;}if(ext[2]>ext[axis]){axis=2u;}
  var scale=0.0;if(ext[axis]!=0.0){let numerator=rc_bvh_mul(b,8.0,rc_bvh_sub(b,1.0,bitcast<f32>(0x3727c5acu)));scale=rc_bvh_div(b,numerator,rc_bvh_sub(b,hi[axis],lo[axis]));}
  for(var j=0u;j<8u;j++){rc_state[rc_bvh_s(b,3637u)+(j)]=0u;rc_bvh_mem_put(rc_bvh_s(b,3573u)+(j)*8u,rc_bvh_zero());}
  for(var j=0u;j<length;j++){var bin=0u;if(ext[axis]!=0.0){let value=rc_bvh_mul(b,scale,rc_bvh_sub(b,bitcast<f32>(rc_state[rc_bvh_s(b,3465u)+j*3u+axis]),lo[axis]));bin=u32(clamp(value,0.0,7.0));}rc_state[rc_bvh_s(b,3546u)+(j)]=bin;let n=rc_bvh_mem_node(rc_bvh_s(b,3087u)+(start+j)*8u);if(rc_state[rc_bvh_s(b,3637u)+(bin)]==0u){rc_bvh_mem_put(rc_bvh_s(b,3573u)+(bin)*8u,n);}else{rc_bvh_mem_put(rc_bvh_s(b,3573u)+(bin)*8u,rc_bvh_merge(rc_bvh_mem_node(rc_bvh_s(b,3573u)+(bin)*8u),n,0u));}rc_state[rc_bvh_s(b,3637u)+(bin)]++;}
  var merged=rc_bvh_zero();var n=0u;
  for(var j=0u;j<8u;j++){if(rc_state[rc_bvh_s(b,3637u)+(j)]>0u){if(n==0u){merged=rc_bvh_mem_node(rc_bvh_s(b,3573u)+(j)*8u);}else{merged=rc_bvh_merge(merged,rc_bvh_mem_node(rc_bvh_s(b,3573u)+(j)*8u),0u);}}n+=rc_state[rc_bvh_s(b,3637u)+(j)];rc_state[rc_bvh_s(b,3773u)+(j)]=n;rc_bvh_mem_put(rc_bvh_s(b,3645u)+(j)*8u,merged);}
  merged=rc_bvh_zero();n=0u;for(var rev=8u;rev>0u;rev--){let j=rev-1u;if(rc_state[rc_bvh_s(b,3637u)+(j)]>0u){if(n==0u){merged=rc_bvh_mem_node(rc_bvh_s(b,3573u)+(j)*8u);}else{merged=rc_bvh_merge(merged,rc_bvh_mem_node(rc_bvh_s(b,3573u)+(j)*8u),0u);}}n+=rc_state[rc_bvh_s(b,3637u)+(j)];rc_state[rc_bvh_s(b,3781u)+(j)]=n;rc_bvh_mem_put(rc_bvh_s(b,3709u)+(j)*8u,merged);}
  var best=bitcast<f32>(0x7f7fffffu);var plane=0u;var mid=rc_state[rc_bvh_s(b,3637u)+(0)];
  for(var j=0u;j<7u;j++){if(rc_state[rc_bvh_s(b,3773u)+(j)]>0u&&rc_state[rc_bvh_s(b,3781u)+(j+1u)]>0u){var a=rc_bvh_mem_node(rc_bvh_s(b,3645u)+(j)*8u);var c=rc_bvh_mem_node(rc_bvh_s(b,3709u)+(j+1u)*8u);a.data=rc_state[rc_bvh_s(b,3773u)+(j)];c.data=rc_state[rc_bvh_s(b,3781u)+(j+1u)];let cost=rc_bvh_score(b,a,c);if(cost<best){best=cost;plane=j;mid=rc_state[rc_bvh_s(b,3773u)+(j)];}}}
  if(mid==0u||mid==length){mid=length/2u;}else{var left=0u;var right=mid;loop{if(left==mid||right==length){break;}loop{if(left==mid||rc_state[rc_bvh_s(b,3546u)+(left)]>plane){break;}left++;}if(left==mid){break;}loop{if(right==length||rc_state[rc_bvh_s(b,3546u)+(right)]<=plane){break;}right++;}if(right==length){break;}let old=rc_bvh_mem_node(rc_bvh_s(b,3087u)+(start+left)*8u);rc_bvh_mem_put(rc_bvh_s(b,3087u)+(start+left)*8u,rc_bvh_mem_node(rc_bvh_s(b,3087u)+(start+right)*8u));rc_bvh_mem_put(rc_bvh_s(b,3087u)+(start+right)*8u,old);let oldbin=rc_state[rc_bvh_s(b,3546u)+(left)];rc_state[rc_bvh_s(b,3546u)+(left)]=rc_state[rc_bvh_s(b,3546u)+(right)];rc_state[rc_bvh_s(b,3546u)+(right)]=oldbin;left++;right++;}}
  rc_state[rc_bvh_s(b,3411u)+(at)]=mid;rc_state[rc_bvh_s(b,3384u)+(at)]=1u;let packed=destination*2u;
  if(mid==1u){rc_bvh_put(b,packed,rc_bvh_mem_node(rc_bvh_s(b,3087u)+(start)*8u));rc_bvh_relocate(b,rc_bvh_mem_node(rc_bvh_s(b,3087u)+(start)*8u),packed);rc_state[rc_bvh_s(b,3438u)+(at)]=RC_BVH_NULL;}else{
   let child=rc_state[b];if(child>=96u||top>=27u){return rc_bvh_fail(b,1u);}rc_state[b]++;rc_state[b+RC_BVH_PARENTS+child]=packed;rc_bvh_put(b,child*2u,rc_bvh_zero());rc_bvh_put(b,child*2u+1u,rc_bvh_zero());rc_state[rc_bvh_s(b,3438u)+(at)]=child;
   rc_state[rc_bvh_s(b,3303u)+(top)]=start;rc_state[rc_bvh_s(b,3330u)+(top)]=mid;rc_state[rc_bvh_s(b,3357u)+(top)]=child;rc_state[rc_bvh_s(b,3384u)+(top)]=0u;top++;
  }
 }else if(rc_state[rc_bvh_s(b,3384u)+(at)]==1u){
  if(rc_state[rc_bvh_s(b,3438u)+(at)]!=RC_BVH_NULL){let child=rc_state[rc_bvh_s(b,3438u)+(at)];rc_bvh_put(b,destination*2u,rc_bvh_merge(rc_bvh_node(b,child*2u),rc_bvh_node(b,child*2u+1u),child));}
  rc_state[rc_bvh_s(b,3384u)+(at)]=2u;let mid=rc_state[rc_bvh_s(b,3411u)+(at)];let size=length-mid;let packed=destination*2u+1u;
  if(size==1u){rc_bvh_put(b,packed,rc_bvh_mem_node(rc_bvh_s(b,3087u)+(start+mid)*8u));rc_bvh_relocate(b,rc_bvh_mem_node(rc_bvh_s(b,3087u)+(start+mid)*8u),packed);rc_state[rc_bvh_s(b,3438u)+(at)]=RC_BVH_NULL;}else{
   let child=rc_state[b];if(child>=96u||top>=27u){return rc_bvh_fail(b,1u);}rc_state[b]++;rc_state[b+RC_BVH_PARENTS+child]=packed;rc_bvh_put(b,child*2u,rc_bvh_zero());rc_bvh_put(b,child*2u+1u,rc_bvh_zero());rc_state[rc_bvh_s(b,3438u)+(at)]=child;
   rc_state[rc_bvh_s(b,3303u)+(top)]=start+mid;rc_state[rc_bvh_s(b,3330u)+(top)]=size;rc_state[rc_bvh_s(b,3357u)+(top)]=child;rc_state[rc_bvh_s(b,3384u)+(top)]=0u;top++;
  }
 }else{if(rc_state[rc_bvh_s(b,3438u)+(at)]!=RC_BVH_NULL){let child=rc_state[rc_bvh_s(b,3438u)+(at)];rc_bvh_put(b,destination*2u+1u,rc_bvh_merge(rc_bvh_node(b,child*2u),rc_bvh_node(b,child*2u+1u),child));}top--;}
 }return 0u;
}
fn rc_bvh_optimize(b:u32)->u32{
 let n=rc_state[b+1u];if(n<22u||n>27u){return rc_bvh_fail(b,3u);}rc_state[b+4u]++;let frame=rc_state[b+4u];let destination=rc_bvh_optimizer_target(n);let subtree=rc_bvh_optimizer_subtree(n);let skip=frame%2u==0u;let breadth=!skip&&(frame/2u)%16u==0u;
 var nr=0u;var start=rc_state[b+5u];
 if(skip){var top=2u;rc_state[rc_bvh_s(b,2385u)+(0)]=1u;rc_state[rc_bvh_s(b,2439u)+(0)]=rc_bvh_count(rc_bvh_node(b,0u));rc_state[rc_bvh_s(b,2385u)+(1)]=0u;rc_state[rc_bvh_s(b,2439u)+(1)]=0u;
  loop{if(top==0u||nr==1u){break;}top--;let p=rc_state[rc_bvh_s(b,2385u)+(top)];let before=rc_state[rc_bvh_s(b,2439u)+(top)];var node=rc_bvh_node(b,p);let count=rc_bvh_count(node);if(before+count>start){if(count<subtree){if(count>2u){node.data=node.data|0xc0000000u;rc_bvh_put(b,p,node);rc_state[rc_bvh_s(b,2358u)+(nr)]=node.child;nr++;start+=count;}}else{if(top+2u>54u){return rc_bvh_fail(b,1u);}let left=rc_bvh_node(b,node.child*2u);rc_state[rc_bvh_s(b,2385u)+(top)]=node.child*2u+1u;rc_state[rc_bvh_s(b,2439u)+(top)]=before+rc_bvh_count(left);top++;rc_state[rc_bvh_s(b,2385u)+(top)]=node.child*2u;rc_state[rc_bvh_s(b,2439u)+(top)]=before;top++;}}}
 }
 if(start>=n){start=0u;}rc_state[b+5u]=start;var pseudoLength=0u;
 if(breadth){var begin=0u;var end=1u;rc_state[rc_bvh_s(b,2709u)+(0)]=0u;
  loop{if(end-begin+pseudoLength>=destination||begin==end){break;}let w=rc_state[rc_bvh_s(b,2709u)+(begin)];begin++;for(var side=0u;side<2u;side++){let node=rc_bvh_node(b,w*2u+side);if(rc_bvh_leaf(node)||rc_bvh_pending(node)){if(pseudoLength>=27u){return rc_bvh_fail(b,1u);}rc_bvh_mem_put(rc_bvh_s(b,2493u)+pseudoLength*8u,node);pseudoLength++;}else{if(end>=54u){return rc_bvh_fail(b,1u);}rc_state[rc_bvh_s(b,2709u)+(end)]=node.child;end++;}}}
  for(var j=begin;j<end;j++){for(var side=0u;side<2u;side++){if(pseudoLength>=27u){return rc_bvh_fail(b,1u);}rc_bvh_mem_put(rc_bvh_s(b,2493u)+pseudoLength*8u,rc_bvh_node(b,rc_state[rc_bvh_s(b,2709u)+(j)]*2u+side));pseudoLength++;}}
 }else if(!skip){var hn=1u;rc_state[rc_bvh_s(b,2763u)+(0)]=0u;rc_state[rc_bvh_s(b,2790u)+(0)]=bitcast<u32>(bitcast<f32>(0x7f7fffffu));
  loop{if(hn+pseudoLength>=destination||hn==0u){break;}let root=rc_state[rc_bvh_s(b,2763u)+(0)];hn--;let itemId=rc_state[rc_bvh_s(b,2763u)+(hn)];let itemScore=bitcast<f32>(rc_state[rc_bvh_s(b,2790u)+(hn)]);
   if(hn>0u){var i=0u;var child=1u;loop{if(hn<2u||child>hn-2u){break;}if(bitcast<f32>(rc_state[rc_bvh_s(b,2790u)+(child)])<=bitcast<f32>(rc_state[rc_bvh_s(b,2790u)+(child+1u)])){child++;}rc_state[rc_bvh_s(b,2763u)+(i)]=rc_state[rc_bvh_s(b,2763u)+(child)];rc_state[rc_bvh_s(b,2790u)+(i)]=bitcast<u32>(bitcast<f32>(rc_state[rc_bvh_s(b,2790u)+(child)]));i=child;child=i*2u+1u;}if(child==hn-1u){rc_state[rc_bvh_s(b,2763u)+(i)]=rc_state[rc_bvh_s(b,2763u)+(child)];rc_state[rc_bvh_s(b,2790u)+(i)]=bitcast<u32>(bitcast<f32>(rc_state[rc_bvh_s(b,2790u)+(child)]));i=child;}loop{if(i==0u){break;}let parent=(i-1u)/2u;if(itemScore<=bitcast<f32>(rc_state[rc_bvh_s(b,2790u)+(parent)])){break;}rc_state[rc_bvh_s(b,2763u)+(i)]=rc_state[rc_bvh_s(b,2763u)+(parent)];rc_state[rc_bvh_s(b,2790u)+(i)]=bitcast<u32>(bitcast<f32>(rc_state[rc_bvh_s(b,2790u)+(parent)]));i=parent;}rc_state[rc_bvh_s(b,2763u)+(i)]=itemId;rc_state[rc_bvh_s(b,2790u)+(i)]=bitcast<u32>(itemScore);}
   for(var side=0u;side<2u;side++){let node=rc_bvh_node(b,root*2u+side);if(rc_bvh_leaf(node)||rc_bvh_pending(node)){if(pseudoLength>=27u){return rc_bvh_fail(b,1u);}rc_bvh_mem_put(rc_bvh_s(b,2493u)+pseudoLength*8u,node);pseudoLength++;}else{if(hn>=27u){return rc_bvh_fail(b,1u);}let score=rc_bvh_score(b,rc_bvh_node(b,node.child*2u),rc_bvh_node(b,node.child*2u+1u));var i=hn;hn++;loop{if(i==0u){break;}let parent=(i-1u)/2u;if(score<=bitcast<f32>(rc_state[rc_bvh_s(b,2790u)+(parent)])){break;}rc_state[rc_bvh_s(b,2763u)+(i)]=rc_state[rc_bvh_s(b,2763u)+(parent)];rc_state[rc_bvh_s(b,2790u)+(i)]=bitcast<u32>(bitcast<f32>(rc_state[rc_bvh_s(b,2790u)+(parent)]));i=parent;}rc_state[rc_bvh_s(b,2763u)+(i)]=node.child;rc_state[rc_bvh_s(b,2790u)+(i)]=bitcast<u32>(score);}}
  }
  for(var j=0u;j<hn;j++){for(var side=0u;side<2u;side++){if(pseudoLength>=27u){return rc_bvh_fail(b,1u);}rc_bvh_mem_put(rc_bvh_s(b,2493u)+pseudoLength*8u,rc_bvh_node(b,rc_state[rc_bvh_s(b,2763u)+(j)]*2u+side));pseudoLength++;}}
 }
 if(pseudoLength>0u){if(rc_bvh_rebuild_binned(b,0u,rc_bvh_s(b,2493u),pseudoLength)!=0u){return rc_state[b+18u];}}
 for(var j=0u;j<nr;j++){let leaves=rc_bvh_collect(b,rc_state[rc_bvh_s(b,2358u)+(j)]);if(rc_state[b+18u]!=0u){return rc_state[b+18u];}if(rc_bvh_rebuild_binned(b,rc_state[rc_bvh_s(b,2358u)+(j)],rc_bvh_s(b,2871u),leaves)!=0u){return rc_state[b+18u];}}
 return 0u;
}
fn rc_bvh_join(b:u32)->u32{if(rc_state[b+18u]!=0u){return rc_state[b+18u];}if(rc_state[b+11u]==0u){return 0u;}rc_state[b+11u]=0u;let error=rc_bvh_optimize(b);if(error!=0u){return error;}return rc_bvh_full_refit(b,false);}
fn rc_bvh_sat_add(a:u32,c:u32)->u32{if(0xffffffffu-a<c){return 0xffffffffu;}return a+c;}
// Update record: leaf, min.xyz f32 bits, max.xyz f32 bits, skin f32 bits.
fn rc_bvh_update_node(input:u32)->RcBvhNode{return RcBvhNode(vec3<f32>(bitcast<f32>(rc_state[input+1u]),bitcast<f32>(rc_state[input+2u]),bitcast<f32>(rc_state[input+3u])),vec3<f32>(bitcast<f32>(rc_state[input+4u]),bitcast<f32>(rc_state[input+5u]),bitcast<f32>(rc_state[input+6u])),1u,rc_state[input]);}
// statuses: 0 Unchanged, 1 UpdatedInPlace, 2 Inserted. Returns error code.
fn rc_bvh_prepare_update(b:u32,updates:u32,nu:u32,removed:u32,nr:u32,forced:u32,nf:u32,live:u32,nlive:u32,statuses:u32)->u32{
 if(rc_state[b+18u]!=0u){return rc_state[b+18u];}if(nu>27u||nr>27u||nf>27u||nlive>27u){return rc_bvh_fail(b,1u);}rc_state[b+6u]++;if(rc_bvh_join(b)!=0u){return rc_state[b+18u];}
 for(var j=0u;j<27u;j++){rc_state[rc_bvh_s(b,3789u)+(j)]=0u;rc_state[rc_bvh_s(b,3816u)+(j)]=0u;rc_state[rc_bvh_s(b,3843u)+(j)]=0u;}
 for(var j=0u;j<nr;j++){let id=rc_state[removed+j];if(id>=27u||(rc_state[rc_bvh_s(b,3789u)+(id)]!=0u)){return rc_bvh_fail(b,2u);}rc_state[rc_bvh_s(b,3789u)+(id)]=1u;var admitted=false;for(var k=0u;k<rc_state[b+17u];k++){if(rc_state[b+2124u+k]==id){admitted=true;}}if(!admitted){return rc_bvh_fail(b,3u);}if(rc_bvh_remove(b,id)!=0u){return rc_state[b+18u];}}
 let first=rc_state[b+12u]!=0u;let minimum=select(rc_state[b+13u],rc_state[b+15u],first);if(rc_state[b+1u]<minimum){return rc_bvh_fail(b,3u);}
 for(var j=0u;j<nlive;j++){let id=rc_state[live+j];if(id>=27u||(rc_state[rc_bvh_s(b,3843u)+(id)]!=0u)){return rc_bvh_fail(b,2u);}rc_state[rc_bvh_s(b,3843u)+(id)]=1u;}
 for(var id=0u;id<27u;id++){var expected=rc_state[b+RC_BVH_LEAVES+id]!=RC_BVH_NULL;if(first){for(var j=0u;j<nu;j++){if(rc_state[updates+j*8u]==id){expected=true;}}}if(expected!=(rc_state[rc_bvh_s(b,3843u)+(id)]!=0u)){return rc_bvh_fail(b,2u);}}
 var nc=0u;for(var j=0u;j<rc_state[b+10u];j++){let id=rc_state[b+1841u+j];if(id>=27u){return rc_bvh_fail(b,2u);}if((rc_state[rc_bvh_s(b,3843u)+(id)]!=0u)){if(nc>=27u){return rc_bvh_fail(b,1u);}rc_state[rc_bvh_s(b,3870u)+(nc)]=id;nc++;}}rc_state[b+10u]=0u;
 for(var j=0u;j<27u;j++){rc_state[rc_bvh_s(b,3789u)+(j)]=0u;}var forcedAny=false;for(var j=0u;j<nf;j++){let id=rc_state[forced+j];if(id>=27u||(rc_state[rc_bvh_s(b,3789u)+(id)]!=0u)){return rc_bvh_fail(b,2u);}rc_state[rc_bvh_s(b,3789u)+(id)]=1u;if(rc_state[b+RC_BVH_LEAVES+id]!=RC_BVH_NULL){if(rc_bvh_remove(b,id)!=0u){return rc_state[b+18u];}rc_state[rc_bvh_s(b,3816u)+(id)]=1u;forcedAny=true;}}
 let leafCount=rc_state[b+1u];let reinsert=rc_state[b+8u]!=0u&&nu*16u<leafCount;for(var j=0u;j<27u;j++){rc_state[rc_bvh_s(b,3789u)+(j)]=0u;}
 if(first){if(nr!=0u||nf!=0u||nc!=0u||nu!=rc_state[b+16u]){return rc_bvh_fail(b,3u);}for(var j=0u;j<nu;j++){let node=rc_bvh_update_node(updates+j*8u);if(node.child!=rc_state[b+2097u+j]||rc_state[b+RC_BVH_LEAVES+node.child]!=RC_BVH_NULL){return rc_bvh_fail(b,3u);}if(rc_bvh_insert(b,node.child,node.lo,node.hi)!=0u){return rc_state[b+18u];}rc_state[rc_bvh_s(b,3870u)+(nc)]=node.child;nc++;rc_state[statuses+j]=2u;}if(rc_bvh_full_refit(b,true)!=0u){return rc_state[b+18u];}}
 else{var nm=0u;for(var j=0u;j<nu;j++){let input=updates+j*8u;let node=rc_bvh_update_node(input);if(node.child>=27u||(rc_state[rc_bvh_s(b,3789u)+(node.child)]!=0u)){return rc_bvh_fail(b,2u);}rc_state[rc_bvh_s(b,3789u)+(node.child)]=1u;let status=rc_bvh_update_leaf(b,node.child,node.lo,node.hi,bitcast<f32>(rc_state[input+7u]),reinsert,false);if(status==RC_BVH_NULL){return rc_state[b+18u];}rc_state[statuses+j]=status;if(status==2u){rc_state[rc_bvh_s(b,3897u)+(nm)]=j;nm++;continue;}if(status!=0u){if(!reinsert){rc_state[b+7u]=rc_bvh_sat_add(rc_state[b+7u],1u);}if(nc>=27u){return rc_bvh_fail(b,1u);}rc_state[rc_bvh_s(b,3870u)+(nc)]=node.child;nc++;}}
  for(var k=0u;k<nm;k++){let j=rc_state[rc_bvh_s(b,3897u)+(k)];let node=rc_bvh_update_node(updates+j*8u);if(!(rc_state[rc_bvh_s(b,3816u)+(node.child)]!=0u)){return rc_bvh_fail(b,3u);}if(rc_bvh_insert(b,node.child,node.lo,node.hi)!=0u){return rc_state[b+18u];}rc_state[statuses+j]=2u;if(nc>=27u){return rc_bvh_fail(b,1u);}rc_state[rc_bvh_s(b,3870u)+(nc)]=node.child;nc++;}
 }
 rc_state[b+8u]=select(0u,1u,nc*16u<rc_state[b+1u]);rc_state[b+7u]=rc_bvh_sat_add(rc_state[b+7u],nr);
 let run=rc_state[b+7u]>0u&&(nc*16u>=leafCount||rc_state[b+6u]%8u==0u);let mustFull=nr>0u||forcedAny;let defer=run&&!mustFull;if(run){rc_state[b+7u]=0u;}if(run&&!defer){if(rc_bvh_optimize(b)!=0u){return rc_state[b+18u];}}
 let full=mustFull||(run&&!defer)||(nc+rc_state[b+9u])*16u>=rc_state[b+1u];
 // current IDs temporarily occupy tail padding so partial-refit uses its same
 // explicit-span implementation; no host ordering or deduplication involved.
 for(var j=0u;j<nc;j++){rc_state[b+2152u+j]=rc_state[rc_bvh_s(b,3870u)+(j)];}
 if(first){if(!full||run){return rc_bvh_fail(b,3u);}}else if(full){if(rc_bvh_full_refit(b,true)!=0u){return rc_state[b+18u];}}else{if(rc_bvh_partial_refit(b,b+1814u,rc_state[b+9u],b+2152u,nc)!=0u){return rc_state[b+18u];}}
 for(var j=0u;j<nc;j++){rc_state[b+1814u+j]=rc_state[rc_bvh_s(b,3870u)+(j)];}rc_state[b+9u]=nc;rc_state[b+11u]=select(0u,1u,defer);rc_state[b+12u]=0u;return 0u;
}
fn rc_bvh_set_aabbs(b:u32,updates:u32,nu:u32,statuses:u32)->u32{
 if(rc_state[b+18u]!=0u){return rc_state[b+18u];}if(rc_state[b+12u]!=0u){return rc_bvh_fail(b,3u);}if(nu>27u){return rc_bvh_fail(b,1u);}if(rc_bvh_join(b)!=0u){return rc_state[b+18u];}
 for(var j=0u;j<27u;j++){rc_state[rc_bvh_s(b,3924u)+j]=0u;}
 for(var j=0u;j<nu;j++){let input=updates+j*8u;let node=rc_bvh_update_node(input);if(node.child>=27u||(rc_state[rc_bvh_s(b,3924u)+(node.child)]!=0u)||rc_state[b+RC_BVH_LEAVES+node.child]==RC_BVH_NULL){return rc_bvh_fail(b,2u);}rc_state[rc_bvh_s(b,3924u)+(node.child)]=1u;let reinsert=rc_state[b+8u]!=0u;let status=rc_bvh_update_leaf(b,node.child,node.lo,node.hi,bitcast<f32>(rc_state[input+7u]),reinsert,true);if(status==RC_BVH_NULL){return rc_state[b+18u];}rc_state[statuses+j]=status;if(status!=0u){if(!reinsert){rc_state[b+7u]=rc_bvh_sat_add(rc_state[b+7u],1u);}let at=rc_state[b+10u];if(at>=256u){return rc_bvh_fail(b,1u);}rc_state[b+1841u+at]=node.child;rc_state[b+10u]++;}}
 return 0u;
}
`;}
