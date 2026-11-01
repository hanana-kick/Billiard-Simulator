// SPDX-License-Identifier: Apache-2.0
// One-time proof for the pinned accepted PhysicsLab.strike creation path. This
// authenticates a common integer/constant template, NOT a per-candidate native
// world, a numerical overwrite receipt, or a general-purpose arena allocator.
import {projectLiveRegisteredFourBall} from '../browser-initial-import/live-registered-four-ball.mjs';
import {assertOwnedInputData,copy,equalData,plain,requireThat as need} from '../browser-initial-import/exact-data.mjs';
const U=0xffffffff,owned=new WeakMap(),key=h=>h.index+':'+h.generation;
export const CREATION_METHODS=Object.freeze(['createRigidBody','createCollider','createRigidBody','createCollider','createCollider','createImpulseJoint','setContactsEnabled','createRigidBody','createImpulseJoint','setLimits','setContactsEnabled','setLinvel','setLinvel']);
export const CREATION_SOURCE=Object.freeze({revision:'b716d375efc0201003f0cd9ef7168eee0b62c177',physicsSha256:'a36f5297bd96901cc82e041e1879ac5e623384c0575963a50032d27f1e460c1d',
 application:'src/physics.js:143-168',arena:'src/data/arena.rs:205-325',attachment:'src/dynamics/rigid_body_components.rs:1227-1260',bodyBuilder:'src/dynamics/rigid_body.rs:2130-2180',joints:'src/dynamics/joint/impulse_joint/impulse_joint_set.rs:382-440'});
