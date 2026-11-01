// SPDX-License-Identifier: Apache-2.0
// INITIAL-ONLY HOST serialization, adapted from scene-activation.mjs:414-429,
// its packSceneActivationContext, and scene-initialization.mjs:16-25. Existing
// four-ball admission/generators are unchanged. No numerical operation runs.
import {assertThreeBallCreatedRegistration} from './three-ball-host-admission.mjs';
import {describeThreeBallResidentRoster} from './three-ball-resident-roster.mjs';
import {SCENE_LAYOUT as S,decodeSceneActivation} from './scene-activation.mjs';
import {SCENE_INITIALIZATION_LAYOUT as I,decodeSceneInitialization} from './scene-initialization.mjs';
import * as O from '../experimental-live-three-ball-origin.js';
const Origin=O.default??globalThis.LabLiveThreeBallOriginExperimental,U=0xffffffff,copy=structuredClone,key=h=>h.index+':'+h.generation,owned=new WeakMap();
const need=(ok,message)=>{if(!ok)throw Object.assign(new RangeError('Three-ball created control layout: '+message),{code:'three-ball-created-control-contract'});};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const bits=x=>{need(Number.isFinite(x)&&Object.is(Math.fround(x),x),'unchanged finite native f32 required');return new Uint32Array(Float32Array.of(x).buffer)[0];};
const uint=x=>{need(Number.isInteger(x)&&x>=0&&x<=U,'exact native u32 required');return x;};
const equal=(a,b,label)=>need(Origin.sameData(a,b),label);
export const THREE_BALL_CONTROL_CAPABILITY=Object.freeze({initialOnly:true,hostOnly:true,numericInitialized:false,collisionPrepared:false,
 physicalSteps:0,residentExecution:false,sourcePlanGenerated:false,rawCandidateCreation:false,searchEvaluator:false,defaultBackend:false});

function createdTemplate(initial){
 const {record:r,bodyRegistry}=initial,c=r.created,roles=r.roles;Origin.validateCreated(c,roles);
 const edges=c.jointState.joint_graph.graph.edges,joints=edges.map(e=>e.weight),raw=Object.entries(c.bodies);
 need(c.colliders.length===25&&raw.filter(([,b])=>b.body_type==='Dynamic').length===5,'exact genuine-three/cue source count');
 need(joints.length===2&&joints.every(j=>j.data.enabled==='Enabled'),'exact two enabled original cue joints');
 equal(joints.map(j=>[j.body1,j.body2]),[[roles.shaft,roles.head],[roles.guide,roles.shaft]],'original joint endpoint order');
 const events=r.events.filter(e=>e.method==='createImpulseJoint');need(events.length===2&&events.every((e,i)=>e.wakeUp===true&&key(e.handle)===key(joints[i].handle)&&key(e.body1)===key(joints[i].body1)&&key(e.body2)===key(joints[i].body2)),'original joint creation journal');
 const fresh=['shaft','head','guide'];equal(c.modifiedBodies,fresh.map(role=>roles[role]),'only original fresh cue modified-body queue');
 equal(c.modifiedColliders,fresh.flatMap(role=>c.bodies[role].colliders),'original cue collider attachment/modified order');
 for(const role of fresh){const b=c.bodies[role];need(b.enabled&&b.changes===255&&b.mprops.max_extent===0&&!b.activation.sleeping&&Object.values(b.ids).every(x=>x===U),'fresh unregistered zero-extent cue required');need(b.body_type===(role==='guide'?'Fixed':'Dynamic'),'original cue body type');}
 const p=c.islands.persistent;need(p.bootstrapped===true&&p.split_island===null&&p.removal_journal.length===0&&p.joint_link_locs.length===0,'no split/removal/registered cue-joint continuation');
 const template={kind:'source-scene-activation',phase:'source-created-pre-user-changes',noOtherPendingChanges:true,sourceRevision:c.sourceRevision,initialSnapshotSha256:c.snapshotSha256,roles:copy(roles),manager:copy(c.islands),modifiedBodies:copy(c.modifiedBodies),consumedModifiedBodies:[],
  bodies:raw.map(([role,b])=>({role,handle:copy(roles[role]),type:b.body_type,enabled:b.enabled,changes:b.changes,ids:copy(b.ids),activation:copy(b.activation),maxExtent:b.mprops.max_extent,jointAdjacency:joints.filter(j=>key(j.body1)===key(roles[role])||key(j.body2)===key(roles[role])).map(j=>copy(j.handle))}))};
 for(const b of bodyRegistry){if(template.bodies.some(x=>key(x.handle)===key(b.handle)))continue;need(b.type==='Fixed'&&b.enabled&&b.changes===0&&Object.values(b.ids).every(x=>x===U)&&b.jointAdjacency.length===0,'only unchanged actual fixed registry additions');template.bodies.push(copy(b));}
 need(template.bodies.length===22&&new Set(template.bodies.map(b=>key(b.handle))).size===22&&template.bodies.filter(b=>b.type==='Dynamic').length===5,'complete 22-body registry without a fourth ball');
 return template;
}

