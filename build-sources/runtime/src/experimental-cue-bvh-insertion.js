/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2020 Sébastien Crozet. Modified 2026.
 * Bounded source port: Parry 0.31.1 partitioning/bvh/{bvh_insert.rs,
 * bvh_refit.rs,bvh_traverse_bvtt.rs,bvh_tree.rs}; Rapier revision
 * b716d375efc0201003f0cd9ef7168eee0b62c177 broad_phase_bvh/update.rs.
 * Fresh ordered insertion, all four descent rotations, full resolving refit,
 * and raw changed-leaf BVTT order only. No optimizer, runtime broad-phase,
 * pair filtering, physics, native query, or numerical CPU fallback.
 */
(function (G) {
'use strict';
const SOURCE='b716d375efc0201003f0cd9ef7168eee0b62c177', CAPACITY=64;
const MASK=0x3fffffff, CHANGED=0x40000000, PENDING=0xc0000000;
const F32_MAX=3.4028234663852886e38, clone=x=>structuredClone(x);
const need=(ok,message)=>{if(!ok)throw new RangeError('Cue BVH insertion: '+message);};
const uint=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
const count=n=>n.data&MASK, leaf=n=>count(n)===1, changed=n=>(n.data>>>30)===1;
const index=(wide,right)=>wide*2+(right?1:0);
const at=(tree,i)=>tree.nodes[i>>>1][i&1?'right':'left'];
const put=(tree,i,node)=>{tree.nodes[i>>>1][i&1?'right':'left']=node;};
const cn=n=>({mins:n.mins.slice(),maxs:n.maxs.slice(),data:n.data,children:n.children});
const xyz=(v,name)=>need(Array.isArray(v)&&v.length===3&&v.every(x=>Number.isFinite(x)&&x===Math.fround(x)),name+' must be three finite f32 values');
const keys=(x,names,name)=>need(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>names.includes(k)),name+' has unsupported fields');
function bounds(min,max,name){xyz(min,name+'.min');xyz(max,name+'.max');need(min.every((x,i)=>x<=max[i]),name+' has inverted bounds');}
function mergeBox(a,b){return{min:a.min.map((x,i)=>Math.min(x,b.min[i])),max:a.max.map((x,i)=>Math.max(x,b.max[i]))};}
function box(n,c=count(n)){return{min:n.mins.slice(),max:n.maxs.slice(),count:c};}
function merge(a,b,children){const q=mergeBox(box(a),box(b));return{mins:q.min,maxs:q.max,children,data:((count(a)+count(b))|(((a.data>>>30)|(b.data>>>30))<<30))>>>0};}
function newLeaf(b,id){return{mins:b.min.slice(),maxs:b.max.slice(),data:(PENDING|1)>>>0,children:id};}
function resolve(n){n.data=((n.data&MASK)|((n.data>>>30)===3?CHANGED:0))>>>0;}
function intersects(a,b){return a.mins.every((x,i)=>x<=b.maxs[i]&&a.maxs[i]>=b.mins[i]);}
function validateTree(tree){
 keys(tree,['nodes','parents','leaf_node_indices','free_wide_nodes','optimization'],'tree');
 need(Array.isArray(tree.nodes)&&tree.nodes.length>=1&&tree.nodes.length<=CAPACITY,'1..64 wide nodes required');
 need(Array.isArray(tree.parents)&&tree.parents.length===tree.nodes.length&&tree.parents.every(uint),'packed parent array required');
 keys(tree.leaf_node_indices,['n','v'],'leaf map');
 const map=tree.leaf_node_indices;
 need(Number.isInteger(map.n)&&map.n>=2&&map.n<=CAPACITY&&Array.isArray(map.v)&&map.v.length<=CAPACITY&&map.v.every(v=>v===null||uint(v)),'bounded source leaf map required');
 need(Array.isArray(tree.free_wide_nodes)&&tree.free_wide_nodes.every(i=>uint(i)&&i>0&&i<tree.nodes.length)&&new Set(tree.free_wide_nodes).size===tree.free_wide_nodes.length,'valid unique free slots required');
 keys(tree.optimization,['rebuild_frame_index','rebuild_start_index'],'optimization');
 need(uint(tree.optimization.rebuild_frame_index)&&uint(tree.optimization.rebuild_start_index),'source optimization counters required');
 for(const wide of tree.nodes){keys(wide,['left','right'],'wide node');for(const n of[wide.left,wide.right]){keys(n,['mins','maxs','data','children'],'half node');need(uint(n.data)&&uint(n.children),'u32 node fields required');bounds(n.mins,n.maxs,'node');need((n.data>>>30)!==2,'unknown change-flag state');}}
 const seenWide=new Set(),seenLeaves=new Set();
 function visit(w,parent){need(w<tree.nodes.length&&!seenWide.has(w),'cyclic or repeated wide node');seenWide.add(w);if(w!==0)need(tree.parents[w]===parent,'parent pointer mismatch');let sum=0;
  for(const side of[0,1]){const p=index(w,side),n=at(tree,p),c=count(n);need(c>=1&&c<=CAPACITY,'empty/reachable or oversized node');
   if(c===1){need(n.children<CAPACITY&&!seenLeaves.has(n.children)&&map.v[n.children]===p,'leaf map mismatch');seenLeaves.add(n.children);}
   else{need(n.children!==0,'internal link to root');const childCount=visit(n.children,p);need(childCount===c,'subtree leaf count mismatch');const child=tree.nodes[n.children],merged=merge(child.left,child.right,n.children);need(n.mins.every((x,i)=>x<=merged.mins[i]&&n.maxs[i]>=merged.maxs[i]),'parent bounds do not contain children');}
   sum+=c;
  }return sum;
 }
 need(visit(0,0)===map.n&&seenLeaves.size===map.n&&map.v.filter(v=>v!==null).length===map.n,'total leaf count mismatch');
 need(tree.parents[0]===0,'root parent must be zero');
 for(let i=0;i<tree.nodes.length;i++)if(!seenWide.has(i)){need(tree.free_wide_nodes.includes(i),'untracked orphan node');const n=tree.nodes[i];need([n.left,n.right].every(x=>x.data===0&&x.children===0&&x.mins.every(y=>y===0)&&x.maxs.every(y=>y===0)),'free wide slot must be zeroed');}
 need(tree.free_wide_nodes.every(i=>!seenWide.has(i)),'reachable node in free list');
 return tree;
}
function validateUpdates(input,tree){
 need(Array.isArray(input)&&input.length>=1&&input.length<=CAPACITY,'1..64 ordered fresh updates required');
 need(tree.leaf_node_indices.n+input.length<=CAPACITY,'leaf capacity exceeded');const seen=new Set();
 return input.map(u=>{keys(u,['leaf','box'],'update');need(uint(u.leaf)&&u.leaf<CAPACITY&&!seen.has(u.leaf),'invalid or duplicate new leaf');seen.add(u.leaf);need(tree.leaf_node_indices.v[u.leaf]==null,'existing leaf updates unsupported');keys(u.box,['min','max'],'update box');bounds(u.box.min,u.box.max,'update box');return clone(u);});
}
function alloc(tree,node,parent){let id;if(tree.free_wide_nodes.length){id=tree.free_wide_nodes.pop();tree.nodes[id]=node;tree.parents[id]=parent;}else{id=tree.nodes.length;need(id<CAPACITY,'wide-node capacity exceeded');tree.nodes.push(node);tree.parents.push(parent);}return id;}
function relocate(tree,node,packed){if(leaf(node))tree.leaf_node_indices.v[node.children]=packed;else tree.parents[node.children]=packed;}
async function firstInsert(inputTree,inputUpdates,arithmetic){
 need(arithmetic&&typeof arithmetic.score==='function'&&typeof arithmetic.difference==='function','explicit score and difference evaluators required');
 const tree=validateTree(clone(inputTree)),updates=validateUpdates(inputUpdates,tree);
 const diagnostics={sourceRevision:SOURCE,parryVersion:'0.31.1',scope:'fresh-insertion-full-refit-bvtt',initialLeafCount:tree.leaf_node_indices.n,inserted:[],rotations:0,scoreCalls:0,scoreRows:0,differenceCalls:0,differenceRows:0,fullRefit:true,optimizerExecuted:false,capacity:CAPACITY};
 async function evaluate(kind,rows){diagnostics[kind==='score'?'scoreCalls':'differenceCalls']++;diagnostics[kind==='score'?'scoreRows':'differenceRows']+=rows.length;const out=await arithmetic[kind](rows);need((Array.isArray(out)||ArrayBuffer.isView(out))&&out.length===rows.length,kind+' result length mismatch');const values=Array.from(out);need(values.every(x=>typeof x==='number'&&Number.isFinite(x)&&x===Math.fround(x)),kind+' must return finite f32 values');return values;}
 async function rotate(w){
  const n=tree.nodes[w],L=cn(n.left),R=cn(n.right),rows=[{a:box(L),b:box(R)}],choices=[];
  for(const[A,B]of[[L,R],[R,L]]){
   if(leaf(A)){choices.push(null);continue;}
   const C=tree.nodes[A.children],l=cn(C.left),r=cn(C.right),start=rows.length;
   rows.push({a:box(l),b:{...mergeBox(box(r),box(B)),count:count(r)+count(B)}},{a:box(r),b:{...mergeBox(box(l),box(B)),count:count(l)+count(B)}});choices.push({start});
  }
  // Leaf/leaf has no eligible rotation and performs no floating-point score.
  if(choices.every(x=>x===null))return;
  const values=await evaluate('score',rows),deltas=[],selected=[];
  for(const c of choices){if(c===null){selected.push(null);continue;}const upLeft=values[c.start]<values[c.start+1],score=values[c.start+(upLeft?0:1)];selected.push({upLeft,slot:deltas.length});deltas.push([score,values[0]]);}
  const diff=await evaluate('difference',deltas),d0=selected[0]?diff[selected[0].slot]:F32_MAX,d1=selected[1]?diff[selected[1].slot]:F32_MAX;
  if(!(d0<0||d1<0))return;
  if(d0<d1){
   const id=L.children,C={left:cn(tree.nodes[id].left),right:cn(tree.nodes[id].right)};tree.parents[id]=index(w,1);
   if(selected[0].upLeft){tree.nodes[w].left=C.left;tree.nodes[id].left=R;relocate(tree,C.left,index(w,0));relocate(tree,R,index(id,0));}
   else{tree.nodes[w].left=C.right;tree.nodes[id].right=R;relocate(tree,C.right,index(w,0));relocate(tree,R,index(id,1));}
   tree.nodes[w].right=merge(tree.nodes[id].left,tree.nodes[id].right,id);
  }else{
   const id=R.children,C={left:cn(tree.nodes[id].left),right:cn(tree.nodes[id].right)};tree.parents[id]=index(w,0);
   if(selected[1].upLeft){tree.nodes[w].right=C.left;tree.nodes[id].left=L;relocate(tree,C.left,index(w,1));relocate(tree,L,index(id,0));}
   else{tree.nodes[w].right=C.right;tree.nodes[id].right=L;relocate(tree,C.right,index(w,1));relocate(tree,L,index(id,1));}
   tree.nodes[w].left=merge(tree.nodes[id].left,tree.nodes[id].right,id);
  }
  diagnostics.rotations++;
 }
 for(const u of updates){
  const map=tree.leaf_node_indices;while(map.v.length<=u.leaf)map.v.push(null);map.v[u.leaf]=0;map.n++;
  let w=0,depth=0;
  for(;;){need(++depth<=CAPACITY,'insertion depth capacity exceeded');await rotate(w);const n=tree.nodes[w],L=n.left,R=n.right,lc=count(L),rc=count(R);
   const costs=await evaluate('score',[{a:{...mergeBox(box(L),u.box),count:lc+1},b:box(R)},{a:{...mergeBox(box(R),u.box),count:rc+1},b:box(L)}]);
   const left=costs[0]<costs[1]||(costs[0]===costs[1]&&lc<rc),side=left?'left':'right',old=cn(n[side]);
   if(leaf(old)){
    const fresh=newLeaf(u.box,u.leaf),wide=left?{left:old,right:fresh}:{left:fresh,right:old},id=alloc(tree,wide,index(w,!left));
    map.v[old.children]=index(id,!left);map.v[u.leaf]=index(id,left);
    const b=mergeBox(box(old),u.box);tree.nodes[w][side]={mins:b.min,maxs:b.max,children:id,data:(old.data+1)>>>0};break;
   }
   n[side].data=(n[side].data+1)>>>0;n[side].mins=n[side].mins.map((x,i)=>Math.min(x,u.box.min[i]));n[side].maxs=n[side].maxs.map((x,i)=>Math.max(x,u.box.max[i]));w=old.children;
  }
  diagnostics.inserted.push(u.leaf);
 }
 // Source refit_buffers<true>: compact reachable wide nodes in left-first preorder.
 const source=tree.nodes,target=[],parents=[];
 function refit(sourceId,parent){const targetId=target.length;need(targetId<CAPACITY,'refit capacity exceeded');target.push({left:null,right:null});parents.push(parent);const old=source[sourceId];
  for(const side of[0,1]){const key=side?'right':'left',node=old[key];if(leaf(node)){const copy=cn(node);resolve(copy);target[targetId][key]=copy;tree.leaf_node_indices.v[copy.children]=index(targetId,side);}else{const childId=refit(node.children,index(targetId,side));target[targetId][key]=merge(target[childId].left,target[childId].right,childId);}}
  return targetId;
 }
 refit(0,0);tree.nodes=target;tree.parents=parents;tree.free_wide_nodes=[];
 validateTree(tree);
 const candidates=[];
 const emit=(a,b)=>{need(a!==b&&candidates.length<CAPACITY*(CAPACITY-1)/2,'invalid or excessive candidate stream');candidates.push([a,b]);};
 function single(node,subtree){const stack=[];let currId=subtree,visits=0;for(;;){need(++visits<=CAPACITY,'single traversal capacity exceeded');const curr=tree.nodes[currId],L=curr.left,R=curr.right,lc=(changed(node)||changed(L))&&intersects(node,L),rc=(changed(node)||changed(R))&&intersects(node,R);let found=false;
  if(lc){if(leaf(L))emit(node.children,L.children);else{currId=L.children;found=true;}}
  if(rc){if(leaf(R))emit(node.children,R.children);else if(!found){currId=R.children;found=true;}else stack.push(R.children);}
  if(!found){if(stack.length)currId=stack.pop();else return;}
 }}
 function dispatch(a,b){if(leaf(a)&&leaf(b))emit(a.children,b.children);else if(leaf(a))single(a,b.children);else if(leaf(b))single(b,a.children);else cross(a.children,b.children);}
 function cross(a,b){const A=tree.nodes[a],B=tree.nodes[b];for(const[x,y]of[[A.left,B.left],[A.left,B.right],[A.right,B.left],[A.right,B.right]])if((changed(x)||changed(y))&&intersects(x,y))dispatch(x,y);}
 function self(w){const n=tree.nodes[w],L=n.left,R=n.right;if(!changed(L)&&!changed(R))return;const overlap=intersects(L,R);if(changed(L)&&!leaf(L))self(L.children);if(changed(R)&&!leaf(R))self(R.children);if(overlap)dispatch(L,R);}
 self(0);
 diagnostics.finalLeafCount=tree.leaf_node_indices.n;diagnostics.finalWideCount=tree.nodes.length;diagnostics.candidateCount=candidates.length;
 return{tree,candidates,diagnostics};
}

// Refit the source-created topology against current owned fat leaves, then use
// the exact changed-leaf source BVTT traversal. This is an event projection,
// NOT serialization parity for the native evolving/optimized BVH. Callers may
// use it only when filtering leaves one novel eligible event: its order is then
// invariant under source SAH reinsertion and optimization. Multi-new events are
// still unsupported. No later native tree or leaf is accepted here.
function changedLeafCandidates(inputTree,currentLeaves,updatedLeaves){
 const tree=validateTree(clone(inputTree));
 need(Array.isArray(currentLeaves)&&currentLeaves.length===tree.leaf_node_indices.n,'complete owned current fat leaves required');
 need(Array.isArray(updatedLeaves)&&updatedLeaves.length>0&&updatedLeaves.length<=CAPACITY&&new Set(updatedLeaves).size===updatedLeaves.length,'nonempty unique source changed leaves required');
 const by=new Map();for(const u of currentLeaves){keys(u,['leaf','box'],'current leaf');need(uint(u.leaf)&&u.leaf<CAPACITY&&!by.has(u.leaf)&&tree.leaf_node_indices.v[u.leaf]!=null,'current source leaf identity');keys(u.box,['min','max'],'current box');bounds(u.box.min,u.box.max,'current box');by.set(u.leaf,u.box);}
 need(updatedLeaves.every(i=>uint(i)&&by.has(i)),'changed leaf must still exist');const changedIds=new Set(updatedLeaves);
 function refit(w){const n=tree.nodes[w];for(const side of['left','right']){const a=n[side];if(leaf(a)){const b=by.get(a.children);need(b,'owned source leaf missing');a.mins=b.min.slice();a.maxs=b.max.slice();a.data=(1|(changedIds.has(a.children)?CHANGED:0))>>>0;}else{refit(a.children);n[side]=merge(tree.nodes[a.children].left,tree.nodes[a.children].right,a.children);}}}
 refit(0);validateTree(tree);
 const candidates=[];
 const emit=(a,b)=>{need(a!==b&&candidates.length<CAPACITY*(CAPACITY-1)/2,'invalid or excessive candidate stream');candidates.push([a,b]);};
 function single(node,subtree){const stack=[];let currId=subtree,visits=0;for(;;){need(++visits<=CAPACITY,'single traversal capacity exceeded');const curr=tree.nodes[currId],L=curr.left,R=curr.right,lc=(changed(node)||changed(L))&&intersects(node,L),rc=(changed(node)||changed(R))&&intersects(node,R);let found=false;
  if(lc){if(leaf(L))emit(node.children,L.children);else{currId=L.children;found=true;}}
  if(rc){if(leaf(R))emit(node.children,R.children);else if(!found){currId=R.children;found=true;}else stack.push(R.children);}
  if(!found){if(stack.length)currId=stack.pop();else return;}
 }}
 function dispatch(a,b){if(leaf(a)&&leaf(b))emit(a.children,b.children);else if(leaf(a))single(a,b.children);else if(leaf(b))single(b,a.children);else cross(a.children,b.children);}
 function cross(a,b){const A=tree.nodes[a],B=tree.nodes[b];for(const[x,y]of[[A.left,B.left],[A.left,B.right],[A.right,B.left],[A.right,B.right]])if((changed(x)||changed(y))&&intersects(x,y))dispatch(x,y);}
 function self(w){const n=tree.nodes[w],L=n.left,R=n.right;if(!changed(L)&&!changed(R))return;const overlap=intersects(L,R);if(changed(L)&&!leaf(L))self(L.children);if(changed(R)&&!leaf(R))self(R.children);if(overlap)dispatch(L,R);}
 self(0);
 return{candidates,diagnostics:{scope:'source-bvtt-single-new-event-projection',sourceRevision:SOURCE,fullBvhStateParity:false,updatedLeaves:updatedLeaves.slice(),candidateCount:candidates.length}};
}

// Exact traversal of the current source-owned, already-refitted tree. Unlike
// changedLeafCandidates this preserves native change flags and topology.
function sourceTreeCandidates(inputTree){
 const tree=validateTree(clone(inputTree));
 const candidates=[];
 const emit=(a,b)=>{need(a!==b&&candidates.length<CAPACITY*(CAPACITY-1)/2,'invalid or excessive candidate stream');candidates.push([a,b]);};
 function single(node,subtree){const stack=[];let currId=subtree,visits=0;for(;;){need(++visits<=CAPACITY,'single traversal capacity exceeded');const curr=tree.nodes[currId],L=curr.left,R=curr.right,lc=(changed(node)||changed(L))&&intersects(node,L),rc=(changed(node)||changed(R))&&intersects(node,R);let found=false;
  if(lc){if(leaf(L))emit(node.children,L.children);else{currId=L.children;found=true;}}
  if(rc){if(leaf(R))emit(node.children,R.children);else if(!found){currId=R.children;found=true;}else stack.push(R.children);}
  if(!found){if(stack.length)currId=stack.pop();else return;}
 }}
 function dispatch(a,b){if(leaf(a)&&leaf(b))emit(a.children,b.children);else if(leaf(a))single(a,b.children);else if(leaf(b))single(b,a.children);else cross(a.children,b.children);}
 function cross(a,b){const A=tree.nodes[a],B=tree.nodes[b];for(const[x,y]of[[A.left,B.left],[A.left,B.right],[A.right,B.left],[A.right,B.right]])if((changed(x)||changed(y))&&intersects(x,y))dispatch(x,y);}
 function self(w){const n=tree.nodes[w],L=n.left,R=n.right;if(!changed(L)&&!changed(R))return;const overlap=intersects(L,R);if(changed(L)&&!leaf(L))self(L.children);if(changed(R)&&!leaf(R))self(R.children);if(overlap)dispatch(L,R);}
 self(0);
 return{candidates,diagnostics:{scope:'owned-current-source-bvtt',sourceRevision:SOURCE,sourceOwnedTree:true,candidateCount:candidates.length}};
}

const api=Object.freeze({firstInsert,changedLeafCandidates,sourceTreeCandidates,CAPACITY,SOURCE_REVISION:SOURCE});
G.LabCueBvhInsertionExperimental=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
