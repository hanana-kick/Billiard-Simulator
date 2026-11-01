/* SPDX-License-Identifier: Apache-2.0
 * Conservative order-independence proof around source Parry CCD casts.
 * Optional branded owned-BVH receipts preserve source traversal order.
 * Without them, conservative order-independent admission is retained.
 * Caller must provide the complete, owned fat-AABB/filter-qualified candidate set.
 * Ambiguous results fail closed; no native trajectory or expected hit is accepted.
 */
(function(G){'use strict';
const common=typeof module!=='undefined'&&module.exports,T=common?require('./experimental-ccd-sweep-toi'):G.LabCcdSweepToiExperimental,B=common?require('./experimental-ccd-bvh-state'):G.LabCcdBvhStateExperimental,copy=x=>structuredClone(x);
function validate(candidates){if(!Array.isArray(candidates)||candidates.length>32)throw RangeError('Complete bounded candidate set required');const ids=new Set();return candidates.map(c=>{if(!c||Object.keys(c).some(k=>!['id','query'].includes(k))||typeof c.id!=='string'||ids.has(c.id))throw TypeError('Distinct original collider identity required');ids.add(c.id);const q=T.validate(c.query);if(q.maxFraction!==1)throw RangeError('Unrestricted initial source fraction required');return{id:c.id,query:q};});}
const accepted=(x,bound)=>Number.isFinite(x.fraction)&&x.fraction>0&&x.fraction<bound;
// Exhaustive discrete ordering is bounded to four COMPLETE qualified targets.
// This is not input sampling or a BVH guess. Every query, including an initial
// non-hit, is evaluated at every reachable tighter bound before admission.
const MAX_ORDER_PROOF_CANDIDATES=4;
async function certifyMultiple(candidates,run,first){
 if(candidates.length>MAX_ORDER_PROOF_CANDIDATES)return{admitted:false,status:'unsupported-complete-order-proof-domain',fraction:null,first,verification:[],maximumCompleteCandidates:MAX_ORDER_PROOF_CANDIDATES};
 const cache=new Map(first.map((r,i)=>[i+'/1',r])),verification=[],terminals=new Map();let ordersVerified=0,divergent=false;
 async function query(i,bound){const k=i+'/'+bound;if(cache.has(k))return cache.get(k);const result=await run(i,{...candidates[i].query,maxFraction:bound});cache.set(k,result);verification.push({id:candidates[i].id,bound,result});return result;}
 async function visit(remaining,bound,winner){if(divergent)return;if(!remaining.length){ordersVerified++;if(!terminals.has(bound))terminals.set(bound,new Set());terminals.get(bound).add(winner);divergent=terminals.size>1;return;}
  for(let p=0;p<remaining.length;p++){const i=remaining[p],result=await query(i,bound),hit=accepted(result,bound);await visit(remaining.filter((_,j)=>j!==p),hit?result.fraction:bound,hit?candidates[i].id:winner);if(divergent)return;}}
 await visit(candidates.map((_,i)=>i),1,null);
 if(divergent)return{admitted:false,status:'unsupported-order-sensitive-multiple-hits',fraction:null,first,verification,ordersVerified,terminalFractions:[...terminals.keys()]};
 const [[fraction,winners]]=terminals,winningColliders=[...winners].filter(x=>x!==null);
 return{admitted:true,status:'certified-complete-order-independent-multiple-impact',fraction,collider:winningColliders.length===1?winningColliders[0]:null,winningColliders,first,verification,ordersVerified,completeCandidates:candidates.length};
}
async function certify(candidates,run){const first=[];for(let i=0;i<candidates.length;i++)first.push(await run(i,candidates[i].query));const hits=first.flatMap((r,i)=>accepted(r,1)?[i]:[]);if(hits.length>1)return certifyMultiple(candidates,run,first);if(!hits.length)return{admitted:true,status:'certified-no-positive-impact',fraction:1,first,verification:[]};const winner=hits[0],bound=first[winner].fraction,verification=[];for(let i=0;i<candidates.length;i++){if(i===winner)continue;const result=await run(i,{...candidates[i].query,maxFraction:bound});verification.push({id:candidates[i].id,result});if(accepted(result,bound))return{admitted:false,status:'unsupported-order-sensitive-reduced-bound',fraction:null,first,verification};}return{admitted:true,status:'certified-single-positive-impact',fraction:bound,collider:candidates[winner].id,first,verification};}
// Native traversal is available only through a current, branded owned BVH
// receipt. A plain future-oracle order array is deliberately not an API.
function ownedOrder(candidates,context,backend){
 if(!context||!Array.isArray(context.movingColliderIds)||context.movingColliderIds.length!==2)throw TypeError('Original moving collider identity and order required');
 const view=B.assertQueryReceipt(context.receipt,context.stage,backend,context.bounds),byPair=new Map();
 if(!view.roster.moving.some(pair=>pair.every((id,i)=>id===context.movingColliderIds[i])))throw TypeError('Original moving collider identity and order required');
 for(let i=0;i<candidates.length;i++){const parts=candidates[i].id.split('/');if(parts.length!==2||!context.movingColliderIds.includes(parts[0])||!view.roster.fixed.includes(parts[1]))throw TypeError('Original moving/fixed identity required');const leaf=Number(parts[1].split(':')[0]),pair=parts[0]+'/'+leaf;if(byPair.has(pair))throw TypeError('Ambiguous collider generation');byPair.set(pair,i);}
 const indices=[];for(const moving of context.movingColliderIds)for(const leaf of view.leaves){const i=byPair.get(moving+'/'+leaf);if(i!==undefined)indices.push(i);}
 if(indices.length!==candidates.length||new Set(indices).size!==indices.length)throw RangeError('Complete qualified candidates must belong to current owned query');
 return indices;
}
async function sequential(candidates,run,context,backend){
 context=Object.freeze({stage:context?.stage,receipt:context?.receipt,bounds:copy(context?.bounds),movingColliderIds:copy(context?.movingColliderIds)});const indices=ownedOrder(candidates,context,backend),verification=[];let fraction=1,collider=null;
 for(const i of indices){const incoming=fraction,result=await run(i,{...candidates[i].query,maxFraction:incoming});verification.push({id:candidates[i].id,bound:incoming,result});if(accepted(result,incoming)){fraction=result.fraction;collider=candidates[i].id;}}
 // Recheck epoch after asynchronous GPU work, before publishing admission.
 ownedOrder(candidates,context,backend);
 return{admitted:true,status:'owned-source-bvh-sequential-impact',fraction,collider,verification,completeCandidates:candidates.length};
}
async function referenceOwned(input,context){const c=validate(input);return sequential(c,(_,q)=>T.reference(q),context,'cpu-reference');}
async function reference(input){const c=validate(input);return certify(c,(_,q)=>T.reference(q));}
async function createGpuStage(device,input){const c=validate(input),stages=[];let busy=false,disposed=false;try{for(const x of c)stages.push(await T.createGpuQuery(device,{pointsA:x.query.pointsA}));}catch(e){stages.forEach(s=>s.dispose());throw e;}return Object.freeze({async step(){if(busy||disposed)throw Error('CCD order proof unavailable');busy=true;try{return await certify(c,(i,q)=>stages[i].query(q));}finally{busy=false;}},dispose(){if(busy)throw Error('CCD order proof busy');if(disposed)return;disposed=true;stages.forEach(s=>s.dispose());}});}
async function createGpuEvaluator(device,roster){if(!Array.isArray(roster)||roster.length>128)throw RangeError('Bounded fixed target roster required');const stages=new Map(),points=new Map();let busy=false,disposed=false;try{for(const r of roster){if(typeof r.id!=='string'||stages.has(r.id))throw TypeError('Unique fixed target required');stages.set(r.id,await T.createGpuQuery(device,{pointsA:r.pointsA}));points.set(r.id,JSON.stringify(r.pointsA));}}catch(e){stages.forEach(s=>s.dispose());throw e;}return Object.freeze({async step(input,context){if(busy||disposed)throw Error('CCD order evaluator unavailable');const c=validate(input);for(const r of c)if(!stages.has(r.id)||points.get(r.id)!==JSON.stringify(r.query.pointsA))throw RangeError('Immutable target geometry required');busy=true;try{const run=(_,q)=>stages.get(c[_].id).query(q);return context?await sequential(c,run,context,'webgpu'):await certify(c,run);}finally{busy=false;}},dispose(){if(busy)throw Error('CCD order evaluator busy');if(disposed)return;disposed=true;stages.forEach(s=>s.dispose());}});}
const api=Object.freeze({CAPABILITY:Object.freeze({liveBvh:true,ownedQueryReceiptRequired:true,completeOwnedCandidatesRequired:true,defaultOnlyOrderIndependent:true,maximumCompleteOrderProofCandidates:MAX_ORDER_PROOF_CANDIDATES}),validate,reference,referenceOwned,createGpuStage,createGpuEvaluator});G.LabCcdOrderCertificateExperimental=api;if(common)module.exports=api;
})(globalThis);