export const CREATION_OVERWRITE_REQUIREMENTS=Object.freeze([
 Object.freeze({id:'body-current-and-next-pose',phase:'before-first-lateral',producer:'raw source pose -> every resident pose alias',fields:'shaft/head/guide pos.position and pos.next_position translation[3], rotation[4]'}),
 Object.freeze({id:'linear-velocity',phase:'before-first-lateral',producer:'raw source direction * speed -> canonical and cue body velocity aliases',fields:'shaft/head vels.linvel[3]'}),
 Object.freeze({id:'created-world-mass',phase:'before-first-lateral',producer:'unchanged Init.buildPlan from new pose and exact invariant attachment mass',fields:'shaft/head world_com[3], effective_inv_mass[3], effective_world_inv_inertia[6]'}),
 Object.freeze({id:'created-collider-world-pose',phase:'before-first-collider-read',producer:'source parent pose * immutable local collider pose',fields:'shaft/tip/neck pos.translation[3], pos.rotation[4]'}),
 Object.freeze({id:'application-pose',phase:'before-first-lateral',producer:'raw original binary64 pose program',fields:'direction, side, up, surface, contact, tip, rotation, shaftCenter; live consumers must use new row, not captured pose'}),
 Object.freeze({id:'source-first-user-changes',phase:'after-first-tip-before-first-collision',producer:'source scene-created initialization and unchanged numeric initialization',fields:'maxExtent, updated collider poses, mass, CCD facts, registration and modified queues; do not prematurely consume initialized/mask/frame'})
]);
function freeze(x){if(x&&typeof x==='object'){for(const y of Object.values(x))freeze(y);Object.freeze(x);}return x;}
function validateArena(a,label){
 need(a&&Array.isArray(a.items)&&Object.keys(a).sort().join()===['free_list_head','generation','items','len'].join(),label+' exact arena schema');
 need(Number.isInteger(a.generation)&&a.generation>=0&&a.generation<U&&Number.isInteger(a.len)&&a.len>=0&&a.len<=a.items.length,label+' bounded arena metadata');
 const free=new Set();let cursor=a.free_list_head;
 while(cursor!==null){need(Number.isInteger(cursor)&&cursor>=0&&cursor<a.items.length&&!free.has(cursor),label+' valid acyclic free chain');const item=a.items[cursor];need(item&&Object.keys(item).join()==='next_free',label+' free chain may not enter occupied entry');free.add(cursor);cursor=item.next_free;}
 let occupied=0;a.items.forEach((item,i)=>{if(Object.hasOwn(item,'value')){need(Object.keys(item).sort().join()==='generation,value'&&Number.isInteger(item.generation)&&item.generation>=0&&item.generation<=a.generation,label+' occupied generation');occupied++;}else need(free.has(i),label+' every free entry belongs to source chain');});need(occupied===a.len&&free.size+occupied===a.items.length,label+' arena length conservation');
 return [...free];
}
/** Structural source fast-path proof only. No allocation or GPU admission. */
export function verifyCreationArenaTransition(before,after,handles,label='arena'){
 const freeBefore=validateArena(before,label),freeAfter=validateArena(after,label);need(Array.isArray(handles)&&handles.length>0&&freeBefore.length>=handles.length,label+' reserve/growth slow path unsupported');
 need(before.generation===after.generation&&before.items.length===after.items.length&&after.len===before.len+handles.length,label+' source insertion metadata');
 const created=new Set();for(let i=0;i<handles.length;i++){const h=handles[i];need(h?.index===freeBefore[i]&&h.generation===before.generation,label+' source free-list handle/generation order');need(!created.has(h.index),label+' repeated insertion');created.add(h.index);const entry=after.items[h.index];need(Object.hasOwn(entry,'value')&&entry.generation===h.generation,label+' expected occupied result');}
 need(after.free_list_head===(freeBefore[handles.length]??null),label+' source remainder head');equalData(freeAfter,freeBefore.slice(handles.length),label+' exact remaining free-chain order');before.items.forEach((entry,i)=>{if(!created.has(i))equalData(after.items[i],entry,label+' retained arena entry changed');});
 return{generation:before.generation,capacity:before.items.length,lengthBefore:before.len,lengthAfter:after.len,headBefore:before.free_list_head,headAfter:after.free_list_head,allocated:copy(handles),freeBefore,freeAfter};
}
function verifyGraph(before,after,events){
 need(before.joint_graph.graph.nodes.length===0&&before.joint_graph.graph.edges.length===0,'only source empty prestrike cue graph');const graph=after.joint_graph.graph,nodes=[],edges=[],by=new Map();
 for(const event of events.filter(e=>e.method==='createImpulseJoint')){const pair=[event.body1,event.body2],indices=pair.map(h=>{const k=key(h);if(!by.has(k)){by.set(k,nodes.length);nodes.push({weight:copy(h),next:[U,U]});}return by.get(k);}),edge={node:indices,next:indices.map((n,d)=>nodes[n].next[d]),prev:[U,U]};for(let d=0;d<2;d++){if(edge.next[d]!==U)edges[edge.next[d]].prev[d]=edges.length;nodes[indices[d]].next[d]=edges.length;}edges.push(edge);const actual=graph.edges[edges.length-1];need(actual,'missing native joint edge');equalData(actual.weight.handle,event.handle,'source joint edge handle');equalData(actual.weight.body1,pair[0]);equalData(actual.weight.body2,pair[1]);}
 equalData(graph.nodes,nodes,'native node allocation and chain order');need(graph.edges.length===edges.length,'exact native edge count');graph.edges.forEach((edge,i)=>{for(const k of['node','next','prev'])equalData(edge[k],edges[i][k],'native edge adjacency '+k);});
 return {nodes:copy(nodes),edges:graph.edges.map(x=>({handle:copy(x.weight.handle),node:copy(x.node),next:copy(x.next),prev:copy(x.prev)})),wakeOrder:copy(after.to_wake_up),joinOrder:copy(after.to_join)};
}
function nativeFields(roles,events){
 const paths=[],append=(prefix,count)=>{for(let i=0;i<count;i++)paths.push(prefix+'.'+i);};
 for(const role of['shaft','head','guide']){const b='bodies.bodies.items.'+roles[role].index+'.value';for(const p of['position','next_position']){append(b+'.pos.'+p+'.translation',3);append(b+'.pos.'+p+'.rotation',4);}if(role!=='guide'){append(b+'.vels.linvel',3);append(b+'.mprops.world_com',3);append(b+'.mprops.effective_inv_mass',3);for(const k of['m11','m12','m13','m22','m23','m33'])paths.push(b+'.mprops.effective_world_inv_inertia.'+k);}}
 for(const event of events.filter(x=>x.method==='createCollider')){const p='colliders.colliders.items.'+event.handle.index+'.value.pos';append(p+'.translation',3);append(p+'.rotation',4);}return paths;
}
function maskedNative(state,paths){const result=copy(state);for(const path of paths){const keys=path.split('.');let owner=result;for(const k of keys.slice(0,-1)){need(owner&&Object.hasOwn(owner,k),'missing declared candidate field '+path);owner=owner[k];}const k=keys.at(-1);need(Number.isFinite(owner[k])&&Object.is(Math.fround(owner[k]),owner[k]),'candidate native field must be finite source f32: '+path);owner[k]='candidate-dependent-f32';}return result;}
/** Authenticates both original snapshots and the source 13-call journal once.
 * Only the shared, parameter-independent structure is admitted. Caller may not
 * turn this object into nativeAllocation:true or attest missing device writes.
 */
