/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2020 Sébastien Crozet. Modified 2026: leased bounded roster port.
 * Rapier b716d375efc0201003f0cd9ef7168eee0b62c177:
 * geometry/narrow_phase/mod.rs:88-179; contacts.rs:326-415;
 * geometry/narrow_phase/solver_graph.rs:20-49,129-319,578-698;
 * geometry/narrow_phase/pair_management.rs:78-200,428-546;
 * dynamics/solver/solver_contact_graph.rs:66-202,213-227.
 * See vendor/RAPIER-LICENSE.txt. Exact host integer bookkeeping is shared by
 * the CPU and WGSL owners. This module performs NO numerical integration,
 * broad-phase discovery, narrow-phase geometry, or sleep observation.
 *
 * Contract: the common world supplies complete source-owned pair hints and
 * manifold counts after geometry, and actual post-activation awake IDs. A
 * count-cleared hint MUST NOT be reconstructed from live awake state.
 * Pair-row updated permits metadata replacement; optional solverGraphDirty is
 * the exact native dirty-list bit (when omitted, legacy updated selects it).
 * All supported original sphere pairs have at most one solver manifold; generic
 * multibody/soft contacts and overflow regrouping intentionally fail closed.
 */
(function(G){'use strict';
const Live=typeof module!=='undefined'&&module.exports?require('./experimental-live-registered-origin'):G.LabLiveRegisteredOriginExperimental;
const common=typeof module!=='undefined'&&module.exports;
const J=common?require('./experimental-contact-graph-journal'):G.LabContactGraphJournalExperimental;
const C=common?require('./experimental-ccd-pass-authority'):G.LabCcdPassAuthorityExperimental;
const REV='b716d375efc0201003f0cd9ef7168eee0b62c177',U=0xffffffff,NONE=255,OVERFLOW=128,DYNAMIC_COLORS=120,SHIFT=22,LOCAL=2**SHIFT;
// Retired reservations are not serialized or caller-supplied seed fields. Only a
// branded same-origin journal withdrawal can derive them from an owned pair.
const retiredColors=new WeakMap();
const copy=x=>structuredClone(x),same=(a,b)=>!!a&&!!b&&a.index===b.index&&a.generation===b.generation,key=h=>h.index+':'+h.generation;
function exact(a,b){if(Object.is(a,b))return true;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>exact(x,b[i]));if(a&&b&&typeof a==='object'&&typeof b==='object'){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&exact(a[k],b[k]));}return false;}
function cloneState(s){const out=copy(s);retiredColors.set(out,copy(retiredColors.get(s)??[]));return out;}
const uint=(x,name='u32')=>{if(!Number.isInteger(x)||x<0||x>U)throw TypeError('Exact '+name+' required');return x;};
function handle(h){if(!h||Object.keys(h).sort().join(',')!=='generation,index')throw TypeError('Generation-bearing handle required');uint(h.index);uint(h.generation);return h;}
function mask(x){if(typeof x==='number')throw TypeError('u128 masks must be BigInt or exact decimal strings, never Number');if(typeof x!=='bigint'&&(typeof x!=='string'||!/^\d+$/.test(x)))throw TypeError('Exact u128 mask required');const b=BigInt(x);if(b<0n||b>=(1n<<128n))throw RangeError('u128 mask out of range');return b;}
function position(bucket,local){if(!Number.isInteger(bucket)||bucket<0||bucket>128||!Number.isInteger(local)||local<0||local>=LOCAL)throw RangeError('GraphPos overflow');return bucket*LOCAL+local;}
const atPosition=p=>({bucket:Math.floor(p/LOCAL),local:p%LOCAL});
function bodyMap(s){return new Map(s.bodies.map(b=>[key(b.handle),b]));}
function validateAwake(rows,bodies){if(!Array.isArray(rows))throw TypeError('Complete source awake-body roster required');const found=new Set(),slots=new Set();return rows.map(r=>{handle(r.body);uint(r.activeSetId,'active_set_id');const b=bodies.get(key(r.body));if(!b||b.type==='Fixed'||r.activeSetId===U||found.has(key(r.body))||slots.has(r.activeSetId))throw RangeError('Distinct actual non-fixed awake slots required');found.add(key(r.body));slots.add(r.activeSetId);return copy(r);});}
function validateManifold(m,seed=false){if(!m||!Number.isInteger(m.activeContactCount)||m.activeContactCount<0||m.activeContactCount>1)throw RangeError('Only actual zero/one-point sphere manifolds supported');uint(m.solverFlags,'solver flags');if(seed){uint(m.graphPos,'GraphPos');uint(m.solverColor,'manifold solver color');if(![...Array(129).keys(),255].includes(m.solverColor))throw RangeError('Invalid manifold solver color');if(!Array.isArray(m.solverBodyIds)||m.solverBodyIds.length!==2)throw RangeError('Two solver-body IDs required');m.solverBodyIds.forEach(x=>uint(x));}return copy(m);}
function validateHint(h){if(!Number.isInteger(h)||h<0||h>65535)throw RangeError('Native u16 pair solver hint required');return h;}
function validatePair(p){if(!p||!Array.isArray(p.manifolds)||p.manifolds.length>1)throw RangeError('Only original single-manifold rigid pairs supported');validateHint(p.hint);if(!Number.isInteger(p.solverColor)||p.solverColor<0||p.solverColor>128&&p.solverColor!==255)throw RangeError('Native pair solver color required');if(!Array.isArray(p.solverColorBodies)||p.solverColorBodies.length!==2)throw TypeError('Two source color-mask owners required');p.solverColorBodies.forEach(x=>uint(x));return{hint:p.hint,solverColor:p.solverColor,solverColorBodies:p.solverColorBodies.slice(),manifolds:p.manifolds.map(m=>validateManifold(m,true))};}
function blankPair(){return{hint:0,solverColor:NONE,solverColorBodies:[U,U],manifolds:[]};}
function validate(seed){
 if(seed?.kind!=='source-single-manifold-solver-contact-roster'||seed.sourceRevision!==REV)throw RangeError('Pinned source roster seed required');
 const s=copy(seed);if(s.initialSnapshotSha256!==null&&!/^[a-f0-9]{64}$/.test(s.initialSnapshotSha256??''))throw RangeError('Original snapshot hash or explicit protocol-test null required');
 if(!Array.isArray(s.bodies)||new Set(s.bodies.map(b=>key(handle(b.handle)))).size!==s.bodies.length||new Set(s.bodies.map(b=>b.handle.index)).size!==s.bodies.length||s.bodies.some(b=>!['Fixed','Dynamic','KinematicPositionBased','KinematicVelocityBased'].includes(b.type)))throw RangeError('Complete unique source body registry required');
 const bm=bodyMap(s);if(!Array.isArray(s.edges)||!Array.isArray(s.pairs)||s.edges.length!==s.pairs.length)throw RangeError('Every dense graph edge needs source pair metadata');
 for(const e of s.edges){for(const k of['collider1','collider2','body1','body2'])handle(e[k]);if(typeof e.active!=='boolean'||!bm.has(key(e.body1))||!bm.has(key(e.body2)))throw RangeError('Complete normalized original graph required');}
 s.pairs=s.pairs.map(validatePair);if(!Array.isArray(s.bodySolverColorMasks))throw RangeError('Native u128 color masks required');s.bodySolverColorMasks=s.bodySolverColorMasks.map(x=>mask(x).toString());
 if(!Array.isArray(s.buckets)||s.buckets.length!==130||s.buckets[129].length)throw RangeError('129 rigid buckets plus empty generic bucket required');
 if(typeof s.solverGraphValid!=='boolean')throw TypeError('Explicit native graph validity required');for(const k of['activeSetEpoch','solverGraphEpoch','multibodyTopologyEpoch','solverGraphMultibodyEpoch'])uint(s[k],k);
 s.awakeBodies=validateAwake(s.awakeBodies,bm);s.sequence=0;s.revision=0;
 retiredColors.set(s,[]);assertMasks(s);if(s.solverGraphValid)assertBuckets(s);return s;
}
// Normalized initial snapshot projection only. This helper is not a decoder or
// snapshot verifier: the caller retains the existing verified initial boundary.
function seedFromSourceSnapshot(row){
 if(!row||!['strikeCreated','secondStrikeCreated','goalStrikeCreated','liveRegisteredStrikeCreated'].includes(row.boundary)||row.candidateInput!==true||row.sourceRevision!==REV||!/^[a-f0-9]{64}$/.test(row.snapshotSha256??''))throw RangeError('Verified original created boundary required, never a future solver snapshot');
 if(row.boundary==='liveRegisteredStrikeCreated')Live.assertComponentIdentity(row,row.sourceOrigin,{snapshotField:'snapshotSha256'});
 const state=row.state,np=state?.narrow_phase,arena=state?.bodies?.bodies?.items;
 if(!np||!Array.isArray(arena))throw RangeError('Complete normalized original source snapshot required');
 const bodies=arena.flatMap((slot,index)=>slot?.value?.body_type?[{handle:{index,generation:slot.generation},type:slot.value.body_type.variant??slot.value.body_type}]:[]);
 const pairs=np.contact_graph.graph.edges.map(e=>e.weight),colliders=state.colliders.colliders.items;
 const parent=h=>{const slot=colliders[h.index];if(!slot?.value||slot.generation!==h.generation)throw RangeError('Original collider generation missing');return copy(slot.value.parent.handle);};
 const edges=pairs.map(p=>{if(p.contacts.variant!=='Rigid')throw RangeError('Only original rigid source pairs supported');return{collider1:copy(p.collider1),collider2:copy(p.collider2),body1:parent(p.collider1),body2:parent(p.collider2),active:p.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0)};});
 const awakeId=state.islands.awake_island,awake=awakeId===null?[]:state.islands.islands.v[awakeId].bodies;
 const masks=np.body_solver_color_masks.map(x=>{if(typeof x==='number'){if(!Number.isSafeInteger(x)||x<0)throw RangeError('Rounded source u128 projection rejected');return String(x);}return mask(x).toString();});
 return validate({kind:'source-single-manifold-solver-contact-roster',sourceRevision:REV,initialSnapshotSha256:row.snapshotSha256,bodies,edges,pairs:pairs.map((p,i)=>({hint:np.pair_solver_hints[i],solverColor:p.contacts.value.solver_color,solverColorBodies:copy(p.contacts.value.solver_color_bodies),manifolds:p.contacts.value.manifolds.map(m=>({activeContactCount:m.data.solver_contacts.length,solverFlags:m.data.solver_flags,solverColor:m.data.solver_color,solverBodyIds:copy(m.data.solver_body_ids),graphPos:m.data.graph_pos}))})),bodySolverColorMasks:masks,buckets:copy(np.solver_contact_graph.buckets),solverGraphValid:np.solver_graph_valid,solverGraphEpoch:np.solver_graph_epoch,solverGraphMultibodyEpoch:np.solver_graph_mb_epoch,activeSetEpoch:state.islands.active_set_epoch,multibodyTopologyEpoch:state.multibody_joints.topology_epoch,awakeBodies:awake.map(body=>({body:copy(body),activeSetId:arena[body.index].value.ids.active_set_id}))});
}
function assertMasks(s){
 const expected=Array(s.bodySolverColorMasks.length).fill(0n),bm=bodyMap(s);
 s.pairs.forEach((p,i)=>{if(p.solverColor<OVERFLOW){const e=s.edges[i],ids=[e.body1,e.body2].filter(h=>bm.get(key(h)).type!=='Fixed').map(h=>h.index),owners=p.solverColorBodies.filter(x=>x!==U);if(!exact(ids,owners))throw RangeError('Pair color owners differ from exact non-fixed endpoints');for(const id of owners){if(id>=expected.length)throw RangeError('Native mask vector missing color owner');const bit=1n<<BigInt(p.solverColor);if(expected[id]&bit)throw RangeError('Same-color constraints share a non-fixed body');expected[id]|=bit;}}else if(p.solverColorBodies.some(x=>x!==U))throw RangeError('Uncolored/overflow pair cannot reserve a color mask');});
 // Rapier remove_collider drops graph nodes without clearing pair color bits.
 // Keep the invariant exact: each orphan bit needs private source-pair provenance,
 // including the original body generation, even though native masks index raw slots.
 for(const r of retiredColors.get(s)??[]){
  if(r.sourceRevision!==s.sourceRevision||r.initialSnapshotSha256!==s.initialSnapshotSha256||r.sequence>s.sequence||r.revision>s.revision||r.solverColor>=OVERFLOW||!r.withdrawn.some(h=>same(h,r.edge.collider1)||same(h,r.edge.collider2)))throw RangeError('Invalid private retired color provenance');
  const owners=[r.edge.body1,r.edge.body2].filter(h=>bm.get(key(h))?.type!=='Fixed');if(!owners.every(h=>bm.has(key(h)))||!exact(owners.map(h=>h.index),r.owners))throw RangeError('Retired color owner generation mismatch');
  for(const id of r.owners){const bit=1n<<BigInt(r.solverColor);if(id>=expected.length||expected[id]&bit)throw RangeError('Retired color conflicts with a live or retired reservation');expected[id]|=bit;}
 }
 if(expected.some((x,i)=>x!==mask(s.bodySolverColorMasks[i])))throw RangeError('Native per-body masks differ from persistent pair colors and private retired reservations');
}
function assertBuckets(s){
 const seen=new Set();for(let color=0;color<s.buckets.length;color++){const bucket=s.buckets[color];if(!Array.isArray(bucket))throw TypeError('Native bucket arrays required');bucket.forEach((r,local)=>{uint(r.edge);uint(r.manifold);const m=s.pairs[r.edge]?.manifolds[r.manifold],id=r.edge+'/'+r.manifold;if(!m||seen.has(id)||m.graphPos!==position(color,local)||m.solverColor!==color)throw RangeError('Solver bucket/back-reference mismatch');seen.add(id);});}
 s.pairs.forEach((p,i)=>p.manifolds.forEach((m,j)=>{if(m.graphPos!==U&&!seen.has(i+'/'+j))throw RangeError('Dangling GraphPos');}));
}
function clearColor(s,p){if(p.solverColor<OVERFLOW)for(const id of p.solverColorBodies)if(id!==U&&id<s.bodySolverColorMasks.length)s.bodySolverColorMasks[id]=(mask(s.bodySolverColorMasks[id])&~(1n<<BigInt(p.solverColor))).toString();p.solverColor=NONE;p.solverColorBodies=[U,U];}
function assignColor(s,edgeId,bm){
 const p=s.pairs[edgeId];if(p.solverColor!==NONE)return;const e=s.edges[edgeId],ids=[e.body1,e.body2].map(h=>bm.get(key(h)).type==='Fixed'?null:h.index),conflicts=ids.filter(x=>x!==null);
 if(!conflicts.length){p.solverColor=OVERFLOW;return;}for(const id of conflicts)while(s.bodySolverColorMasks.length<=id)s.bodySolverColorMasks.push('0');
 const used=conflicts.reduce((a,id)=>a|mask(s.bodySolverColorMasks[id]),0n);let color=OVERFLOW;
 if(conflicts.length===2){for(let i=0;i<DYNAMIC_COLORS;i++)if(!(used&(1n<<BigInt(i)))){color=i;break;}}
 else for(let i=127;i>=0;i--)if(!(used&(1n<<BigInt(i)))){color=i;break;}
 p.solverColor=color;if(color===OVERFLOW){p.solverColorBodies=[U,U];return;}p.solverColorBodies=conflicts.length===2?conflicts:[conflicts[0],U];for(const id of conflicts)s.bodySolverColorMasks[id]=(mask(s.bodySolverColorMasks[id])|(1n<<BigInt(color))).toString();
}
function removeSlot(s,pos){const {bucket,local}=atPosition(pos),a=s.buckets[bucket];if(!a||local>=a.length)throw RangeError('Stale solver GraphPos');const tail=a.pop();if(local<a.length){a[local]=tail;s.pairs[tail.edge].manifolds[tail.manifold].graphPos=pos;}}
function retireColor(s,p,c,view){
 const removed=view.removedColliders,withdrawn=Array.isArray(removed)?removed.filter(h=>same(h,c.edge.collider1)||same(h,c.edge.collider2)):[];
 if(!view.solverGraphInvalidated||!withdrawn.length||withdrawn.some(h=>!view.before.liveColliders.some(x=>same(x,h))||view.after.liveColliders.some(x=>same(x,h))))throw RangeError('Collider-node color retirement requires exact source withdrawal generations');
 if(p.solverColor<OVERFLOW){const owners=p.solverColorBodies.filter(x=>x!==U);retiredColors.get(s).push({sourceRevision:s.sourceRevision,initialSnapshotSha256:s.initialSnapshotSha256,sequence:view.toSequence,revision:view.toRevision,lifetime:c.lifetime,edge:copy(c.edge),withdrawn:copy(withdrawn),solverColor:p.solverColor,owners:owners.slice()});}
}
function removeEdge(s,c,view){
 const at=c.edgeId,last=s.edges.length-1;if(c.lastEdgeId!==last||!exact(s.edges[at],c.edge))throw RangeError('Journal removal differs from source dense graph');const p=s.pairs[at];if(s.solverGraphValid)for(const m of p.manifolds)if(m.graphPos!==U){removeSlot(s,m.graphPos);m.graphPos=U;}
 if(c.removalReason==='collider-node')retireColor(s,p,c,view);else{if(c.removalReason!==undefined)throw RangeError('Unknown source contact removal reason');if(view.removedColliders?.some(h=>same(h,c.edge.collider1)||same(h,c.edge.collider2)))throw RangeError('Collider withdrawal cannot masquerade as ordinary pair deletion');clearColor(s,p);}const e=s.edges.pop(),tail=s.pairs.pop();if(at<last){s.edges[at]=e;s.pairs[at]=tail;if(s.solverGraphValid)for(const m of tail.manifolds)if(m.graphPos!==U){const q=atPosition(m.graphPos);s.buckets[q.bucket][q.local].edge=at;}}
}
function reconcile(s,edgeId,full,awake,bm){
 const p=s.pairs[edgeId],e=s.edges[edgeId],selectable=!!(p.hint&0x8000)&&!!(p.hint&0x7fff);let first=true;
 p.manifolds.forEach((m,ordinal)=>{const a=awake.get(key(e.body1)),b=awake.get(key(e.body2)),qualifies=selectable&&!!(m.solverFlags&1)&&m.activeContactCount!==0&&((a&&bm.get(key(e.body1)).type==='Dynamic')||(b&&bm.get(key(e.body2)).type==='Dynamic'));
  if(qualifies){const color=first&&p.solverColor!==NONE?p.solverColor:OVERFLOW;first=false;if(color===OVERFLOW)throw RangeError('Overflow/native multimanifold regrouping is outside four-sphere roster domain');m.solverBodyIds=[a?.activeSetId??U,b?.activeSetId??U];m.solverColor=color;if(full||m.graphPos===U||atPosition(m.graphPos).bucket!==color){if(!full&&m.graphPos!==U)removeSlot(s,m.graphPos);m.graphPos=position(color,s.buckets[color].length);s.buckets[color].push({edge:edgeId,manifold:ordinal});}}
  else{if(!full&&m.graphPos!==U)removeSlot(s,m.graphPos);m.graphPos=U;}
 });
}
function updateState(current,view,input){
 const s=cloneState(current),bm=bodyMap(s);if(view.phase!=='narrow'||view.status!=='pending'||view.fromSequence!==s.sequence||view.fromRevision!==s.revision||!exact(view.before.edges,s.edges)||view.initialSnapshotSha256!==undefined&&view.initialSnapshotSha256!==s.initialSnapshotSha256)throw RangeError('Current same-origin narrow source transaction required');
 if(typeof input.solverGraphInvalidated!=='boolean')throw TypeError('Explicit source invalidation effect required');if(input.solverGraphInvalidated||view.solverGraphInvalidated)s.solverGraphValid=false;
 const starts=[];for(const c of view.changes){if(c.kind==='append'){if(c.edgeId!==s.edges.length)throw RangeError('Dense source append required');s.edges.push(copy(c.edge));s.pairs.push(blankPair());}else if(c.kind==='remove')removeEdge(s,c,view);else if(c.kind==='active'){if(!exact(s.edges[c.edgeId],c.edge)||s.edges[c.edgeId].active===c.active)throw RangeError('Actual ordered source active transition required');s.edges[c.edgeId].active=c.active;if(c.active)starts.push(c.edgeId);else clearColor(s,s.pairs[c.edgeId]);}else throw RangeError('Unknown source journal mutation');}
 if(!exact(s.edges,view.after.edges))throw RangeError('Journal mutation replay differs from current graph');
 // Native transitions emit/link in dense order, then color ALL starts after ALL
 // stopped pairs release their bits, sorted by (min body arena, max body arena, edge).
 starts.sort((a,b)=>{const ea=s.edges[a],eb=s.edges[b];return Math.min(ea.body1.index,ea.body2.index)-Math.min(eb.body1.index,eb.body2.index)||Math.max(ea.body1.index,ea.body2.index)-Math.max(eb.body1.index,eb.body2.index)||a-b;});starts.forEach(i=>assignColor(s,i,bm));
 if(!Array.isArray(input.pairs)||input.pairs.length!==s.pairs.length||new Set(input.pairs.map(p=>p.edgeId)).size!==s.pairs.length)throw RangeError('Complete unique source pair-hint metadata required');const dirty=[];
 for(const row of input.pairs){uint(row.edgeId);const p=s.pairs[row.edgeId];if(!p||typeof row.updated!=='boolean'||!Array.isArray(row.manifolds)||row.manifolds.length>1)throw RangeError('Explicit source-updated single-manifold metadata required');validateHint(row.hint);const next=row.manifolds.map(m=>validateManifold(m));if(!row.updated&&(!exact(next,p.manifolds.map(({activeContactCount,solverFlags})=>({activeContactCount,solverFlags})))||row.hint!==p.hint))throw RangeError('Unupdated pair cannot replace geometry or count-cleared hints');
  if(row.solverGraphDirty!==undefined&&typeof row.solverGraphDirty!=='boolean')throw TypeError('Explicit native solverGraphDirty must be boolean');if(row.solverGraphDirty??row.updated)dirty.push(row.edgeId);
  if(row.updated){if(next.length!==p.manifolds.length&&p.manifolds.some(m=>m.graphPos!==U))s.solverGraphValid=false;p.manifolds=next.map((m,i)=>({...m,graphPos:p.manifolds[i]?.graphPos??U,solverColor:p.manifolds[i]?.solverColor??NONE,solverBodyIds:copy(p.manifolds[i]?.solverBodyIds??[U,U])}));p.hint=row.hint;}
 }
 const slept=input.sleptBodies??[];if(!Array.isArray(slept)||new Set(slept.map(h=>key(handle(h)))).size!==slept.length)throw RangeError('Exact source newly-asleep body list required');for(const h of slept){if(bm.get(key(h))?.type!=='Dynamic')throw RangeError('Only original dynamic bodies can sleep');s.pairs.forEach((p,i)=>{const e=s.edges[i];if(same(e.body1,h)||same(e.body2,h))p.hint&=0x8000;});s.solverGraphValid=false;}
 const awake=validateAwake(input.awakeBodies,bm);for(const h of slept)if(awake.some(r=>same(r.body,h)))throw RangeError('Sleeping body cannot remain awake');uint(input.activeSetEpoch,'active_set_epoch');const mbEpoch=input.multibodyTopologyEpoch??s.multibodyTopologyEpoch;uint(mbEpoch,'multibody topology epoch');
 if(input.activeSetEpoch===s.activeSetEpoch&&!exact(awake,s.awakeBodies))throw RangeError('Source active-set mapping changed without epoch bump');s.awakeBodies=awake;s.activeSetEpoch=input.activeSetEpoch;s.multibodyTopologyEpoch=mbEpoch;
 const full=!s.solverGraphValid||s.activeSetEpoch!==s.solverGraphEpoch||s.multibodyTopologyEpoch!==s.solverGraphMultibodyEpoch;
 if(full)s.buckets=Array.from({length:130},()=>[]);const awakeMap=new Map(awake.map(r=>[key(r.body),r]));
 // Dirty-list sorting is native; bucket members are never sorted incrementally.
 for(const i of full?s.pairs.map((_,i)=>i):dirty.sort((a,b)=>a-b))reconcile(s,i,full,awakeMap,bm);
 if(full){s.solverGraphEpoch=s.activeSetEpoch;s.solverGraphMultibodyEpoch=s.multibodyTopologyEpoch;s.solverGraphValid=true;}
 s.sequence=view.toSequence;s.revision=view.toRevision;assertMasks(s);assertBuckets(s);return{s,rebuilt:full,dirtyEdges:dirty};
}
function result(s,rebuilt=false,dirtyEdges=[]){return{backend:s.backend,rebuilt,dirtyEdges:dirtyEdges.slice(),contactOrder:s.buckets.slice(0,129).flatMap((refs,color)=>refs.map(r=>({...copy(r),color,body1:copy(s.edges[r.edge].body1),body2:copy(s.edges[r.edge].body2),solverBodyIds:copy(s.pairs[r.edge].manifolds[r.manifold].solverBodyIds)}))),pairs:copy(s.pairs),buckets:copy(s.buckets),bodySolverColorMasks:s.bodySolverColorMasks.slice(),activeSetEpoch:s.activeSetEpoch};}
function createRoster(seed,{backend='cpu-reference'}={}){
 if(!['cpu-reference','webgpu'].includes(backend))throw RangeError('Explicit supported backend required');let current=validate(seed),pending=null,projection=null,lease=null,outer=null,disposed=false;current.backend=backend;
 const access=t=>{if(!lease||lease!==t||disposed)throw Error('Roster requires its private common-world owner');};
 function seal(t){access(t);if(!pending||!projection)throw Error('Prepared roster and source graph binding required');J.assertTransaction(pending.transaction,projection,backend);const view=J.viewReceipt(pending.transaction,backend);if(view.phase!=='complete'||!exact(view.after.edges,pending.s.edges)||view.toSequence!==pending.s.sequence)throw RangeError('Matching sealed source journal required');if(!pending.projection)pending.projection=J.projectReceipts([pending.transaction],projection,backend).projection;J.assertProjectionHead(pending.projection,backend);}
 function adopt(){current=pending.s;projection=pending.projection;pending=null;}
 const api={backend,claim(t){if(!t||typeof t!=='object'||lease||disposed)throw Error('Idle roster ownership required');lease=t;},release(t){access(t);if(pending||outer)throw Error('Pending source roster');lease=null;},bindGraph(p,t){access(t);if(projection||pending||outer)throw Error('Bind initial idle graph once');const v=J.projectionSnapshot(p,backend);if(v.sequence!==0||v.revision!==0||!exact(v.edges,current.edges))throw RangeError('Exact initial source graph projection required');projection=p;},snapshot:()=>copy(outer?outer.before:current),workingSnapshot(t){access(t);return copy(current);},graphSequence(){return current.sequence;},
 prepare(input,t,pass){access(t);if(pending||!projection)throw Error('Idle bound roster required');if(outer){const p=C.assertPass(pass,backend,outer.cap);if(p.passIndex!==outer.passIndex)throw RangeError('Exact current CCD pass required');}else if(pass!==undefined)throw RangeError('CCD pass needs outer transaction');J.assertTransaction(input.transaction,projection,backend);const out=updateState(current,J.viewReceipt(input.transaction,backend),input);pending={...out,transaction:input.transaction,pass,projection:null};return result(out.s,out.rebuilt,out.dirtyEdges);},
 assertPrepared:seal,commit(t){if(outer)throw Error('CCD outer requires commitOuter');seal(t);adopt();},abort(t){access(t);pending=null;if(outer){current=outer.before;projection=outer.projection;outer=null;}},
 beginOuter(cap,t){access(t);if(pending||outer||!projection)throw Error('Idle bound roster required');C.assertOuter(cap,backend);outer={cap,before:cloneState(current),projection,passIndex:0};},advanceInternalPass(pass,t){access(t);if(!outer)throw Error('CCD outer required');const p=C.assertPass(pass,backend,outer.cap);if(p.final||p.passIndex!==outer.passIndex||pending?.pass!==pass)throw RangeError('Exact nonfinal roster pass required');seal(t);adopt();outer.passIndex++;},assertOuterPrepared(pass,t){access(t);if(!outer)throw Error('CCD outer required');const p=C.assertPass(pass,backend,outer.cap);if(!p.final||p.passIndex!==outer.passIndex||pending?.pass!==pass)throw RangeError('Exact final roster pass required');seal(t);},commitOuter(pass,t){api.assertOuterPrepared(pass,t);adopt();outer=null;},dispose(){if(lease||pending||outer)throw Error('Release idle roster before disposal');disposed=true;projection=null;}
 };return Object.freeze(api);
}
const api=Object.freeze({SOURCE_REVISION:REV,validate,seedFromSourceSnapshot,createRoster});G.LabSolverContactRosterExperimental=api;if(common)module.exports=api;
})(globalThis);
