/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2020 Sébastien Crozet. Modified 2026.
 * Bounded source port of Parry 0.31.1 partitioning/bvh/{bvh_tree,bvh_insert,
 * bvh_refit,bvh_optimize,bvh_binned_build,bvh_traverse}.rs and Rapier revision
 * b716d375efc0201003f0cd9ef7168eee0b62c177 geometry/broad_phase_bvh/{mod,update}.rs.
 * glam midpoint is MIT OR Apache-2.0. See vendor/RAPIER-LICENSE.txt.
 * Owns evolving tree topology, flags and scheduling, NOT a physics world.
 * Inputs are current owned AABBs/operation order, never a later native BVH.
 */
(function(G) {
'use strict';
const common=typeof module!=='undefined'&&module.exports;
const Graph=common?require('./experimental-arithmetic-graph'):G.LabArithmeticGraphExperimental;
const Runtime=common?require('./experimental-stage-runtime'):G.LabStageRuntimeExperimental;
const First=common?require('./experimental-cue-bvh-insertion'):G.LabCueBvhInsertionExperimental;
const SOURCE='b716d375efc0201003f0cd9ef7168eee0b62c177';
const MASK=0x3fffffff,CHANGED=0x40000000,PENDING=0xc0000000,MAX=3.4028234663852886e38;
const queryReceipts=new WeakMap(),stageBrands=new WeakMap();
const MAX_LEAVES=27,MAX_TEMP_WIDE=96,copy=x=>structuredClone(x),f=Math.fround;
const need=(p,m)=>{if(!p)throw RangeError('Owned CCD BVH: '+m);};
const uint=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
const count=n=>n.data&MASK,isLeaf=n=>count(n)===1,pending=n=>(n.data>>>30)===3;
const at=(t,i)=>t.nodes[i>>>1][i&1?'right':'left'];
const put=(t,i,n)=>{t.nodes[i>>>1][i&1?'right':'left']=n;};
const nodeCopy=n=>({mins:n.mins.slice(),maxs:n.maxs.slice(),data:n.data,children:n.children});
const zero=()=>({mins:[0,0,0],maxs:[0,0,0],data:0,children:0});
const wideZero=()=>({left:zero(),right:zero()});
const box=(n,c=count(n))=>({min:n.mins.slice(),max:n.maxs.slice(),count:c});
const mergeBox=(a,b)=>({min:a.min.map((x,i)=>Math.min(x,b.min[i])),max:a.max.map((x,i)=>Math.max(x,b.max[i]))});
function merge(a,b,children){const q=mergeBox(box(a),box(b));return{mins:q.min,maxs:q.max,children,data:((count(a)+count(b))|(((a.data>>>30)|(b.data>>>30))<<30))>>>0};}
function resolve(n){n.data=(count(n)|(pending(n)?CHANGED:0))>>>0;}
const contains=(n,b)=>n.mins.every((x,i)=>x<=b.min[i]&&n.maxs[i]>=b.max[i]);
const intersects=(n,b)=>n.mins.every((x,i)=>x<=b.max[i]&&n.maxs[i]>=b.min[i]);
function validateBox(b){need(b&&Array.isArray(b.min)&&Array.isArray(b.max)&&b.min.length===3&&b.max.length===3,'three-coordinate AABB required');need([...b.min,...b.max].every(x=>Number.isFinite(x)&&x===f(x)&&Math.abs(x)<=1000)&&b.min.every((x,i)=>x<=b.max[i]),'bounded ordered exact f32 AABB required');return b;}
function validateTree(t,{tight=false}={}) {
 need(t&&Array.isArray(t.nodes)&&t.nodes.length>0&&t.nodes.length<=MAX_TEMP_WIDE,'bounded nonempty source tree required');
 need(Array.isArray(t.parents)&&t.parents.length===t.nodes.length&&t.parents.every(uint)&&t.parents[0]===0,'packed source parents required');
 const m=t.leaf_node_indices;need(m&&m.n>=22&&m.n<=MAX_LEAVES&&Array.isArray(m.v)&&m.v.length<=MAX_LEAVES&&m.v.every(x=>x===null||uint(x)),'bounded original22..27 leaf map required');
 need(t.optimization&&uint(t.optimization.rebuild_frame_index)&&uint(t.optimization.rebuild_start_index),'optimizer state required');
 need(Array.isArray(t.free_wide_nodes)&&t.free_wide_nodes.every(x=>uint(x)&&x>0&&x<t.nodes.length)&&new Set(t.free_wide_nodes).size===t.free_wide_nodes.length,'unique source free wide nodes required');
 const ws=new Set(),ls=new Set();
 function walk(w,parent){need(w<t.nodes.length&&!ws.has(w),'invalid or repeated tree link');ws.add(w);need(w===0||t.parents[w]===parent,'parent mismatch');let total=0;
  for(let side=0;side<2;side++){const n=at(t,w*2+side);need(n&&uint(n.data)&&uint(n.children)&&(n.data>>>30)!==2,'source node fields required');validateBox(box(n));const c=count(n);need(c>0&&c<=MAX_LEAVES,'reachable nonempty node required');total+=c;
   if(isLeaf(n)){need(n.children<MAX_LEAVES&&!ls.has(n.children)&&m.v[n.children]===w*2+side,'source leaf map mismatch');ls.add(n.children);}else{need(n.children!==0,'internal root cycle');need(walk(n.children,w*2+side)===c,'source subtree count mismatch');if(tight){const children=t.nodes[n.children],merged=merge(children.left,children.right,n.children);need(n.mins.every((x,i)=>Object.is(x,merged.mins[i])&&Object.is(n.maxs[i],merged.maxs[i])),'source refit bounds mismatch');}}
  }return total;
 }
 need(walk(0,0)===m.n&&ls.size===m.n&&m.v.filter(x=>x!==null).length===m.n,'source total leaf count mismatch');
 for(let i=0;i<t.nodes.length;i++)if(!ws.has(i)){need(t.free_wide_nodes.includes(i),'untracked orphan node');need([t.nodes[i].left,t.nodes[i].right].every(n=>n.data===0&&n.children===0&&n.mins.every(x=>x===0)&&n.maxs.every(x=>x===0)),'free node not zeroed');}
 need(t.free_wide_nodes.every(i=>!ws.has(i)),'free node is reachable');return t;
}
function relocate(t,n,packed){if(isLeaf(n))t.leaf_node_indices.v[n.children]=packed;else t.parents[n.children]=packed;}
function alloc(t,n,parent){if(t.free_wide_nodes.length){const i=t.free_wide_nodes.pop();t.nodes[i]=n;t.parents[i]=parent;return i;}need(t.nodes.length<MAX_TEMP_WIDE,'temporary wide-node capacity exceeded');t.parents.push(parent);return t.nodes.push(n)-1;}
function remove(t,id){const p=t.leaf_node_indices.v[id];if(p==null)return false;t.leaf_node_indices.v[id]=null;t.leaf_node_indices.n--;const w=p>>>1,sibling=nodeCopy(at(t,p^1));
 if(w===0){need(!isLeaf(sibling),'bounded domain cannot remove to partial root');const old=sibling.children;t.nodes[0]=copy(t.nodes[old]);t.nodes[old]=wideZero();t.free_wide_nodes.push(old);relocate(t,t.nodes[0].left,0);relocate(t,t.nodes[0].right,1);}
 else{const parent=t.parents[w];relocate(t,sibling,parent);put(t,parent,sibling);t.nodes[w]=wideZero();t.free_wide_nodes.push(w);let curr=parent>>>1;while(curr!==0){const p=t.parents[curr],n=t.nodes[curr];put(t,p,merge(n.left,n.right,curr));curr=p>>>1;}}
 return true;
}
function fullRefit(t,resolveFlags=true){const source=t.nodes,target=[],parents=[];
 function visit(w,parent){const id=target.length;target.push(wideZero());parents.push(parent);for(let side=0;side<2;side++){const n=source[w][side?'right':'left'];if(isLeaf(n)){const c=nodeCopy(n);if(resolveFlags)resolve(c);target[id][side?'right':'left']=c;t.leaf_node_indices.v[c.children]=id*2+side;}else{const child=visit(n.children,id*2+side),wide=target[child];target[id][side?'right':'left']=merge(wide.left,wide.right,child);}}return id;}
 visit(0,0);t.nodes=target;t.parents=parents;t.free_wide_nodes=[];
}
function partialRefit(t,previous,current){for(const id of previous){const p=t.leaf_node_indices.v[id];if(p!=null){const n=at(t,p);if(!pending(n)&&(n.data>>>30)===1)resolve(n);}}
 for(const id of current){const p=t.leaf_node_indices.v[id];if(p!=null&&pending(at(t,p)))resolve(at(t,p));}
 for(const id of [...previous,...current]){const p=t.leaf_node_indices.v[id];if(p==null)continue;let w=p>>>1;while(w!==0){const parent=t.parents[w],n=t.nodes[w],m=merge(n.left,n.right,w);if((m.data>>>30)!==0)m.data=(count(m)|CHANGED)>>>0;put(t,parent,m);w=parent>>>1;}}
}
function builder(n){const nodes=[],op=(kind,...args)=>{nodes.push({kind,args});return n+nodes.length-1;};return{op,c:x=>op('const',f(x)),done:outputs=>({inputFloats:n,nodes,outputs})};}
function plans(){
 let b=builder(14),o=b.op,volume=i=>o('mul',o('mul',o('sub',i+3,i),o('sub',i+4,i+1)),o('sub',i+5,i+2));const score=b.done([o('add',o('mul',volume(0),6),o('mul',volume(7),13))]);
 b=builder(2);const difference=b.done([b.op('sub',0,1)]);
 b=builder(7);const fatten=b.done([0,1,2].map(i=>b.op('sub',i,6)).concat([3,4,5].map(i=>b.op('add',i,6))));
 b=builder(6);const half=b.c(.5),center=b.done([0,1,2].map(i=>b.op('mul',b.op('add',i,i+3),half)));
 b=builder(2);const eight=b.c(8),one=b.c(1),eps=b.c(1e-5),scale=b.done([b.op('div',b.op('mul',eight,b.op('sub',one,eps)),b.op('sub',1,0))]);
 b=builder(3);const bin=b.done([b.op('mul',0,b.op('sub',1,2))]);
 return Object.freeze({score,difference,fatten,center,scale,bin});
}
const PLANS=plans();
async function makeArithmetic(device){const programs={};
 if(!device)return{backend:'cpu-reference',async run(kind,rows){const p=PLANS[kind];need(p,'known math program required');return rows.map(r=>Array.from(Graph.execute(Float32Array.from(r),p)));},dispose(){}};
 try{for(const[k,p]of Object.entries(PLANS))programs[k]=await Runtime.createResidentGraph(device,p,{maxRows:256,label:'source BVH '+k});}
 catch(error){Object.values(programs).forEach(p=>p.dispose());throw error;}
 return{backend:'webgpu',async run(kind,rows){
  const p=PLANS[kind],q=programs[kind];need(p&&rows.length<=256,'bounded math program rows required');
  const input=new Float32Array(rows.length*p.inputFloats);rows.forEach((r,i)=>{need(r.length===p.inputFloats&&r.every(Number.isFinite),'finite graph input stride required');input.set(r,i*p.inputFloats);});
  const raw=await q.run(input),stride=p.outputs.length+1;return rows.map((_,i)=>Array.from(raw.slice(i*stride,i*stride+p.outputs.length)));
 },dispose(){Object.values(programs).forEach(p=>p.dispose());}};
}
async function score(math,rows){return(await math.run('score',rows.map(({a,b})=>[...a.min,...a.max,a.count,...b.min,...b.max,b.count]))).map(r=>r[0]);}
async function fatten(math,b,skin){const r=(await math.run('fatten',[[...b.min,...b.max,skin]]))[0];return{min:r.slice(0,3),max:r.slice(3,6)};}
async function rotate(tree,w,math,diagnostics){
  const n=tree.nodes[w],L=nodeCopy(n.left),R=nodeCopy(n.right),rows=[{a:box(L),b:box(R)}],choices=[];
  for(const[A,B]of[[L,R],[R,L]]){
   if(isLeaf(A)){choices.push(null);continue;}
   const C=tree.nodes[A.children],l=nodeCopy(C.left),r=nodeCopy(C.right),start=rows.length;
   rows.push({a:box(l),b:{...mergeBox(box(r),box(B)),count:count(r)+count(B)}},{a:box(r),b:{...mergeBox(box(l),box(B)),count:count(l)+count(B)}});choices.push({start});
  }
  // Leaf/leaf has no eligible rotation and performs no floating-point score.
  if(choices.every(x=>x===null))return;
  const values=await score(math,rows),deltas=[],selected=[];
  for(const c of choices){if(c===null){selected.push(null);continue;}const upLeft=values[c.start]<values[c.start+1],score=values[c.start+(upLeft?0:1)];selected.push({upLeft,slot:deltas.length});deltas.push([score,values[0]]);}
  const diff=(await math.run('difference',deltas)).map(r=>r[0]),d0=selected[0]?diff[selected[0].slot]:MAX,d1=selected[1]?diff[selected[1].slot]:MAX;
  if(!(d0<0||d1<0))return;
  if(d0<d1){
   const id=L.children,C={left:nodeCopy(tree.nodes[id].left),right:nodeCopy(tree.nodes[id].right)};tree.parents[id]=w*2+1;
   if(selected[0].upLeft){tree.nodes[w].left=C.left;tree.nodes[id].left=R;relocate(tree,C.left,w*2);relocate(tree,R,id*2);}
   else{tree.nodes[w].left=C.right;tree.nodes[id].right=R;relocate(tree,C.right,w*2);relocate(tree,R,id*2+1);}
   tree.nodes[w].right=merge(tree.nodes[id].left,tree.nodes[id].right,id);
  }else{
   const id=R.children,C={left:nodeCopy(tree.nodes[id].left),right:nodeCopy(tree.nodes[id].right)};tree.parents[id]=w*2;
   if(selected[1].upLeft){tree.nodes[w].right=C.left;tree.nodes[id].left=L;relocate(tree,C.left,w*2+1);relocate(tree,L,id*2);}
   else{tree.nodes[w].right=C.right;tree.nodes[id].right=L;relocate(tree,C.right,w*2+1);relocate(tree,L,id*2+1);}
   tree.nodes[w].left=merge(tree.nodes[id].left,tree.nodes[id].right,id);
  }
  diagnostics.rotations++;
 }
async function insertNew(t,b,id,math,diag){need(t.leaf_node_indices.v[id]==null,'fresh insertion requires absent leaf');const m=t.leaf_node_indices;while(m.v.length<=id)m.v.push(null);m.v[id]=0;m.n++;
 let w=0,depth=0;for(;;){need(++depth<=MAX_LEAVES,'insertion depth exceeded');await rotate(t,w,math,diag);const n=t.nodes[w],L=n.left,R=n.right,lc=count(L),rc=count(R),costs=await score(math,[{a:{...mergeBox(box(L),b),count:lc+1},b:box(R)},{a:{...mergeBox(box(R),b),count:rc+1},b:box(L)}]);
  const left=costs[0]<costs[1]||(costs[0]===costs[1]&&lc<rc),side=left?'left':'right',old=nodeCopy(n[side]);
  if(isLeaf(old)){const fresh={mins:b.min.slice(),maxs:b.max.slice(),data:(PENDING|1)>>>0,children:id},wide=left?{left:old,right:fresh}:{left:fresh,right:old},child=alloc(t,wide,w*2+(left?0:1));m.v[old.children]=child*2+(left?0:1);m.v[id]=child*2+(left?1:0);const merged=mergeBox(box(old),b);n[side]={mins:merged.min,maxs:merged.max,children:child,data:(old.data+1)>>>0};return;}
  n[side].data=(n[side].data+1)>>>0;n[side].mins=n[side].mins.map((x,i)=>Math.min(x,b.min[i]));n[side].maxs=n[side].maxs.map((x,i)=>Math.max(x,b.max[i]));w=old.children;
 }
}
async function updateLeaf(t,u,reinsert,propagate,math,diag){const p=t.leaf_node_indices.v[u.leaf];if(p==null)return null;const n=at(t,p);
 if(reinsert){if(contains(n,u.box))return'Unchanged';remove(t,u.leaf);await insertNew(t,await fatten(math,u.box,u.skin),u.leaf,math,diag);return'UpdatedInPlace';}
 if(u.skin>0){if(contains(n,u.box))return'Unchanged';const b=await fatten(math,u.box,u.skin);n.mins=b.min;n.maxs=b.max;n.data=(n.data|PENDING)>>>0;}else{n.mins=u.box.min.slice();n.maxs=u.box.max.slice();}
 // Source set_aabb expands ancestors by the raw input, not the fat leaf.
 if(propagate){let w=p>>>1;while(w!==0){const parent=t.parents[w],ancestor=at(t,parent);if(contains(ancestor,u.box))break;ancestor.mins=ancestor.mins.map((x,i)=>Math.min(x,u.box.min[i]));ancestor.maxs=ancestor.maxs.map((x,i)=>Math.max(x,u.box.max[i]));w=parent>>>1;}}
 return'UpdatedInPlace';
}
// Rust BinaryHeap compares only score, never id. On equal children sift-down
// selects the right child; push leaves equal parents untouched. as_slice order
// is observable when optimizer pseudo-leaves drain the remaining heap.
function heapPush(heap,item){let i=heap.length;heap.push(item);while(i>0){const p=(i-1)>>>1;if(item.score<=heap[p].score)break;heap[i]=heap[p];i=p;}heap[i]=item;}
function heapPop(heap){if(!heap.length)return null;const root=heap[0],item=heap.pop();if(!heap.length)return root;const end=heap.length;let i=0,child=1;
 while(child<=end-2){if(heap[child].score<=heap[child+1].score)child++;heap[i]=heap[child];i=child;child=i*2+1;}
 if(child===end-1){heap[i]=heap[child];i=child;}while(i>0){const p=(i-1)>>>1;if(item.score<=heap[p].score)break;heap[i]=heap[p];i=p;}heap[i]=item;return root;
}
function collectLeaves(t,w,out=[]){const n=t.nodes[w];for(const c of[n.left,n.right])if(isLeaf(c))out.push(nodeCopy(c));else collectLeaves(t,c.children,out);return out;}
async function rebuildBinned(t,target,leaves,math,diag){need(leaves.length>1&&leaves.length<=MAX_LEAVES,'bounded binned leaf range required');diag.binnedRebuilds++;
 const centers=await math.run('center',leaves.map(n=>[...n.mins,...n.maxs]));const lo=[0,1,2].map(i=>Math.min(...centers.map(c=>c[i]))),hi=[0,1,2].map(i=>Math.max(...centers.map(c=>c[i]))),ext=(await math.run('difference',lo.map((x,i)=>[hi[i],x]))).map(r=>r[0]);let axis=0;if(ext[1]>ext[axis])axis=1;if(ext[2]>ext[axis])axis=2;
 let binIds;if(ext[axis]===0){binIds=leaves.map(()=>0);}else{const k1=(await math.run('scale',[[lo[axis],hi[axis]]]))[0][0],values=(await math.run('bin',centers.map(c=>[k1,c[axis],lo[axis]]))).map(r=>r[0]);binIds=values.map(x=>Math.min(7,Math.max(0,Math.trunc(x))));}
 const bins=Array.from({length:8},()=>({b:null,n:0}));leaves.forEach((n,i)=>{const b=bins[binIds[i]];b.b=b.b?mergeBox(b.b,box(n)):box(n);b.n++;});
 const prefix=[],suffix=[];let b=null,n=0;for(let i=0;i<8;i++){if(bins[i].b)b=b?mergeBox(b,bins[i].b):copy(bins[i].b);n+=bins[i].n;prefix[i]={b:copy(b),n};}b=null;n=0;for(let i=7;i>=0;i--){if(bins[i].b)b=b?mergeBox(b,bins[i].b):copy(bins[i].b);n+=bins[i].n;suffix[i]={b:copy(b),n};}
 // Empty source bins have invalid +/-MAX bounds: their volume*0 becomes
 // NaN, so they cannot win '< best_cost'. Exclude only those exact NaN rows.
 const planes=[];for(let i=0;i<7;i++)if(prefix[i].n&&suffix[i+1].n)planes.push(i);
 const costs=await score(math,planes.map(i=>({a:{...prefix[i].b,count:prefix[i].n},b:{...suffix[i+1].b,count:suffix[i+1].n}})));let best=MAX,bestPlane=0,mid=bins[0].n;planes.forEach((p,i)=>{if(costs[i]<best){best=costs[i];bestPlane=p;mid=prefix[p].n;}});
 if(mid===0||mid===leaves.length)mid=Math.floor(leaves.length/2);else{let left=0,right=mid;while(left!==mid&&right!==leaves.length){while(left!==mid&&binIds[left]<=bestPlane)left++;if(left===mid)break;while(right!==leaves.length&&binIds[right]>bestPlane)right++;if(right===leaves.length)break;[leaves[left],leaves[right]]=[leaves[right],leaves[left]];[binIds[left],binIds[right]]=[binIds[right],binIds[left]];left++;right++;}}
 for(let side=0;side<2;side++){const range=side?leaves.slice(mid):leaves.slice(0,mid),packed=target*2+side;if(range.length===1){put(t,packed,range[0]);relocate(t,range[0],packed);}else{need(t.nodes.length<MAX_TEMP_WIDE,'optimizer temporary capacity exceeded');const id=t.nodes.length;t.nodes.push(wideZero());t.parents.push(packed);await rebuildBinned(t,id,range,math,diag);put(t,packed,merge(t.nodes[id].left,t.nodes[id].right,id));}}
}
// Parry bvh_optimize.rs optimization_config, with each Real operation f32.
function optimizationConfig(n,frame,maxLeaves=25){need([25,27].includes(maxLeaves)&&uint(n)&&n>=22&&n<=maxLeaves&&uint(frame),'bounded original22..27 optimizer domain required');const rootMode=frame%2===0?'skip':Math.floor(frame/2)%16===0?'breadth-first':'priority-queue',sqrt=f(Math.sqrt(f(n))),targetRoot=Math.ceil(sqrt),targetSubtree=Math.ceil(f(sqrt*4)),rootCost=f(f(targetRoot*f(Math.log2(targetRoot)))/f(targetSubtree*f(Math.log2(targetSubtree)))),budget=f(f(Math.ceil(n*5/100)/targetSubtree)-rootCost),rounded=Math.max(0,Math.floor(budget+.5));return{targetRoot,targetSubtree,targetSubtreeCount:rootMode==='skip'?Math.max(1,rounded):rounded,rootMode};}

async function optimize(t,math,diag){const n=t.leaf_node_indices.n;t.optimization.rebuild_frame_index=(t.optimization.rebuild_frame_index+1)>>>0;const config=optimizationConfig(n,t.optimization.rebuild_frame_index,MAX_LEAVES),roots=[];let start=t.optimization.rebuild_start_index;
 function find(w,before){if(roots.length===config.targetSubtreeCount)return;for(const side of['left','right']){const node=t.nodes[w][side],c=count(node);if(before+c>start){if(c<config.targetSubtree){if(c>2){node.data=(node.data|PENDING)>>>0;roots.push(node.children);start+=c;}}else find(node.children,before);}before+=c;if(roots.length===config.targetSubtreeCount)return;}}
 find(0,0);if(start>=n)start=0;t.optimization.rebuild_start_index=start;
 const pseudo=[];
 if(config.rootMode==='breadth-first'){const queue=[0];while(queue.length+pseudo.length<config.targetRoot){if(!queue.length)break;const w=queue.shift();for(const node of[t.nodes[w].left,t.nodes[w].right])if(isLeaf(node)||pending(node))pseudo.push(nodeCopy(node));else queue.push(node.children);}for(const w of queue)pseudo.push(nodeCopy(t.nodes[w].left),nodeCopy(t.nodes[w].right));}
 if(config.rootMode==='priority-queue'){const heap=[];heapPush(heap,{score:MAX,id:0});while(heap.length+pseudo.length<config.targetRoot){const entry=heapPop(heap);if(!entry)break;for(const node of[t.nodes[entry.id].left,t.nodes[entry.id].right])if(isLeaf(node)||pending(node))pseudo.push(nodeCopy(node));else{const children=t.nodes[node.children],value=(await score(math,[{a:box(children.left),b:box(children.right)}]))[0];heapPush(heap,{score:value,id:node.children});}}for(const entry of heap)pseudo.push(nodeCopy(t.nodes[entry.id].left),nodeCopy(t.nodes[entry.id].right));}
 if(pseudo.length)await rebuildBinned(t,0,pseudo,math,diag);
 for(const root of roots)await rebuildBinned(t,root,collectLeaves(t,root),math,diag);
 diag.optimizerRuns++;diag.optimizerModes.push(config.rootMode);
}
function queryLeaves(tree,aabb){validateBox(aabb);const result=[],stack=[];let next=null;if(intersects(tree.nodes[0].left,aabb))next=tree.nodes[0].left;if(intersects(tree.nodes[0].right,aabb))stack.push(tree.nodes[0].right);let visits=0;
 while(next||stack.length){need(++visits<=2*MAX_LEAVES,'query visit bound exceeded');const n=next||stack.pop();next=null;if(isLeaf(n)){result.push(n.children);continue;}const child=tree.nodes[n.children];if(intersects(child.left,aabb))next=child.left;if(intersects(child.right,aabb)){if(next)stack.push(child.right);else next=child.right;}}
 return result;
}
function legacyInitialState(seed){need(seed&&seed.sourceRevision===SOURCE&&seed.sourcePipelineCompleted===true&&/^[0-9a-f]{64}$/.test(seed.initialSnapshotSha256),'original completed creation provenance required');const b=seed.initialBroadPhase;need(b&&b.frame_index===72&&b.tree?.leaf_node_indices.n===22&&b.changes_since_optimize===0&&b.reinsert_leaf_updates===true&&b.optimization_strategy==='SubtreeOptimizer'&&b.adaptive_change_detection_margin===false,'constructor72 original22-leaf source state required');need(Array.isArray(b.pending_set_aabb)&&b.pending_set_aabb.length===0&&Array.isArray(b.prev_updated_leaves)&&b.prev_updated_leaves.length===0,'completed creation has no pending broad-phase work');const t=validateTree(copy(b.tree));need(t.leaf_node_indices.v.length===22&&t.leaf_node_indices.v.every(x=>x!==null),'original collider indices0..21 required');need(Array.isArray(seed.modifiedColliders)&&seed.modifiedColliders.length===3&&seed.modifiedColliders.every(h=>h&&h.generation===0&&h.index>=22&&h.index<25)&&new Set(seed.modifiedColliders.map(h=>h.index)).size===3,'three original fresh cue colliders required');return{tree:t,frame_index:b.frame_index,changes_since_optimize:0,reinsert_leaf_updates:true,prev_updated_leaves:[],pending_set_aabb:[],deferred_optimize_pending:false,optimization_strategy:'SubtreeOptimizer',adaptive_change_detection_margin:false,fresh_order:seed.modifiedColliders.map(h=>h.index),first_update:true};}
function initialState(input){
 const fourKinds={'source-created-cue-broad-phase':'validateInitial','source-created-initial-four-ball-cue-broad-phase':'validateInitialFourBall','source-created-settled-four-ball-cue-broad-phase':'validateSettledFourBall','source-created-placed-goal-four-ball-cue-broad-phase':'validatePlacedGoalFourBall','source-created-live-registered-four-ball-cue-broad-phase':'validateLiveRegisteredFourBall','source-created-live-registered-three-ball-cue-broad-phase':'validateLiveRegisteredThreeBall'};
 const method=fourKinds[input?.kind];let state,seed=input;
 if(method){const Broad=common?require('./experimental-cue-broad-phase'):G.LabCueBroadPhaseExperimental;seed=Broad[method](input);const b=seed.initialBroadPhase,t=validateTree(copy(b.tree));state={tree:t,frame_index:b.frame_index,changes_since_optimize:0,reinsert_leaf_updates:true,prev_updated_leaves:[],pending_set_aabb:[],deferred_optimize_pending:false,optimization_strategy:b.optimization_strategy,adaptive_change_detection_margin:false,fresh_order:seed.modifiedColliders.map(h=>h.index),first_update:true};}
 else {need(seed?.colliders===undefined,'source roster requires an explicit validated creation kind');state=legacyInitialState(seed);}
 const key=h=>h.index+':'+h.generation,same=(a,b)=>key(a)===key(b);
 state.generations=seed.colliders?Object.fromEntries(seed.colliders.map(c=>[c.handle.index,c.handle.generation])):Object.fromEntries(Array.from({length:25},(_,i)=>[i,0]));
 state.removable=seed.colliders?seed.colliders.filter(c=>same(c.parent.handle,seed.roles.shaft)||same(c.parent.handle,seed.roles.head)).map(c=>c.handle.index):[22,23,24];
 state.initialLeaves=state.tree.leaf_node_indices.n;state.maximumLeaves=Object.keys(state.generations).length;state.minimumLeaves=state.maximumLeaves-state.removable.length;
 state.roster=seed.colliders?{fixed:seed.colliders.filter(c=>c.bodyType==='Fixed').map(c=>key(c.handle)),moving:seed.bodyColliders.filter(b=>!['shaft','head','guide'].some(r=>same(b.body,seed.roles[r]))).map(b=>b.colliders.map(key))}:{fixed:Array.from({length:16},(_,i)=>i+':0'),moving:[16,18,20].map(i=>[i+':0',(i+1)+':0'])};
 need(Object.keys(state.generations).length<=MAX_LEAVES&&Object.keys(state.generations).every(i=>Number(i)<MAX_LEAVES),'bounded source handle domain required');return state;
}

function updatesInput(rows){need(Array.isArray(rows)&&rows.length<=MAX_LEAVES,'bounded ordered update rows required');const seen=new Set();return rows.map(u=>{need(u&&uint(u.leaf)&&u.leaf<MAX_LEAVES&&!seen.has(u.leaf),'unique original collider leaf update required');seen.add(u.leaf);validateBox(u.box);need(u.skin===f(u.skin)&&Number.isFinite(u.skin)&&u.skin>=0&&u.skin<=1,'source skin must be finite nonnegative f32');return copy(u);});}
function idsInput(ids,name){need(Array.isArray(ids)&&ids.length<=MAX_LEAVES&&ids.every(x=>uint(x)&&x<MAX_LEAVES)&&new Set(ids).size===ids.length,name+' must be distinct original leaf indices');return ids.slice();}
function newDiagnostics(){return{sourceRevision:SOURCE,parryVersion:'0.31.1',scope:'owned-bounded-original22-to27-recurrent-bvh',rotations:0,optimizerRuns:0,optimizerModes:[],binnedRebuilds:0,fullRefits:0,partialRefits:0,updates:0,setAabbs:0,firstInsertReused:false};}
async function join(s,math,diag){if(!s.deferred_optimize_pending)return false;s.deferred_optimize_pending=false;await optimize(s.tree,math,diag);fullRefit(s.tree,false);diag.fullRefits++;return true;}
async function broadUpdate(s,input,math,diag){need(input&&Object.keys(input).every(k=>['updates','removedLeaves','forcedReinsertLeaves','liveLeaves'].includes(k)),'only owned current update operations accepted');const rows=updatesInput(input.updates),removed=idsInput(input.removedLeaves??[],'removed leaves'),forced=idsInput(input.forcedReinsertLeaves??[],'forced reinsertion leaves'),live=input.liveLeaves===undefined?null:new Set(idsInput(input.liveLeaves,'live leaves'));
 // Source update consumes any deferred task before removals or leaf changes.
 s.frame_index=(s.frame_index+1)>>>0;await join(s,math,diag);for(const id of removed){need(s.removable.includes(id),'only original cue withdrawal is supported');remove(s.tree,id);}need(s.tree.leaf_node_indices.n>=(s.first_update?s.initialLeaves:s.minimumLeaves),'original ball/fixed leaves cannot be removed');
 if(live){const expected=new Set(s.tree.leaf_node_indices.v.flatMap((p,i)=>p===null?[]:[i]));if(s.first_update)for(const u of rows)expected.add(u.leaf);need(live.size===expected.size&&[...expected].every(id=>live.has(id)),'live collider roster must exactly match current original ownership');}
 const current=[];for(const id of s.pending_set_aabb)if(live?live.has(id):s.tree.leaf_node_indices.v[id]!=null)current.push(id);s.pending_set_aabb=[];
 let forcedAny=false;const forcedPresent=new Set();for(const id of forced)if(s.tree.leaf_node_indices.v[id]!=null){remove(s.tree,id);forcedAny=true;forcedPresent.add(id);}
 const leafCount=s.tree.leaf_node_indices.n,useReinsert=s.reinsert_leaf_updates&&rows.length*16<leafCount,missing=[],statuses=[];
 const first=s.first_update;
 if(first){need(!removed.length&&!forced.length&&!current.length&&rows.length===s.fresh_order.length&&rows.every((u,i)=>u.leaf===s.fresh_order[i]&&s.tree.leaf_node_indices.v[u.leaf]==null),'first update must insert source creation queue, without mutations');
  const arithmetic={score:r=>score(math,r),difference:async r=>(await math.run('difference',r)).map(x=>x[0])};const result=await First.firstInsert(s.tree,rows.map(u=>({leaf:u.leaf,box:u.box})),arithmetic);s.tree=result.tree;current.push(...rows.map(u=>u.leaf));statuses.push(...rows.map(()=> 'Inserted'));diag.rotations+=result.diagnostics.rotations;diag.firstInsertReused=true;
 }else{
  for(const u of rows){const status=await updateLeaf(s.tree,u,useReinsert,false,math,diag);statuses.push(status);if(status===null){missing.push(u);continue;}if(status!=='Unchanged'){if(!useReinsert&&status==='UpdatedInPlace')s.changes_since_optimize=Math.min(0xffffffff,s.changes_since_optimize+1);current.push(u.leaf);}}
  for(const u of missing){need(forcedPresent.has(u.leaf),'genuinely new post-creation colliders are unsupported');await insertNew(s.tree,u.box,u.leaf,math,diag);statuses[rows.indexOf(u)]='Inserted';current.push(u.leaf);}
 }
 const numUpdated=current.length;s.reinsert_leaf_updates=numUpdated*16<s.tree.leaf_node_indices.n;s.changes_since_optimize=Math.min(0xffffffff,s.changes_since_optimize+removed.length);
 const runOptimizer=s.changes_since_optimize>0&&(numUpdated*16>=leafCount||(s.frame_index%8===0&&s.changes_since_optimize*64>=leafCount));
 const mustFull=removed.length>0||forcedAny,defer=runOptimizer&&!mustFull;if(runOptimizer)s.changes_since_optimize=0;if(runOptimizer&&!defer)await optimize(s.tree,math,diag);
 const full=mustFull||(runOptimizer&&!defer)||(numUpdated+s.prev_updated_leaves.length)*16>=s.tree.leaf_node_indices.n;
 if(first){need(full&&!runOptimizer,'source firstInsert full-refit schedule changed');diag.fullRefits++;}else if(full){fullRefit(s.tree);diag.fullRefits++;}else{partialRefit(s.tree,s.prev_updated_leaves,current);diag.partialRefits++;}
 s.prev_updated_leaves=current;s.deferred_optimize_pending=defer;s.first_update=false;diag.updates++;validateTree(s.tree);
 return{statuses,updatedLeaves:current.slice(),useReinsert,runOptimizer,deferredOptimize:defer,fullRefit:full};
}
async function setAabbs(s,rows,math,diag){need(!s.first_update,'initial creation update must happen before set_aabb');const updates=updatesInput(rows);await join(s,math,diag);const statuses=[];for(const u of updates){need(s.tree.leaf_node_indices.v[u.leaf]!=null,'set_aabb requires still-owned collider');const status=await updateLeaf(s.tree,u,s.reinsert_leaf_updates,true,math,diag);statuses.push(status);if(status!=='Unchanged'){if(!s.reinsert_leaf_updates)s.changes_since_optimize=Math.min(0xffffffff,s.changes_since_optimize+1);s.pending_set_aabb.push(u.leaf);}diag.setAabbs++;}validateTree(s.tree);return statuses;}
function publicState(s){return copy({tree:s.tree,frame_index:s.frame_index,changes_since_optimize:s.changes_since_optimize,reinsert_leaf_updates:s.reinsert_leaf_updates,prev_updated_leaves:s.prev_updated_leaves,pending_set_aabb:s.pending_set_aabb.map(index=>({index,generation:s.generations[index]})),deferred_optimize_pending:s.deferred_optimize_pending,optimization_strategy:s.optimization_strategy,adaptive_change_detection_margin:s.adaptive_change_detection_margin});}
async function create(seed,device){const state=initialState(seed),math=await makeArithmetic(device),brand={epoch:0,transaction:null,backend:math.backend};let committed=state,staged=null,diag=newDiagnostics(),stagedDiag=null,disposed=false,busy=false,version=0;
 const idle=()=>need(!disposed&&!busy,'stage is disposed or busy'),draft=()=>{idle();need(staged,'begin an owned transaction first');};
 async function mutate(fn){draft();busy=true;brand.epoch++;const next=copy(staged),nextDiag=copy(stagedDiag);try{const result=await fn(next,nextDiag);staged=next;stagedDiag=nextDiag;brand.epoch++;return result;}finally{busy=false;}}
 const stage=Object.freeze({backend:math.backend,initialSnapshotSha256:seed.initialSnapshotSha256,
  capability:Object.freeze({hostIntegerTopology:true,sourceOptimizer:true,recurrentTree:true,currentOwnedAabbsOnly:true,wholeWorld:false,sourceLeafDomain:[state.initialLeaves,state.maximumLeaves],futureNativeTreeInput:false}),
  begin(){idle();need(!staged,'transaction already begun');staged=copy(committed);stagedDiag=copy(diag);brand.transaction={};brand.epoch++;return version;},
  prepareUpdate(input){return mutate((s,d)=>broadUpdate(s,input,math,d));},
  joinDeferredOptimize(){return mutate((s,d)=>join(s,math,d));},
  setAabbs(rows){return mutate((s,d)=>setAabbs(s,rows,math,d));},
  queryLeaves(aabb){idle();const s=staged??committed;need(!s.first_update&&!s.deferred_optimize_pending,'CCD query requires created leaves and joined source optimizer');return queryLeaves(s.tree,aabb);},
  query(aabb){draft();need(!staged.first_update&&!staged.deferred_optimize_pending,'CCD query requires created leaves and joined source optimizer');const bounds=copy(validateBox(aabb)),receipt=Object.freeze({kind:'owned-ccd-bvh-query-receipt'});queryReceipts.set(receipt,{brand,epoch:brand.epoch,transaction:brand.transaction,box:bounds,leaves:queryLeaves(staged.tree,bounds),roster:staged.roster});return receipt;},
  snapshot(){idle();return publicState(committed);},preview(){draft();return publicState(staged);},
  diagnostics(){idle();return copy(stagedDiag??diag);},
  commit(){draft();committed=staged;diag=stagedDiag;staged=null;stagedDiag=null;brand.transaction=null;brand.epoch++;version++;return version;},
  abort(){idle();staged=null;stagedDiag=null;brand.transaction=null;brand.epoch++;},
  dispose(){idle();need(!staged,'abort or commit before disposal');disposed=true;brand.transaction=null;brand.epoch++;math.dispose();}
 });stageBrands.set(stage,brand);return stage;
}
function assertQueryReceipt(receipt,stage,backend,expectedBox){const r=queryReceipts.get(receipt),brand=stageBrands.get(stage);need(r&&brand&&r.brand===brand&&brand.backend===backend&&brand.transaction!==null&&r.transaction===brand.transaction&&r.epoch===brand.epoch,'current origin/backend/transaction/epoch-bound BVH query required');if(expectedBox){validateBox(expectedBox);need(['min','max'].every(k=>r.box[k].every((v,i)=>Object.is(v,expectedBox[k][i]))),'query bounds identity mismatch');}return copy({leaves:r.leaves,box:r.box,roster:r.roster});}
const api=Object.freeze({SOURCE_REVISION:SOURCE,PLANS,assertQueryReceipt,optimizationConfig,validateTree,createReferenceStage:seed=>create(seed,null),createGpuStage:(device,seed)=>{need(device,'explicit WebGPU device required');return create(seed,device);}});
G.LabCcdBvhStateExperimental=api;if(common)module.exports=api;
})(globalThis);
