/* SPDX-License-Identifier: Apache-2.0
 * Private shared-contact authority. Rapier b716d375 contact graph ownership.
 * See vendor/RAPIER-LICENSE.txt. Numerical results must come from this owner's
 * same-backend shared solver, never from caller-supplied replacement states.
 */
(function(G){'use strict';
const common=typeof module!=='undefined'&&module.exports;
const J=common?require('./experimental-contact-graph-journal'):G.LabContactGraphJournalExperimental;
const owners=new WeakMap(),results=new WeakMap(),copy=x=>structuredClone(x),key=h=>h.index+':'+h.generation,same=(a,b)=>!!a&&!!b&&key(a)===key(b);
function exact(a,b){if(Object.is(a,b))return true;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>exact(v,b[i]));if(a&&b&&typeof a==='object'&&typeof b==='object'){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&exact(a[k],b[k]));}return false;}
function record(owner,backend){const r=owners.get(owner);if(!r||r.backend!==backend||r.disposed)throw RangeError('Live matching-backend coupled contact owner required');return r;}
function assertMember(owner,phase,backend){const r=record(owner,backend);if(!r.members.has(phase))throw RangeError('Phase is not a member of this shared solver');return r;}
function activeFor(owner,phase,backend){const r=assertMember(owner,phase,backend);return !!r.pending;}
function assertDomain(owner,phase,backend,edges){const r=assertMember(owner,phase,backend);if(!r.pending)throw RangeError('Shared geometry transaction required');const view=J.viewReceipt(r.pending.transaction,backend);if(!['broad','narrow','complete'].includes(view.phase)||view.initialSnapshotSha256!==undefined&&view.initialSnapshotSha256!==r.seed.initialSnapshotSha256)throw RangeError('Live original shared graph required');
 for(const e of edges){const recognized=r.identities.some(x=>same(x.collider1,e.collider1)&&same(x.collider2,e.collider2));const cue=r.seed.contactGraphSeed.cueColliders.some(h=>same(h,e.collider1)||same(h,e.collider2));if(!recognized&&!(cue&&!e.active))throw RangeError('Unmodeled contact outside shared original roster');}
 return view;
}
function readResult(receipt,owner,phase,backend,transaction,pass){const r=assertMember(owner,phase,backend),v=results.get(receipt);if(!v||v.owner!==owner||v.pending!==r.pending||v.transaction!==transaction||v.pass!==pass||v.backend!==backend||!v.byPhase.has(phase))throw RangeError('Current source-coupled solve receipt required');return copy(v.byPhase.get(phase));}
function pairGeometryMetadata(prior,data){
 const refreshed=!!data.refreshed;
 // A retained pair can own zero manifolds. Neither pairPresent nor phase
 // preparation means pair_update performed a full geometry refresh.
 if(!refreshed)return{refreshed,manifolds:(prior?.manifolds??[]).map(({solverFlags,activeContactCount})=>({solverFlags,activeContactCount}))};
 if(!data.prepared)throw RangeError('Refreshed pair requires privately prepared geometry');
 const p=data.state;
 return{refreshed,manifolds:p.pairPresent?[{solverFlags:1,activeContactCount:+!!p.active}]:[]};
}
function cushionGeometryMetadata(prior,data,index){
 const refreshed=!!data.refreshed?.[index];
 // pair_update.rs:145-171 returns before replacing manifolds on recycling.
 // Preparing a phase is not a refresh: retain its actual zero/one-manifold list.
 if(!refreshed)return{refreshed,manifolds:(prior?.manifolds??[]).map(({solverFlags,activeContactCount})=>({solverFlags,activeContactCount}))};
 if(!data.prepared)throw RangeError('Refreshed cushion requires privately prepared geometry');
 const p=data.state.cushions[index];
 // The admitted rigid sphere/convex full refresh has one manifold per pair,
 // even when it has no active contacts. Never use this shape for cached rows.
 return{refreshed,manifolds:p.pairPresent?[{solverFlags:1,activeContactCount:+!!p.active}]:[]};
}
function floorGeometryMetadata(prior,prepared){
 const refreshed=!!prepared.metadata?.geometryRefreshed;
 // Native rigid noncomposite dispatch keeps its manifold when points clear;
 // recycling/skipped updates preserve the prior list without manufacturing it.
 if(!refreshed)return{refreshed,manifolds:(prior?.manifolds??[]).map(({solverFlags,activeContactCount})=>({solverFlags,activeContactCount}))};
 const t=prepared.state.topology;
 return{refreshed,manifolds:t.pairPresent?[{solverFlags:1,activeContactCount:+!!t.active}]:[]};
}
function geometryRows(r,shared,entries,next,token){
 const Hint=common?require('./experimental-coupled-contact-hints'):G.LabCoupledContactHintsExperimental;
 const previous=r.roster.workingSnapshot(token),view=J.viewReceipt(shared.transaction,r.backend),pairs=r.pairBindings.map(b=>({binding:b,data:b.phase.coupledGeometry(token)})),cushions=r.cushion.map(p=>p.coupledGeometry(token));
 const oldFor=e=>{const i=previous.edges.findIndex(x=>same(x.collider1,e.collider1)&&same(x.collider2,e.collider2));return i<0?null:previous.pairs[i];};
 const entry=shared.entryCollisionContext;if(!entry?.manager||!Array.isArray(entry.bodies))throw RangeError('Owned entry collision context required');
 const awakeId=entry.manager.awake_island,awakeHandles=awakeId===null?[]:entry.manager.islands.v[awakeId].bodies;
 const index=h=>r.seed.balls.findIndex(b=>same(b.body,h)),awake=h=>awakeHandles.some(b=>same(b,h)),dynamicAwake=h=>{const b=entry.bodies.find(b=>same(b.handle,h));return !!b&&b.type==='Dynamic'&&!b.activation.sleeping;},modified=h=>{const c=entry.colliders?.find(c=>same(c.handle,h));if(!c||!Number.isInteger(c.changes))throw RangeError('Exact source entry collider flags required');return c.changes>2;};
 return view.after.edges.map((e,edgeId)=>{const prior=oldFor(e),i=index(e.body2),j=index(e.body1),entryAwake=[awake(e.body1),awake(e.body2)],changed=modified(e.collider1)||modified(e.collider2);let active=0,manifolds=[],refreshed=false,visited=changed||entryAwake.some(Boolean),resolved=false;
  if(same(e.collider1,r.seed.pairSeed.floorCollider)&&i>=0&&same(e.collider2,r.seed.balls[i].collider)){const p=shared.prepared[i];({refreshed,manifolds}=floorGeometryMetadata(prior,p));resolved=true;}
  const pair=pairs.find(p=>same(r.seed.balls[p.binding.ballIndices[0]].pairCollider,e.collider1)&&same(r.seed.balls[p.binding.ballIndices[1]].pairCollider,e.collider2));if(pair){({refreshed,manifolds}=pairGeometryMetadata(prior,pair.data));resolved=true;}
  if(i>=0){const n=r.seed.cushionSeeds[i].cushions.findIndex(c=>same(c.colliderHandle,e.collider1)&&same(e.collider2,r.seed.balls[i].collider));if(n>=0){({refreshed,manifolds}=cushionGeometryMetadata(prior,cushions[i],n));resolved=true;}}
  if(r.clothCache&&same(e.collider1,r.clothBinding.collider1)&&same(e.collider2,r.clothBinding.collider2)){const data=r.clothCache.geometryMetadata(token);manifolds=data.manifolds;refreshed=data.refreshed;visited=data.visited;resolved=true;}
  if(!resolved){const empty=[...(next.emptyCuePairs??[]),...(next.emptyCueConvexPairs??[])].find(p=>same(p.collider1,e.collider1)&&same(p.collider2,e.collider2));if(empty){manifolds=empty.manifolds.map(m=>({solverFlags:m.data.solver_flags,activeContactCount:m.data.solver_contacts.length}));refreshed=!empty.cache.recycled;resolved=true;}else if(!e.active){manifolds=(prior?.manifolds??[]).map(m=>({solverFlags:m.solverFlags,activeContactCount:m.activeContactCount}));visited=false;resolved=true;}}
  if(!resolved)throw RangeError('Missing owned geometry metadata for source solver edge '+edgeId);
  let out;try{out=Hint.updateHint(prior,{entryAwake,entryDynamicAwake:[dynamicAwake(e.body1),dynamicAwake(e.body2)],colliderNeedsNarrowPhaseUpdate:changed,visited,refreshed,manifolds});}catch(error){error.message+=' edge '+edgeId+' '+JSON.stringify({e,prior,entryAwake,changed,visited,refreshed,manifolds});throw error;}return{edgeId,updated:out.updated,solverGraphDirty:out.solverGraphDirty,hint:out.hint,manifolds:out.manifolds};
 });
}
function sourceBodyStates(r,pending,flats,pass){
 const source=pending.source,indices=source.indices,allowed=new Set(['activation','activationPhase','ccdPhase','sleeping']);
 if(!Array.isArray(flats)||flats.length!==indices.length||!indices.length)throw RangeError('Exact connected-body roster required');
 const states=[],sleeping=[],awake=[];
 for(let i=0;i<flats.length;i++){
  const flat=flats[i],old=source.states[i],handle=r.seed.balls[indices[i]].body,b=source.context.bodies.find(b=>same(b.handle,handle)),entry=source.entry.bodies.find(b=>same(b.handle,handle)),row=source.bodies.find(b=>same(b.handle,handle)),slept=source.sleptBodies.some(h=>same(h,handle));
  if(!b||b.type!=='Dynamic'||typeof b.activation?.sleeping!=='boolean'||!entry)throw RangeError('Complete original source body observation required');
  const asleep=b.activation.sleeping,marker=asleep?'source-observed-sleeping':'source-observed-awake';
  if(flat.sleeping!==asleep||flat.activationPhase!==marker||!exact(flat.activation,b.activation)||flat.ccdPhase!==(pass?'source-selected-pass':'source-prediction-inactive'))throw RangeError('Exact source-observed shared body activation required');
  for(const k of new Set([...Object.keys(old),...Object.keys(flat)]))if(!allowed.has(k)&&!exact(old[k],flat[k]))throw RangeError('Numerical replacement before common solve: '+k);
  const awakeId=source.context.manager.awake_island,handles=awakeId===null?[]:source.context.manager.islands.v[awakeId].bodies;
  if(handles.some(h=>same(h,handle))===asleep||slept&&!asleep||row&&(!exact(row.activation,b.activation)||row.activationPhase!==marker))throw RangeError('Source activation disagrees with observed island membership');
  const state={...copy(old),activation:copy(b.activation),activationPhase:marker,sleeping:asleep,ccdPhase:flat.ccdPhase};
  if(pass){const Pass=common?require('./experimental-ccd-pass-authority'):G.LabCcdPassAuthorityExperimental,p=Pass.assertPass(pass,r.backend);if(old.dt!==p.collisionDt)throw RangeError('Shared collision dt differs from current CCD pass');state.dt=p.solveDt;state.ccdMode='source-selected-pass';}
  if(asleep){
   // RigidBody::sleep only writes activation and zero velocity. An unchanged
   // sleeping body is absent from observe's force rows and must keep its cache.
   if(slept){
    if(!row)throw RangeError('New source sleep requires its actual force observation');
    for(const k of['force','torque'])if(!Array.isArray(row[k])||row[k].length!==3||row[k].some(x=>!Number.isFinite(x)||x!==Math.fround(x)))throw RangeError('Exact source sleep effective force and torque required');
    state.linear=[0,0,0];state.angular=[0,0,0];state.force=copy(row.force);
    if(state.ccdBody){state.ccdBody.force=copy(row.force);state.ccdBody.torque=copy(row.torque);}
   }else if(row||old.sleeping!==true||entry.activation?.sleeping!==true||[...old.linear,...old.angular].some(x=>x!==0))throw RangeError('Unchanged source sleeping body must retain its zero-velocity entry state');
   sleeping.push(i);
  }else{if(!row)throw RangeError('Source awake shared body requires an actual observation');awake.push(i);}
  states.push(state);
 }
 return{states,sleeping,awake};
}
function retainedWakeUnselected(r,pending,binding,data,edge){
 const pair=pending.roster.pairs[edge];
 // pair_update skips a retained all-asleep edge before deferred transitions
 // wake its island. Its count-cleared hint/absent GraphPos remains authoritative
 // until the next narrow pass, even though the common bodies now integrate.
 return data.refreshed===false&&binding.ballIndices.every(i=>pending.source.entry.bodies.find(b=>same(b.handle,r.seed.balls[i].body))?.activation.sleeping===true)
  &&!!pair&&(pair.hint&0x7fff)===0&&pair.manifolds.length===1&&pair.manifolds[0].activeContactCount===1&&(pair.manifolds[0].solverFlags&1)!==0&&pair.manifolds[0].graphPos===0xffffffff
  &&!pending.roster.contactOrder.some(row=>row.edge===edge);
}
async function solvePrepared(owner,shared,flats,token,pass){
 const r=record(owner,owner.backend),pending=r.pending;if(!pending||pending.transaction!==shared.transaction||pending.shared!==shared||pending.pass!==pass||!pending.roster||!pending.source||pending.solved)throw RangeError('Observed shared source solve required');
 const indices=pending.source.indices,{states,sleeping,awake}=sourceBodyStates(r,pending,flats,pass),asleep=new Set(sleeping),view=J.viewReceipt(shared.transaction,r.backend),pairData=r.pairBindings.map(b=>({binding:b,data:b.phase.coupledGeometry(token)})),railData=r.cushion.map(p=>p.coupledGeometry(token)),specs=[],contacts=[],refs=[];
 const local=body=>indices.findIndex(i=>same(r.seed.balls[i].body,body)),solverLocal=i=>awake.indexOf(i);
 // Active dynamic edges represent persistent touching components. Native sleep
 // commits whole islands; do not silently split a crossing constraint.
 for(const e of view.after.edges)if(e.active){const a=local(e.body1),b=local(e.body2),dynamic=r.seed.balls.some(x=>same(x.body,e.body1));if(dynamic&&(a>=0||b>=0)&&(a<0||b<0||asleep.has(a)!==asleep.has(b)))throw RangeError('Active source contact crosses awake/sleeping component boundary');
  const affected=[a,b].filter(i=>i>=0);if(affected.length&&affected.every(i=>asleep.has(i)&&pending.source.entry.bodies.find(x=>same(x.handle,r.seed.balls[indices[i]].body))?.activation.sleeping)){
   const changed=[e.collider1,e.collider2].some(h=>{const c=pending.source.entry.colliders?.find(c=>same(c.handle,h));if(!c||!Number.isInteger(c.changes))throw RangeError('Exact source entry collider flags required');return c.changes>2;});
   if(changed)throw RangeError('Modified sleeping contact requires unsupported source geometry refresh');
  }
 }
 for(const row of pending.roster.contactOrder){const e=view.after.edges[row.edge],a=local(e.body1),b=local(e.body2);if(a<0&&b<0)continue;const dynamic=r.seed.balls.some(x=>same(x.body,e.body1));if(b<0||dynamic&&a<0)throw RangeError('Selected source constraint crosses connected solver roster');if(asleep.has(b)||dynamic&&asleep.has(a))throw RangeError('Sleeping source contact remains in solver selection');let cache,kind;
  if(same(e.collider1,r.seed.pairSeed.floorCollider)){cache=states[b];kind='cloth';}
  else if(dynamic){const p=pairData.find(p=>same(r.seed.balls[p.binding.ballIndices[0]].pairCollider,e.collider1)&&same(r.seed.balls[p.binding.ballIndices[1]].pairCollider,e.collider2));if(!p?.data.prepared||!p.data.state.active)throw RangeError('Selected pair lacks privately prepared manifold');cache=p.data.state;kind='dynamic-sphere';}
  else{const global=indices[b],n=r.seed.cushionSeeds[global].cushions.findIndex(c=>same(c.colliderHandle,e.collider1));if(n<0||!railData[global].prepared)throw RangeError('Selected fixed contact lacks prepared convex geometry');cache=railData[global].state.cushions[n];kind='static-convex';}
  specs.push({kind,body1:dynamic?solverLocal(a):null,body2:solverLocal(b)});contacts.push({...copy(cache),kind});refs.push(row.edge);
 }
 const byEdge=new Map();
 if(awake.length){
  const MathStage=common?require('./experimental-coupled-contact-math'):G.LabCoupledContactMathExperimental,first=states[awake[0]],config={bodyCount:awake.length,substeps:first.substeps,pgsIterations:first.pgsIterations,stabilizationIterations:first.stabilizationIterations,contacts:specs,contactOrder:specs.map((_,i)=>i)},id=JSON.stringify(config);
  if(!r.math.has(id)){if(r.math.size>=64)throw RangeError('Bounded shared solver plan capacity exceeded');r.math.set(id,r.device?await MathStage.createGpuMathStage(r.device,config):MathStage.createReferenceMathStage(config));}
  const out=await r.math.get(id).step({...first,bodies:awake.map(i=>states[i]),contacts});
  awake.forEach((i,j)=>Object.assign(states[i],copy(out.bodies[j])));refs.forEach((edge,i)=>byEdge.set(edge,out.contacts[i]));
 }
 for(const i of awake){const edge=view.after.edges.findIndex(e=>same(e.collider1,r.seed.pairSeed.floorCollider)&&same(e.collider2,r.seed.balls[indices[i]].collider)),value=byEdge.get(edge);if(value){const {basis,...fields}=value;Object.assign(states[i],copy(fields));}}
 const byPhase=new Map(),sleepMetadata={kind:'source-observed-component-sleep'};
 for(const {binding,data}of pairData)if(data.prepared&&data.state.active){
  const locals=binding.ballIndices.map(i=>indices.indexOf(i));if(locals.some(i=>i<0))throw RangeError('Active prepared pair omitted from common component');
  const phaseStates=locals.map(i=>copy(states[i]));
  if(locals.every(i=>asleep.has(i))){byPhase.set(binding.phase,{states:phaseStates,pair:copy(data.state),metadata:copy(sleepMetadata)});continue;}
  const edge=view.after.edges.findIndex(e=>same(e.collider1,r.seed.balls[binding.ballIndices[0]].pairCollider)&&same(e.collider2,r.seed.balls[binding.ballIndices[1]].pairCollider)),value=byEdge.get(edge);
  if(!value){if(!retainedWakeUnselected(r,pending,binding,data,edge))throw RangeError('Active prepared pair omitted from common solve');byPhase.set(binding.phase,{states:phaseStates,pair:copy(data.state),metadata:{kind:'source-retained-wake-contact-unselected'}});continue;}
  const {basis,...fields}=value,pair={...copy(data.state),...copy(fields),solverColor:pending.roster.pairs[edge].solverColor};byPhase.set(binding.phase,{states:phaseStates,pair});
 }
 const seal=[];
 for(let i=0;i<railData.length;i++)if(railData[i].prepared){const data=railData[i],at=indices.indexOf(i);
  if(at>=0&&asleep.has(at)){byPhase.set(r.cushion[i],{state:copy(states[at]),cushions:copy(data.state.cushions),metadata:copy(sleepMetadata)});continue;}
  if(!data.state.cushions.some(c=>c.active)){seal.push(r.cushion[i]);continue;}
  if(at<0)throw RangeError('Active prepared cushion omitted from common component');
  const caches=copy(data.state.cushions);for(let n=0;n<caches.length;n++){const edge=view.after.edges.findIndex(e=>same(e.collider1,r.seed.cushionSeeds[i].cushions[n].colliderHandle)&&same(e.collider2,r.seed.balls[i].collider));if(edge>=0){caches[n].solverColor=pending.roster.pairs[edge].solverColor;const value=byEdge.get(edge);if(value){const {basis,...fields}=value;Object.assign(caches[n],copy(fields));}}}byPhase.set(r.cushion[i],{state:copy(states[at]),cushions:caches});
 }
 const receipt=Object.freeze({kind:'owned-common-contact-solve'});results.set(receipt,{owner,pending,transaction:shared.transaction,pass,backend:r.backend,byPhase});
 for(const phase of seal)phase.sealCoupledGeometry(token,pass);
 for(const [phase,out]of byPhase)await phase[out.metadata?.kind===sleepMetadata.kind?'acceptCoupledSleep':'acceptCoupledSolve'](receipt,token,pass);
 pending.solved=true;return{states,backend:r.backend,sourceContactOrder:copy(pending.roster.contactOrder)};
}
// Construction binds only the original dormant source stages. A pending
// transaction cannot be replaced, and no API accepts numerical result objects.
function createAuthority(seed,pairBindings,cushion,backend,device=null){
 const Roster=common?require('./experimental-solver-contact-roster'):G.LabSolverContactRosterExperimental;
 if(!['cpu-reference','webgpu'].includes(backend)||!Array.isArray(seed.balls)||seed.balls.length!==4||pairBindings.length!==6||cushion.length!==4||!/^[a-f0-9]{64}$/.test(seed.initialSnapshotSha256))throw RangeError('Complete original four-ball coupled roster required');
 const identities=[];for(const b of seed.balls)identities.push({collider1:seed.pairSeed.floorCollider,collider2:b.collider});
 for(const p of pairBindings)identities.push({collider1:seed.balls[p.ballIndices[0]].pairCollider,collider2:seed.balls[p.ballIndices[1]].pairCollider});
 for(let i=0;i<4;i++)for(const c of seed.cushionSeeds[i].cushions)identities.push({collider1:c.colliderHandle,collider2:seed.balls[i].collider});
 const r={seed,backend,device,math:new Map(),pairBindings,cushion,roster:Roster.createRoster(seed.solverContactRoster,{backend}),members:new Set([...pairBindings.map(b=>b.phase),...cushion]),identities,pending:null,disposed:false};
 const api={backend,bindClothContact(cache){const C=common?require('./experimental-cue-cloth-cache'):G.LabCueClothCacheExperimental;if(r.pending||r.clothCache||!C?.isStage(cache,backend))throw RangeError('Initial owned cloth cache required');const binding=cache.binding();if(binding.initialSnapshotSha256!==seed.initialSnapshotSha256)throw RangeError('Shared cloth source identity mismatch');r.clothCache=cache;r.clothBinding=binding;r.identities.push({collider1:binding.collider1,collider2:binding.collider2});},solvePrepared:(shared,flats,token,pass)=>solvePrepared(api,shared,flats,token,pass),roster:r.roster,bind(token,journal){r.roster.claim(token);r.roster.bindGraph(journal.createProjection(token),token);for(const phase of r.members)phase.bindCoupledOwner(api,token);},begin(transaction){if(r.disposed||r.pending&&J.viewReceipt(r.pending.transaction,backend).phase!=='complete')throw Error('Shared transaction already pending');const view=J.viewReceipt(transaction,backend);if(view.phase!=='broad')throw RangeError('Exact source broad receipt required');r.pending={transaction};},observe(shared,entries,next,observed,token,pass){if(!r.pending||r.pending.transaction!==shared.transaction||r.pending.source)throw RangeError('Current unobserved shared geometry transaction required');const context=observed.context,awakeId=context.manager.awake_island,handles=awakeId===null?[]:context.manager.islands.v[awakeId].bodies,by=new Map(context.bodies.map(b=>[key(b.handle),b]));const out=r.roster.prepare({transaction:shared.transaction,pairs:geometryRows(r,shared,entries,next,token),awakeBodies:handles.map(body=>({body:copy(body),activeSetId:by.get(key(body)).ids.active_set_id})),activeSetEpoch:observed.effects.activeSetEpoch,solverGraphInvalidated:!!(observed.effects.requiresSolverGraphInvalidation||shared.graphNarrow.solverGraphInvalidated),sleptBodies:observed.effects.sleptBodies},token,pass);r.pending.roster=out;r.pending.shared=shared;r.pending.pass=pass;r.pending.source=copy({context:observed.context,bodies:observed.bodies,sleptBodies:observed.effects.sleptBodies??[],entry:shared.entryCollisionContext,indices:shared.pairBinding?.ballIndices??[],states:shared.pairResult?.states??[]});if(shared.coupledComponents&&!shared.pairPrepared){for(const phase of r.cushion){const geometry=phase.coupledGeometry(token);if(geometry.prepared){if(geometry.state.cushions.some(c=>c.active))throw RangeError('Active cushion omitted from common component');phase.sealCoupledGeometry(token,pass);}}}return out;},abort(){r.pending=null;},finish(){if(!r.pending)throw Error('No shared transaction');r.pending=null;},dispose(){if(r.pending)throw Error('Abort pending shared transaction');for(const stage of r.math.values())stage.dispose();r.math.clear();r.disposed=true;}};
 owners.set(api,r);return Object.freeze(api);
}
const api=Object.freeze({createAuthority,assertMember,activeFor,assertDomain,readResult,pairGeometryMetadata,cushionGeometryMetadata,floorGeometryMetadata});
G.LabCoupledContactOwnerExperimental=api;if(common)module.exports=api;
})(globalThis);