function packScene(t,r){
 const a=new Uint32Array(S.words),H=S.header,B=S.body,P=S.persistent,m=t.manager,p=m.persistent;
 const slots=new Map(t.bodies.map((b,i)=>[key(b.handle),i])),slot=h=>{const n=slots.get(key(h));need(n!==undefined,'source handle outside full scene');return n;};
 for(const map of [m.islands,p.islands])need(map.v.length<=32&&map.n<=6&&map.n===map.v.filter(Boolean).length,'native scene map capacity/count');
 for(const stack of [m.free_islands,p.free_islands])need(stack.length<=32&&stack.every(x=>Number.isInteger(x)&&x>=0&&x<32),'bounded native free stack');
 need(p.contact_link_locs.length<=128,'native contact-location capacity');
 for(const off of [S.chunkMapOffset,S.persistentMapOffset])a.fill(U,off,off+32);
 for(let i=0;i<6;i++){a[S.chunkOffset+i*S.chunkStride]=U;a[S.persistentOffset+i*S.persistentStride]=U;}
 a.fill(U,S.contactOffset,S.jointOffset);a.fill(U,S.jointOffset,S.removalOffset);
 const put=(k,v)=>{a[H[k]]=uint(v);};
 for(const[k,v]of Object.entries({version:1,status:1,phase:8,sourcePhase:8,bodySlots:22,bodyCount:22,epoch:m.active_set_epoch,awake:m.awake_island??U,chunkN:m.islands.n,chunkLength:m.islands.v.length,chunkFreeCount:m.free_islands.length,persistentN:p.islands.n,persistentLength:p.islands.v.length,persistentFreeCount:p.free_islands.length,scan:p.sleep_scan_stamp,split:U,contactLength:p.contact_link_locs.length,jointCount:0,modifiedCount:t.modifiedBodies.length,consumedCount:0,splitBid:U,clothFixed:U,clothHead:U}))put(k,v);
 for(const[role,name]of [['shaft','roleShaft'],['head','roleHead'],['guide','roleGuide']])put(name,slot(t.roles[role]));
 t.bodies.forEach((b,i)=>{const q=S.bodyOffset+i*S.bodyStride;a.set([1,b.handle.index,b.handle.generation,+(b.type==='Dynamic'),b.changes,b.ids.active_island_id,b.ids.active_set_id,b.ids.island_id,b.ids.island_index,bits(b.maxExtent)],q);
  if(b.type==='Dynamic'){const x=b.activation;a.set([x.normalized_linear_threshold,x.angular_threshold,x.time_until_sleep,x.time_since_can_sleep,+x.sleeping,...x.sleep_prev_pose.translation,...x.sleep_prev_pose.rotation].map(bits),q+B.activation);}
  need(b.jointAdjacency.length<=2,'bounded source joint adjacency');a[q+B.jointCount]=b.jointAdjacency.length;b.jointAdjacency.forEach((h,j)=>a.set([h.index,h.generation],q+B.joint0+j*2));});
 let dense=0;m.islands.v.forEach((c,id)=>{if(!c)return;need(c.bodies.length<=6,'native active chunk capacity');const q=S.chunkOffset+dense*S.chunkStride;a[S.chunkMapOffset+id]=dense++;a[q]=id;a[q+1]=c.bodies.length;a.set(c.bodies.map(slot),q+2);});a.set(m.free_islands,S.chunkFreeOffset);
 dense=0;p.islands.v.forEach((c,id)=>{if(!c)return;need(c.bodies.length<=6&&c.contact_links.length<=128&&c.joint_links.length===0,'initial native island capacity and no registered cue links');const q=S.persistentOffset+dense*S.persistentStride;a[S.persistentMapOffset+id]=dense++;a.set([id,c.bodies.length,c.contact_links.length,0,c.constraint_remove_count,c.split_denied_until,+c.sleeping],q);a.set(c.bodies.map(slot),q+P.members);a.set(c.contact_links.map(l=>uint(l.edge_id)),q+P.edges);
  c.contact_links.forEach((l,j)=>{need(l.edge_id<128,'bounded native edge');equal(p.contact_link_locs[l.edge_id],[id,j],'exact native reverse contact location');a.set([id,j,slot(l.body1),slot(l.body2)],S.contactOffset+l.edge_id*S.contactStride);});});
 a.set(p.free_islands,S.persistentFreeOffset);a.set(t.modifiedBodies.map(slot),S.modifiedOffset);
 r.created.jointState.joint_graph.graph.edges.forEach((e,i)=>{const j=e.weight;a.set([j.handle.index,j.handle.generation,U,U,slot(j.body1),slot(j.body2)],S.jointOffset+i*S.jointStride);});
 // Round-trip the entire manager, including holes/free lists/stamps. Metadata
 // carried by the diagnostic decoder is unchanged original source, not output.
 equal(decodeSceneActivation(a,t),t,'complete created scene/control round trip');return a;
}