export async function authenticateCreationTemplate(decoder,input){
 assertOwnedInputData(input);need(input&&Object.keys(input).sort().join()==='capture,preStrikeSnapshot,snapshot','exact original creation input');need(typeof decoder?.decodeSnapshot==='function','initialized source decoder');const raw=copy(input);
 const preStrikeDecoded=await decoder.decodeSnapshot(raw.preStrikeSnapshot),decoded=await decoder.decodeSnapshot(raw.snapshot),seed=await projectLiveRegisteredFourBall({...raw,preStrikeDecoded,decoded});
 const before=plain(preStrikeDecoded.state),after=plain(decoded.state),record=seed.cueInitial.sourceCreation,events=record.events,roles=record.roles;
 equalData(events.map(e=>e.method),CREATION_METHODS,'source 13-call order');need(raw.capture.strikeCreationJournal.every(e=>e.captureNativeStepsBefore===0&&e.captureNativeStepsAfter===0),'creation may not execute native steps');
 const by=method=>events.filter(e=>e.method===method).map(e=>e.handle),arenas={
  bodies:verifyCreationArenaTransition(before.bodies.bodies,after.bodies.bodies,by('createRigidBody'),'bodies'),
  colliders:verifyCreationArenaTransition(before.colliders.colliders,after.colliders.colliders,by('createCollider'),'colliders'),
  joints:verifyCreationArenaTransition(before.impulse_joints.joint_ids,after.impulse_joints.joint_ids,by('createImpulseJoint'),'joints')};
 equalData(before.bodies.modified_bodies,[[],null],'empty source prestrike body queue');equalData(before.colliders.modified_colliders,[[],null],'empty source prestrike collider queue');equalData(after.bodies.modified_bodies,[by('createRigidBody'),null],'source creation body modification order');equalData(after.colliders.modified_colliders,[by('createCollider'),null],'source attachment modification order');
 const graph=verifyGraph(before.impulse_joints,after.impulse_joints,events),paths=nativeFields(roles,events),invariant=maskedNative(after,paths);
 const receipt=freeze({kind:'authenticated-fixed-cue-creation-template',version:1,sourceRevision:decoded.sourceRevision,engineSha256:decoded.engineSha256,preStrikeSnapshotSha256:preStrikeDecoded.inputSha256,createdSnapshotSha256:decoded.inputSha256,
  callCount:13,nativeStepCount:0,sourceStructureVerified:true,nativeAllocation:false,perCandidateNumericCoverage:false,scope:'one original registered four-ball prestrike; fixed selected ball/materials; accepted five-parameter source path only',roles:copy(roles),arenas,graph,
  bodyModificationOrder:by('createRigidBody'),colliderModificationOrder:by('createCollider'),nativeVariableFields:paths,overwriteRequirements:copy(CREATION_OVERWRITE_REQUIREMENTS),
  invariantAttachmentMass:Object.fromEntries(['shaft','head','guide'].map(role=>[role,copy(record.created.bodies[role].mprops.local_mprops)]))});
 owned.set(receipt,{receipt:copy(receipt),invariant,created:after,seed});return {receipt,seed};
}
export function assertCreationTemplate(receipt){const origin=owned.get(receipt);need(origin,'authentic locally verified creation template required');equalData(receipt,origin.receipt,'creation receipt mutated');return receipt;}
/** TEST ONLY: whole native snapshot must equal the authenticated source except
 * the explicitly enumerated numeric leaves. This is structural differential
 * evidence, not proof of those leaves or all continuous candidate values.
 */
export function assertCreationVariantForTest(receipt,nativeState,{testOnly=false}={}){need(testOnly===true,'structural differential is test-only');assertCreationTemplate(receipt);equalData(maskedNative(nativeState,receipt.nativeVariableFields),owned.get(receipt).invariant,'non-parameter creation field changed');return{checkedNativeVariableFields:receipt.nativeVariableFields.length,nativeAllocation:false};}
