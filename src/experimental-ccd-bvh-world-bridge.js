/* SPDX-License-Identifier: Apache-2.0
 * Owned original-created BVH lifecycle bridge. Rapier b716d375 source
 * physics_pipeline/{substep,solve}.rs. No later tree or operation trace input.
 */
(function(G){'use strict';
const common=typeof module!=='undefined'&&module.exports,load=(n,g)=>common?require('./'+n):G[g];
const Traverse=load('experimental-cue-bvh-insertion','LabCueBvhInsertionExperimental'),pairReceipts=new WeakMap();
const Bvh=load('experimental-ccd-bvh-state','LabCcdBvhStateExperimental'),Broad=load('experimental-cue-broad-phase','LabCueBroadPhaseExperimental'),A=load('experimental-arithmetic-graph','LabArithmeticGraphExperimental'),R=load('experimental-stage-runtime','LabStageRuntimeExperimental');
const copy=x=>structuredClone(x),f=Math.fround,key=h=>h.index+':'+h.generation,same=(a,b)=>key(a)===key(b),need=(p,m)=>{if(!p)throw RangeError('Owned BVH world bridge: '+m);};
async function evaluator(device,plan){
 if(!device)return{run:async rows=>rows.map(a=>Array.from(A.execute(Float32Array.from(a),plan))),dispose(){}};
 const graph=await R.createResidentGraph(device,plan,{maxRows:256,label:'source broad arithmetic'}),stride=plan.outputs.length+1;
 return{async run(rows){
  need(rows.length<=256,'Bounded broad arithmetic batch');const input=new Float32Array(rows.length*plan.inputFloats);
  rows.forEach((r,i)=>{need(r.length===plan.inputFloats,'Exact broad arithmetic stride');input.set(r,i*plan.inputFloats);});
  const raw=await graph.run(input);return rows.map((_,i)=>Array.from(raw.slice(i*stride,i*stride+stride-1)));
 },dispose:()=>graph.dispose()};
}

async function create(input,device){
 const validator={'source-created-initial-four-ball-cue-broad-phase':'validateInitialFourBall','source-created-settled-four-ball-cue-broad-phase':'validateSettledFourBall','source-created-placed-goal-four-ball-cue-broad-phase':'validatePlacedGoalFourBall','source-created-live-registered-four-ball-cue-broad-phase':'validateLiveRegisteredFourBall','source-created-live-registered-three-ball-cue-broad-phase':'validateLiveRegisteredThreeBall'}[input?.kind]??'validateInitial',seed=Broad[validator](input),tree=await (device?Bvh.createGpuStage(device,{...seed,sourcePipelineCompleted:true}):Bvh.createReferenceStage({...seed,sourcePipelineCompleted:true}));
 let math;try{math=await evaluator(device,Broad.PLANS.bounds);}catch(e){tree.dispose();throw e;}
 let current={first:true,live:seed.colliders.map(c=>c.handle.index)},draft=null;
 function pose(c,own){const h=c.parent.handle;if(same(h,seed.roles.shaft))return own.cue?.shaft;if(same(h,seed.roles.head))return own.cue?.head;return own.balls.find(b=>same(b.body,h));}
 async function rows(handles,own){const cs=handles.map(h=>seed.colliders.find(c=>same(c.handle,h)));const values=await math.run(cs.map(c=>{need(c&&draft.live.includes(c.handle.index),'live source collider required');const p=pose(c,own);need(p&&['Ball','Cylinder'].includes(c.shape.variant),'original moving shape and owned pose required');need(c.parent.pos_wrt_parent.rotation.every((x,i)=>x===[0,0,0,1][i]),'identity original local rotation required');const a=new Array(24).fill(0);a.splice(0,3,...p.translation);a.splice(3,4,...p.rotation);a.splice(7,3,...c.parent.pos_wrt_parent.translation);a[10]=c.shape.value.radius;a[11]=c.shape.value.half_height??0;a[12]=c.shape.variant==='Cylinder'?1:0;a[20]=seed.lengthUnit;a[21]=seed.normalizedPredictionDistance;return a;}));return cs.map((c,i)=>({leaf:c.handle.index,box:{min:values[i].slice(0,3),max:values[i].slice(3,6)},skin:f(f(.04)*seed.lengthUnit)}));}
 function colliderOrder(bodies){return bodies.flatMap(h=>{const b=seed.bodyColliders.find(b=>same(b.body,h));need(b,'original body collider order required');return b.colliders;});}
 const api={stage:tree,
  begin(){need(!draft,'transaction already open');tree.begin();draft=copy(current);},
  async collision(own){need(draft,'open transaction required');const removed=colliderOrder(own.removedBodies??[]).map(h=>h.index);draft.live=draft.live.filter(i=>!removed.includes(i));
   // The bounded application only changes velocities/forces and removes its cue.
   // Internal motion is harvested by set_aabb, not the user modified queue.
   const updates=draft.first?await rows(seed.modifiedColliders,own):[];
   await tree.prepareUpdate({updates,removedLeaves:removed,forcedReinsertLeaves:[],liveLeaves:draft.live});const beforeJoin=tree.preview(),traversal=Traverse.sourceTreeCandidates(beforeJoin.tree);draft.pairReceipt=Object.freeze({kind:'owned-source-bvtt-pair-order'});pairReceipts.set(draft.pairReceipt,{owner:api,draft,backend:tree.backend,initialSnapshotSha256:seed.initialSnapshotSha256,live:draft.live.slice(),candidates:traversal.candidates,colliders:seed.colliders.map(c=>({handle:copy(c.handle),body:copy(c.parent.handle)}))});draft.first=false;
  },
  async beforeQueries(){need(draft,'open transaction required');await tree.joinDeferredOptimize();},
  async moved(own){need(draft,'open transaction required');const handles=colliderOrder(own.activeBodyOrder).filter(h=>draft.live.includes(h.index));await tree.setAabbs(await rows(handles,own));},
  contactPairs(){need(draft?.pairReceipt,'current collision BVTT receipt required');return draft.pairReceipt;},
  ownsPairReceipt(receipt){return !!draft&&draft.pairReceipt===receipt;},
  snapshot:()=>tree.snapshot(),
  commit(){need(draft,'open transaction required');tree.commit();current=draft;draft=null;},
  abort(){tree.abort();draft=null;},
  dispose(){need(!draft,'abort transaction before disposal');math.dispose();tree.dispose();}
 };return Object.freeze(api);
}
function assertPairReceipt(receipt,owner,backend){const r=pairReceipts.get(receipt);need(r&&r.owner===owner&&r.backend===backend&&owner.ownsPairReceipt(receipt),'current matching-backend source BVTT receipt required');return copy({initialSnapshotSha256:r.initialSnapshotSha256,live:r.live,candidates:r.candidates,colliders:r.colliders});}
const api=Object.freeze({assertPairReceipt,createReferenceStage:seed=>create(seed,null),createGpuStage:(device,seed)=>create(seed,device)});G.LabCcdBvhWorldBridgeExperimental=api;if(common)module.exports=api;
})(globalThis);
