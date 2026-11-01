/* SPDX-License-Identifier: Apache-2.0
 * Original created-snapshot integer registration / joint journal source port.
 * experimental-cue-initialization.initializeLiveRegisteredFourBallUserChanges.
 * No native stepping, initialized future snapshot, or numeric host fallback.
 */
import {SCENE_LAYOUT as S,encodeSceneCreatedRegistration,decodeSceneActivation,sceneActivationTestKernels} from './scene-activation.mjs';
const U=0xffffffff,copy=x=>structuredClone(x),key=h=>h.index+':'+h.generation;
const H=Object.freeze({version:0,status:1,phase:2,colliderCount:3,modifiedColliderCount:4,consumedColliderCount:5,nodeCount:6,mutationCount:7,journalCount:8,numericReady:9});
export const SCENE_INITIALIZATION_LAYOUT=Object.freeze({version:1,header:H,headerWords:32,colliderOffset:32,colliderStride:4,maxColliders:27,modifiedColliderOffset:140,nodeOffset:167,nodeStride:4,maxNodes:3,edgeOffset:179,edgeStride:5,mutationOffset:189,journalOffset:192,journalStride:2,maxJournal:32,numericOffset:256,numericStride:30,poseOffset:346,poseStride:7,words:535,bytes:2140});
const L=SCENE_INITIALIZATION_LAYOUT,fail=(yes,message)=>{if(!yes)throw new RangeError('Created scene registration: '+message);};
const bits=x=>new Uint32Array(new Float32Array([x]).buffer)[0],number=x=>new Float32Array(new Uint32Array([x]).buffer)[0];
/** The import record is the actual zero-step original created snapshot. For raw
 * candidate waves, its allocation/queue topology is reusable only after the raw
 * owner proves parameter-independent construction; numerical words come from
 * each candidate's device raw initializer, never from this control template. */