function packInitialization(t,r){
 const a=new Uint32Array(I.words),H=I.header,c=r.created,g=c.jointState.joint_graph.graph,slots=new Map(t.bodies.map((b,i)=>[key(b.handle),i])),cs=new Map(c.colliders.map((x,i)=>[key(x.handle),i]));
 need(g.nodes.length===3&&g.edges.length===2,'source three-node/two-edge cue graph');a[H.version]=1;a[H.status]=1;a[H.colliderCount]=25;a[H.modifiedColliderCount]=c.modifiedColliders.length;a[H.nodeCount]=3;
 c.colliders.forEach((x,i)=>{const parent=slots.get(key(x.parent.handle));need(parent!==undefined,'exact collider source parent');a.set([x.handle.index,x.handle.generation,parent,x.changes],I.colliderOffset+i*I.colliderStride);a.set([...x.pos.translation,...x.pos.rotation].map(bits),I.poseOffset+i*7);});
 a.set(c.modifiedColliders.map(h=>{const n=cs.get(key(h));need(n!==undefined,'source modified collider generation');return n;}),I.modifiedColliderOffset);
 const seen=new Set();g.nodes.forEach((n,i)=>{const member=slots.get(key(n.weight));need(member!==undefined&&!seen.has(member)&&n.next.length===2&&n.next.every(x=>x===U||Number.isInteger(x)&&x>=0&&x<2),'source cue graph nodes/heads');seen.add(member);a.set([member,...n.next,0],I.nodeOffset+i*I.nodeStride);});
 g.edges.forEach((e,i)=>{need(e.node.length===2&&e.next.length===2&&e.node.every(x=>Number.isInteger(x)&&x>=0&&x<3)&&e.next.every(x=>x===U||Number.isInteger(x)&&x>=0&&x<2),'source cue graph edge shape');for(let side=0;side<2;side++)equal(g.nodes[e.node[side]].weight,e.weight['body'+(side+1)],'source cue graph endpoints');a.set([i,...e.node,...e.next],I.edgeOffset+i*I.edgeStride);});
 for(let node=0;node<3;node++)for(let side=0;side<2;side++){let at=g.nodes[node].next[side];const visited=new Set();while(at!==U){need(!visited.has(at)&&g.edges[at].node[side]===node,'acyclic complete directional cue adjacency');visited.add(at);at=g.edges[at].next[side];}need(visited.size===g.edges.filter(e=>e.node[side]===node).length,'complete cue adjacency');}
 const mutations=r.events.filter(e=>['setContactsEnabled','setLimits'].includes(e.method));need(mutations.length===3,'exact cue joint mutation journal');a[H.mutationCount]=3;mutations.forEach((e,i)=>{const slot=g.edges.findIndex(x=>key(x.weight.handle)===key(e.handle));need(slot>=0,'joint mutation generation');a[I.mutationOffset+i]=slot;});
 need(a[H.numericReady]===0&&a.slice(I.numericOffset,I.numericOffset+90).every(x=>x===0),'never pre-initialize numeric output');return a;
}

export function packThreeBallCreatedControlLayout(initial){
 assertThreeBallCreatedRegistration(initial);const template=createdTemplate(initial),sceneWords=packScene(template,initial.record),initializationWords=packInitialization(template,initial.record),roster=describeThreeBallResidentRoster(initial.admission);
 const slot=h=>{const n=template.bodies.findIndex(b=>key(b.handle)===key(h));need(n>=0,'canonical/native identity must resolve to actual source-role scene slot');return n;};
 const bindings=freeze({dynamic:roster.dynamicBindings.map(b=>({canonicalIndex:b.canonicalIndex,sceneSlot:slot(b.body),body:copy(b.body)})),guide:{sceneSlot:slot(roster.fixedGuide.body),body:copy(roster.fixedGuide.body),canonicalIndex:null}});
 const out=Object.freeze({kind:'resident-three-ball-created-control-layout-v1',version:1,sourceIdentity:initial.sourceIdentity,capability:THREE_BALL_CONTROL_CAPABILITY,
  roster,bindings,history:initial.history,sceneWords,initializationWords,template:freeze(template)});
 Object.preventExtensions(sceneWords);Object.preventExtensions(initializationWords);
 owned.set(out,{initial,scene:sceneWords.slice(),initialization:initializationWords.slice()});return out;
}
export function assertThreeBallCreatedControlLayout(layout){
 const proof=owned.get(layout);need(proof,'locally packed initial control layout required');assertThreeBallCreatedRegistration(proof.initial);
 for(const[name,expected]of [['sceneWords',proof.scene],['initializationWords',proof.initialization]]){const a=layout[name];let valid=false;try{valid=a instanceof Uint32Array&&a.length===expected.length&&Uint32Array.prototype.every.call(a,(x,i)=>x===expected[i]);}catch{/* Detached views cannot be initial source words. */}need(valid,'initial control words mutated or detached: '+name);}
 return layout;
}
export function decodeThreeBallCreatedControlLayout(layout){assertThreeBallCreatedControlLayout(layout);const {initial}=owned.get(layout);return decodeSceneInitialization(layout.sceneWords,layout.initializationWords,initial.record,layout.template);}