export function encodeSceneInitialization(record,{bodyRegistry=[]}={}){
 const scene=encodeSceneCreatedRegistration(record,{bodyRegistry}),a=new Uint32Array(L.words),src=record.created,graph=src.jointState.joint_graph.graph,slots=new Map(scene.template.bodies.map((b,i)=>[key(b.handle),i])),cs=new Map(src.colliders.map((c,i)=>[key(c.handle),i]));
 fail(graph.nodes.length===3&&graph.edges.length===2,'exact original three-node/two-edge cue graph required');a[H.version]=1;a[H.status]=1;a[H.colliderCount]=src.colliders.length;a[H.modifiedColliderCount]=src.modifiedColliders.length;a[H.nodeCount]=graph.nodes.length;
 src.colliders.forEach((c,i)=>{const parent=slots.get(key(c.parent.handle));fail(parent!==undefined,'collider parent outside complete registry');a.set([c.handle.index,c.handle.generation,parent,c.changes],L.colliderOffset+i*4);a.set([...c.pos.translation,...c.pos.rotation].map(bits),L.poseOffset+i*7);});
 a.set(src.modifiedColliders.map(h=>{const slot=cs.get(key(h));fail(slot!==undefined,'source modified collider queue');return slot;}),L.modifiedColliderOffset);
 const nodeSeen=new Set();graph.nodes.forEach((n,i)=>{const member=slots.get(key(n.weight));fail(member!==undefined&&!nodeSeen.has(member),'distinct original cue graph node');nodeSeen.add(member);fail(n.next.length===2&&n.next.every(id=>id===U||Number.isInteger(id)&&id>=0&&id<2),'native cue graph heads');a.set([member,...n.next,0],L.nodeOffset+i*4);});
 graph.edges.forEach((e,i)=>{fail(e.node.length===2&&e.next.length===2&&e.node.every(n=>Number.isInteger(n)&&n>=0&&n<3)&&e.next.every(n=>n===U||Number.isInteger(n)&&n>=0&&n<2),'native cue graph edge adjacency');for(let side=0;side<2;side++)fail(key(graph.nodes[e.node[side]].weight)===key(e.weight['body'+(side+1)]),'joint graph endpoint mismatch');a.set([i,...e.node,...e.next],L.edgeOffset+i*5);});
 for(let ni=0;ni<3;ni++)for(let side=0;side<2;side++){let id=graph.nodes[ni].next[side];const seen=new Set();while(id!==U){fail(!seen.has(id)&&graph.edges[id].node[side]===ni,'complete acyclic directional joint chain');seen.add(id);id=graph.edges[id].next[side];}fail(seen.size===graph.edges.filter(e=>e.node[side]===ni).length,'complete source joint adjacency required');}
 const mutations=record.events.filter(e=>['setContactsEnabled','setLimits'].includes(e.method));fail(mutations.length===3,'exact original joint mutation calls');a[H.mutationCount]=mutations.length;mutations.forEach((e,i)=>{const n=graph.edges.findIndex(x=>key(x.weight.handle)===key(e.handle));fail(n>=0,'mutated joint identity');a[L.mutationOffset+i]=n;});
 return{sceneWords:scene.words,words:a,template:scene.template,record:copy(record)};
}
/** Diagnostic output with original immutable native metadata preserved. */
export function decodeSceneInitialization(sceneWords,a,record,template){
 fail(a[H.version]===1,'schema version');const context=decodeSceneActivation(sceneWords,template),src=record.created,roles=record.roles,colliders=copy(src.colliders),raw=copy(src.bodies),numeric={};
 for(let i=0;i<colliders.length;i++){const q=L.poseOffset+i*7;colliders[i].pos.translation=Array.from(a.slice(q,q+3),number);colliders[i].pos.rotation=Array.from(a.slice(q+3,q+7),number);colliders[i].changes=a[L.colliderOffset+i*4+3];}
 for(const b of context.bodies){const r=raw[b.role];if(!r)continue;r.changes=b.changes;r.ids=copy(b.ids);r.activation=copy(b.activation);r.mprops.max_extent=b.maxExtent;}
 if(a[H.numericReady]===7)for(const[role,i]of[['shaft',0],['head',1],['guide',2]]){const q=L.numericOffset+i*30,n=Array.from(a.slice(q,q+30),number),r=raw[role];r.mprops.world_com=n.slice(0,3);r.mprops.effective_inv_mass=n.slice(3,6);r.mprops.effective_world_inv_inertia=Object.fromEntries(['m11','m12','m13','m22','m23','m33'].map((k,j)=>[k,n[6+j]]));numeric[role]=n;}
 const joint=j=>{const q=S.jointOffset+j*6;return{index:sceneWords[q],generation:sceneWords[q+1]};},body=i=>context.bodies.find(b=>b.handle.index===sceneWords[S.bodyOffset+i*32+1]&&b.handle.generation===sceneWords[S.bodyOffset+i*32+2])?.handle??template.bodies[i].handle;
 const jointEventJournal=Array.from({length:a[H.journalCount]},(_,i)=>{const q=L.journalOffset+i*2,j=a[q+1],jq=S.jointOffset+j*6;return a[q]===1?{kind:'Link',handle:joint(j),body1:copy(body(sceneWords[jq+4])),body2:copy(body(sceneWords[jq+5]))}:{kind:'Unlink',handle:joint(j)};});
 const queue=Array.from(a.slice(L.modifiedColliderOffset,L.modifiedColliderOffset+a[H.consumedColliderCount]),i=>copy(colliders[i].handle));
 return{phase:context.phase,sourceRevision:src.sourceRevision,roles:copy(roles),manager:context.manager,bodies:context.bodies.filter(b=>raw[b.role]).map(b=>({...b,raw:raw[b.role]})),colliders,consumedModifiedBodies:context.consumedModifiedBodies,consumedModifiedColliders:queue,modifiedBodies:context.modifiedBodies,modifiedColliders:Array.from(a.slice(L.modifiedColliderOffset,L.modifiedColliderOffset+a[H.modifiedColliderCount]),i=>copy(colliders[i].handle)),jointEventJournal,effects:{requiresJointAssemblyInvalidation:!!sceneWords[S.header.invalidatesJoints]}};
}
const CONSTANTS=()=>Object.entries({CIH:H,CIL:L}).flatMap(([prefix,group])=>Object.entries(group).filter(([,v])=>Number.isInteger(v)).map(([k,v])=>`const ${prefix}_${k}:u32=${v}u;`)).join('\n');
export function generateSceneInitializationWGSL(){return CONSTANTS()+'\n'+KERNEL;}
export function sceneInitializationTestKernels(words){return sceneActivationTestKernels(words,{extraWGSL:generateSceneInitializationWGSL()});}
const KERNEL=String.raw`
fn rc_scene_created_fail(b:u32,i:u32,reason:u32)->bool{rc_state[i+CIH_status]=4u;return rc_scene_bad(b,reason);}
fn rc_scene_created_event(b:u32,i:u32,kind:u32,joint:u32)->bool{
 let n=rc_state[i+CIH_journalCount];if(n>=32u){return rc_scene_created_fail(b,i,4u);}rc_state[i+CIL_journalOffset+2u*n]=kind;rc_state[i+CIL_journalOffset+2u*n+1u]=joint;rc_state[i+CIH_journalCount]=n+1u;return true;
}
fn rc_scene_created_joint_unlink(b:u32,i:u32,joint:u32)->bool{
 let e=rc_scene_jp(b,joint);let id=rc_state[e+2u];if(id==0xffffffffu){return true;}let n=rc_state[b+SH_removalCount];if(n>=128u){return rc_scene_created_fail(b,i,4u);}let p=rc_scene_pp(b,id);let at=rc_state[e+3u];let count=rc_state[p+SP_joints]-1u;let last=rc_state[p+SP_jointList+count];rc_state[p+SP_joints]=count;
 if(at<count){rc_state[p+SP_jointList+at]=last;rc_state[rc_scene_jp(b,last)+3u]=at;}rc_state[e+2u]=0xffffffffu;rc_state[e+3u]=0xffffffffu;rc_state[b+SH_jointCount]=rc_state[b+SH_jointCount]-1u;rc_state[b+SL_removalOffset+2u*n]=rc_state[e+4u];rc_state[b+SL_removalOffset+2u*n+1u]=rc_state[e+5u];rc_state[b+SH_removalCount]=n+1u;return true;
}
fn rc_scene_created_joint_link(b:u32,i:u32,joint:u32)->bool{
 let e=rc_scene_jp(b,joint);if(rc_state[e+2u]!=0xffffffffu){return true;}let first=rc_state[e+4u];let second=rc_state[e+5u];if(!rc_scene_valid_body(b,first)||!rc_scene_valid_body(b,second)){return rc_scene_created_fail(b,i,6u);}let a=rc_state[rc_scene_bp(b,first)+SB_island];let c=rc_state[rc_scene_bp(b,second)+SB_island];var destination=a;
 if(a==0xffffffffu){destination=c;}else if(c!=0xffffffffu&&a!=c){let pa=rc_scene_pp(b,a);let pc=rc_scene_pp(b,c);var small=pc;if(rc_state[pa+SP_count]<rc_state[pc+SP_count]){small=pa;}if(rc_state[small+SP_contacts]!=0u){return rc_scene_created_fail(b,i,6u);}destination=rc_scene_merge(b,a,c);if(!rc_scene_ok(b)){rc_state[i+CIH_status]=4u;return false;}}
 if(destination==0xffffffffu){return true;}let p=rc_scene_pp(b,destination);let count=rc_state[p+SP_joints];if(count>=2u){return rc_scene_created_fail(b,i,4u);}rc_state[p+SP_jointList+count]=joint;rc_state[p+SP_joints]=count+1u;rc_state[e+2u]=destination;rc_state[e+3u]=count;rc_state[b+SH_jointCount]=rc_state[b+SH_jointCount]+1u;return true;
}
fn rc_scene_created_register_body(b:u32,i:u32,member:u32)->bool{
 if(!rc_scene_valid_body(b,member)){return rc_scene_created_fail(b,i,6u);}let q=rc_scene_bp(b,member);let changes=rc_state[q+SB_changes];if(changes!=0u&&changes!=1u&&changes!=255u){return rc_scene_created_fail(b,i,6u);}rc_state[b+SH_epoch]=rc_scene_add(rc_state[b+SH_epoch],1u);if(rc_state[q+SB_dynamic]==0u){return true;}
 if(rc_state[q+SB_activation+4u]!=0u&&(rc_state[q+SB_activeIsland]==0xffffffffu||rc_state[q+SB_island]==0xffffffffu)){return rc_scene_created_fail(b,i,6u);}
 if(rc_state[q+SB_activeIsland]==0xffffffffu){var awake=rc_state[b+SH_awake];if(awake==0xffffffffu){let freeCount=rc_state[b+SH_chunkFreeCount];awake=rc_state[b+SH_chunkN];if(freeCount!=0u){awake=rc_state[b+SL_chunkFreeOffset+freeCount-1u];}var compact=0xffffffffu;for(var j=0u;j<6u;j++){if(rc_state[b+SL_chunkOffset+j*SL_chunkStride]==0xffffffffu){compact=j;break;}}if(awake>=32u||compact==0xffffffffu){return rc_scene_created_fail(b,i,4u);}if(awake<rc_state[b+SH_chunkLength]&&rc_state[b+SL_chunkMapOffset+awake]!=0xffffffffu){return rc_scene_created_fail(b,i,6u);}if(freeCount!=0u){rc_state[b+SH_chunkFreeCount]=freeCount-1u;}if(awake>=rc_state[b+SH_chunkLength]){rc_state[b+SH_chunkLength]=awake+1u;}
   let c=b+SL_chunkOffset+compact*SL_chunkStride;rc_state[c]=awake;rc_state[c+1u]=0u;rc_state[b+SL_chunkMapOffset+awake]=compact;rc_state[b+SH_chunkN]=rc_state[b+SH_chunkN]+1u;rc_state[b+SH_awake]=awake;}
  let c=rc_scene_cp(b,awake);let at=rc_state[c+1u];if(at>=6u){return rc_scene_created_fail(b,i,4u);}rc_state[q+SB_activeIsland]=awake;rc_state[q+SB_activeIndex]=at;rc_state[c+2u+at]=member;rc_state[c+1u]=at+1u;
 }
 if(rc_state[q+SB_island]==0xffffffffu){let id=rc_scene_alloc_persistent(b,0u);if(!rc_scene_ok(b)){rc_state[i+CIH_status]=4u;return false;}let p=rc_scene_pp(b,id);rc_state[p+SP_members]=member;rc_state[p+SP_count]=1u;rc_state[q+SB_island]=id;rc_state[q+SB_islandIndex]=0u;}return true;
}
// numeric points to shaft/head/guide 3x30 exact original initialization outputs.
// All derived numerical state is consumed on device, without host readback.
fn rc_scene_created_initialize(b:u32,i:u32,numeric:u32,readyMask:u32)->bool{
 if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=8u||rc_state[i+CIH_status]!=1u||rc_state[i+CIH_phase]!=0u||readyMask!=7u){return rc_scene_created_fail(b,i,6u);}rc_state[i+CIH_journalCount]=0u;
 for(var role=0u;role<3u;role++){var member=rc_state[b+SH_roleShaft];if(role==1u){member=rc_state[b+SH_roleHead];}else if(role==2u){member=rc_state[b+SH_roleGuide];}if(!rc_scene_valid_body(b,member)){return rc_scene_created_fail(b,i,6u);}let q=rc_scene_bp(b,member);if(rc_state[q+SB_changes]!=255u||rc_state[q+SB_island]!=0xffffffffu||rc_state[q+SB_activeIsland]!=0xffffffffu||rc_state[q+SB_activation+4u]!=0u){return rc_scene_created_fail(b,i,6u);}
  for(var j=0u;j<30u;j++){let value=rc_state[numeric+role*30u+j];if((value&0x7f800000u)==0x7f800000u){return rc_scene_created_fail(b,i,5u);}rc_state[i+CIL_numericOffset+role*30u+j]=value;}rc_state[q+SB_maxExtent]=rc_state[numeric+role*30u+12u];
  var count=0u;for(var j=0u;j<rc_state[i+CIH_modifiedColliderCount];j++){let collider=rc_state[i+CIL_modifiedColliderOffset+j];let c=i+CIL_colliderOffset+collider*4u;if(rc_state[c+2u]!=member){continue;}if(count>=2u){return rc_scene_created_fail(b,i,4u);}for(var z=0u;z<7u;z++){rc_state[i+CIL_poseOffset+collider*7u+z]=rc_state[numeric+role*30u+14u+count*7u+z];}count++;}
  if((role==0u&&count!=1u)||(role==1u&&count!=2u)||(role==2u&&count!=0u)){return rc_scene_created_fail(b,i,6u);}
 }
 rc_state[i+CIH_numericReady]=7u;let modified=rc_state[b+SH_modifiedCount];for(var j=0u;j<modified;j++){if(!rc_scene_created_register_body(b,i,rc_state[b+SL_modifiedOffset+j])){return false;}}
 if(!rc_scene_created_event(b,i,1u,0u)||!rc_scene_created_event(b,i,1u,1u)){return false;}
 // Native TYPE adjacency traversal is INCOMING FIRST, then OUTGOING.
 for(var j=0u;j<modified;j++){let member=rc_state[b+SL_modifiedOffset+j];if(rc_state[rc_scene_bp(b,member)+SB_changes]!=255u){continue;}var node=0xffffffffu;for(var z=0u;z<rc_state[i+CIH_nodeCount];z++){if(rc_state[i+CIL_nodeOffset+z*4u]==member){node=z;break;}}if(node==0xffffffffu){continue;}
  for(var order=0u;order<2u;order++){let side=1u-order;var edge=rc_state[i+CIL_nodeOffset+node*4u+1u+side];var seen=0u;while(edge!=0xffffffffu){if(edge>=2u||(seen&(1u<<edge))!=0u){return rc_scene_created_fail(b,i,6u);}seen=seen|(1u<<edge);let e=i+CIL_edgeOffset+edge*5u;if(rc_state[e+1u+side]!=node){return rc_scene_created_fail(b,i,6u);}let joint=rc_state[e];if(!rc_scene_created_event(b,i,2u,joint)||!rc_scene_created_event(b,i,1u,joint)){return false;}edge=rc_state[e+3u+side];}}
 }
 for(var j=0u;j<rc_state[i+CIH_mutationCount];j++){if(!rc_scene_created_event(b,i,1u,rc_state[i+CIL_mutationOffset+j])){return false;}}
 for(var j=0u;j<rc_state[i+CIH_journalCount];j++){let e=i+CIL_journalOffset+j*2u;let joint=rc_state[e+1u];if(rc_state[e]==1u){if(!rc_scene_created_joint_link(b,i,joint)){return false;}}else{if(!rc_scene_created_joint_unlink(b,i,joint)){return false;}}}
 for(var j=0u;j<modified;j++){rc_state[b+SL_consumedOffset+j]=rc_state[b+SL_modifiedOffset+j];}rc_state[b+SH_consumedCount]=modified;rc_state[b+SH_modifiedCount]=0u;rc_state[i+CIH_consumedColliderCount]=rc_state[i+CIH_modifiedColliderCount];rc_state[i+CIH_modifiedColliderCount]=0u;
 rc_state[b+SH_invalidatesJoints]=1u;rc_state[b+SH_phase]=1u;rc_state[b+SH_sourcePhase]=1u;rc_state[i+CIH_phase]=1u;return rc_scene_capacity(b);
}
// Source collision finalization clears the consumed collider flags only after
// owned broad/narrow processing, alongside rc_scene_collisions_done for bodies.
fn rc_scene_created_colliders_consumed(b:u32,i:u32)->bool{
 if(!rc_scene_ok(b)||rc_state[i+CIH_status]!=1u||rc_state[i+CIH_phase]!=1u||rc_state[b+SH_phase]!=5u){return rc_scene_created_fail(b,i,6u);}for(var j=0u;j<rc_state[i+CIH_consumedColliderCount];j++){let c=rc_state[i+CIL_modifiedColliderOffset+j];rc_state[i+CIL_colliderOffset+c*4u+3u]=0u;}rc_state[i+CIH_consumedColliderCount]=0u;rc_state[i+CIH_phase]=2u;return true;
}
`;
