/* SPDX-License-Identifier: Apache-2.0
 * Resident integer scene owner, source Rapier b716d375 / experimental-scene-activation.js.
 * Preserves native allocator IDs, holes, queue/list order and source split/sleep order.
 * Numerical activation/force facts MUST come from the original source-ordered graphs.
 * Host kernel execution below is a differential-test interpreter, never a GPU fallback.
 */
import '../experimental-arithmetic-graph.js';
import '../experimental-sleep-activation.js';
import '../experimental-scene-activation.js';
import '../experimental-cue-cloth-cache.js';
import '../experimental-live-registered-origin.js';
import {STATUS,REASON,UNSET} from './abi.mjs';
import {CONTACT_JOURNAL_LAYOUT as JL} from './contact-journal.mjs';
const Source=globalThis.LabSceneActivationExperimental, Sleep=globalThis.LabSleepActivationExperimental;
const U=UNSET, copy=x=>structuredClone(x), key=h=>h.index+':'+h.generation;
export const SCENE_PHASE=Object.freeze({initialChanges:1,initialEnergy:2,postWorld:3,preCollision:4,collisionApplied:5,observed:6,energyPending:7,created:8});
const PHASES={
 'source-user-changes-and-connectivity-complete-pre-collision':1,
 'source-collision-and-connectivity-complete-pre-energy':2,
 'live-three-ball-collision-and-connectivity-complete-pre-energy':2,
 'post-world-step-post-application':3,'post-activation-pre-solve':6,'source-created-pre-user-changes':8};
const H=Object.freeze({version:0,status:1,reason:2,phase:3,sourcePhase:4,bodySlots:5,bodyCount:6,epoch:7,awake:8,
 chunkN:9,chunkLength:10,chunkFreeCount:11,persistentN:12,persistentLength:13,persistentFreeCount:14,
 scan:15,split:16,contactLength:17,jointCount:18,removalCount:19,modifiedCount:20,consumedCount:21,
 resetMask:22,hotMask:23,eligibleMask:24,sleepMask:25,activeCount:26,incidenceValid:27,
 sleptCount:28,invalidatesJoints:29,invalidatesSolver:30,splitBid:31,localSplitCount:32,globalSplitCount:33,
 roleHead:34,roleShaft:35,roleGuide:36,clothFixed:37,clothHead:38,clothBound:39,clothActive:40,drained:41,incidenceCount:42,energyStage:43,energySeen:44,hotSeen:45});
const B=Object.freeze({present:0,index:1,generation:2,dynamic:3,changes:4,activeIsland:5,activeIndex:6,island:7,islandIndex:8,
 maxExtent:9,activation:10,jointCount:22,joint0:23,joint1:25});
const P=Object.freeze({nativeId:0,count:1,contacts:2,joints:3,removed:4,deniedUntil:5,sleeping:6,members:8,edges:14,jointList:142});
// 32 body slots retain initial registry order after removals. Six live chunk/island
// records are compact, while the 32-entry native-ID maps preserve allocator holes.
export const SCENE_LAYOUT=Object.freeze({version:1,header:H,body:B,persistent:P,maxBodies:32,maxDynamics:6,maxNativeIds:32,maxEdges:128,maxJoints:2,
 headerWords:64,bodyOffset:64,bodyStride:32,chunkMapOffset:1088,chunkOffset:1120,chunkStride:8,chunkFreeOffset:1168,
 persistentMapOffset:1200,persistentOffset:1232,persistentStride:144,persistentFreeOffset:2096,
 contactOffset:2128,contactStride:4,jointOffset:2640,jointStride:6,removalOffset:2652,removalStride:2,
 modifiedOffset:2908,consumedOffset:2940,activeOffset:2972,incidenceHeadOffset:2978,incidenceOffset:3042,
 // Incidence contains [edge,otherBodySlot] pairs in body-collider/outgoing/incoming order.
 incidenceCapacity:256,scratchOffset:3554,scratchWords:512,words:4066,bytes:16264});
const L=SCENE_LAYOUT;
export const SCENE_OPERATION=Object.freeze({link:1,unlink:2,edgeSwapRemove:3,weakWake:4,strongWake:5});
const fbits=x=>new Uint32Array(new Float32Array([x]).buffer)[0],frombits=x=>new Float32Array(new Uint32Array([x]).buffer)[0];
const assert=(p,m)=>{if(!p)throw new RangeError(m);};
const u=(x,m)=>{assert(Number.isInteger(x)&&x>=0&&x<=U,'Exact u32 required: '+m);return x;};
function capacity(s){const m=s.manager,p=m.persistent;for(const [map,free]of[[m.islands,m.free_islands],[p.islands,p.free_islands]])assert(map.v.length<=32&&map.n<=6&&free.length<=32,'Resident scene native allocator capacity exceeded');assert(p.contact_link_locs.length<=128&&p.joint_link_locs.length<=2,'Resident scene link capacity exceeded');for(const c of p.islands.v.filter(Boolean))assert(c.contact_links.length<=128&&c.joint_links.length<=2,'Resident scene per-island link capacity exceeded');}
/** Initial snapshot only; no per-h host state admission/readback. */
export function encodeSceneActivation(input){return packSceneActivationContext(Source.validate(input));}
function packSceneActivationContext(s){capacity(s);const a=new Uint32Array(L.words),m=s.manager,p=m.persistent;
 const slots=new Map(s.bodies.map((b,i)=>[key(b.handle),i])),slot=h=>{const n=slots.get(key(h));assert(n!==undefined,'Scene handle outside complete registry');return n;};
 for(const off of[L.chunkMapOffset,L.persistentMapOffset])a.fill(U,off,off+32);
 for(let i=0;i<6;i++){a[L.chunkOffset+i*L.chunkStride]=U;a[L.persistentOffset+i*L.persistentStride]=U;}
 a.fill(U,L.contactOffset,L.jointOffset);a.fill(U,L.jointOffset,L.removalOffset);
 const put=(k,v)=>a[H[k]]=u(v,k);
 for(const[k,v]of Object.entries({version:1,status:STATUS.RUNNING,phase:PHASES[s.phase],sourcePhase:PHASES[s.phase],invalidatesJoints:+!!s.effects?.requiresJointAssemblyInvalidation,bodySlots:s.bodies.length,bodyCount:s.bodies.length,epoch:m.active_set_epoch,awake:m.awake_island??U,chunkN:m.islands.n,chunkLength:m.islands.v.length,chunkFreeCount:m.free_islands.length,persistentN:p.islands.n,persistentLength:p.islands.v.length,persistentFreeCount:p.free_islands.length,scan:p.sleep_scan_stamp,split:p.split_island??U,contactLength:p.contact_link_locs.length,jointCount:p.joint_link_locs.length,modifiedCount:s.modifiedBodies.length,consumedCount:s.consumedModifiedBodies.length,splitBid:U,roleHead:U,roleShaft:U,roleGuide:U,clothFixed:U,clothHead:U}))put(k,v);
 for(const[name,k]of[['head','roleHead'],['shaft','roleShaft'],['guide','roleGuide']])if(s.roles?.[name]&&slots.has(key(s.roles[name])))put(k,slot(s.roles[name]));
 s.bodies.forEach((b,i)=>{const q=L.bodyOffset+i*32;a.set([1,b.handle.index,b.handle.generation,+(b.type==='Dynamic'),b.changes,b.ids.active_island_id,b.ids.active_set_id,b.ids.island_id,b.ids.island_index,fbits(b.maxExtent)],q);if(b.type==='Dynamic')writeActivation(a,q+B.activation,b.activation);assert(Array.isArray(b.jointAdjacency)&&b.jointAdjacency.length<=2,'Complete bounded joint adjacency required');a[q+B.jointCount]=b.jointAdjacency.length;b.jointAdjacency.forEach((h,j)=>a.set([h.index,h.generation],q+B.joint0+j*2));});
 let k=0;m.islands.v.forEach((c,id)=>{if(!c)return;const q=L.chunkOffset+k*8;a[L.chunkMapOffset+id]=k++;a[q]=id;a[q+1]=c.bodies.length;a.set(c.bodies.map(slot),q+2);});a.set(m.free_islands,L.chunkFreeOffset);
 const jointSlots=new Map(p.joint_link_locs.map(([j],i)=>[key(j.value),i]));p.joint_link_locs.forEach(([j,loc],i)=>{a.set([j.value.index,j.value.generation,...loc,U,U],L.jointOffset+i*6);});
 k=0;p.islands.v.forEach((c,id)=>{if(!c)return;const q=L.persistentOffset+k*144;a[L.persistentMapOffset+id]=k++;a.set([id,c.bodies.length,c.contact_links.length,c.joint_links.length,c.constraint_remove_count,c.split_denied_until,+c.sleeping],q);a.set(c.bodies.map(slot),q+P.members);a.set(c.contact_links.map(l=>l.edge_id),q+P.edges);c.contact_links.forEach((l,j)=>a.set([id,j,slot(l.body1),slot(l.body2)],L.contactOffset+l.edge_id*4));c.joint_links.forEach((l,j)=>{const n=jointSlots.get(key(l.key.value));a[q+P.jointList+j]=n;a.set([slot(l.body1),slot(l.body2)],L.jointOffset+n*6+4);});});a.set(p.free_islands,L.persistentFreeOffset);
 a.set(s.modifiedBodies.map(slot),L.modifiedOffset);a.set(s.consumedModifiedBodies.map(slot),L.consumedOffset);
 return a;
}
function writeActivation(a,q,x){a.set([x.normalized_linear_threshold,x.angular_threshold,x.time_until_sleep,x.time_since_can_sleep,+x.sleeping,...x.sleep_prev_pose.translation,...x.sleep_prev_pose.rotation].map(fbits),q);}
function readActivation(a,q,prior){return{...copy(prior),normalized_linear_threshold:frombits(a[q]),angular_threshold:frombits(a[q+1]),time_until_sleep:frombits(a[q+2]),time_since_can_sleep:frombits(a[q+3]),sleeping:frombits(a[q+4])!==0,sleep_prev_pose:{...copy(prior.sleep_prev_pose),translation:Array.from(a.slice(q+5,q+8),frombits),rotation:Array.from(a.slice(q+8,q+12),frombits)}};}
/** Diagnostic decode against immutable import metadata; no numeric evolution on host. */
export function decodeSceneActivation(a,template){assert(a instanceof Uint32Array&&a.length>=L.words&&a[H.version]===1,'Scene ABI mismatch');const s=copy(template),h=i=>({index:a[L.bodyOffset+i*32+1],generation:a[L.bodyOffset+i*32+2]}),chunk=id=>L.chunkOffset+a[L.chunkMapOffset+id]*8,pi=id=>L.persistentOffset+a[L.persistentMapOffset+id]*144;
 const phases={1:'source-user-changes-and-connectivity-complete-pre-collision',2:'source-collision-and-connectivity-complete-pre-energy',3:'post-world-step-post-application',6:'post-activation-pre-solve',8:'source-created-pre-user-changes'};s.phase=phases[a[H.sourcePhase]];s.bodies=template.bodies.flatMap((b,i)=>{const q=L.bodyOffset+i*32;if(!a[q])return[];const out=copy(b);delete out.raw;out.changes=a[q+B.changes];out.maxExtent=frombits(a[q+B.maxExtent]);out.ids={...out.ids,active_island_id:a[q+B.activeIsland],active_set_id:a[q+B.activeIndex],island_id:a[q+B.island],island_index:a[q+B.islandIndex]};if(a[q+B.dynamic])out.activation=readActivation(a,q+B.activation,b.activation);return[out];});
 const m=s.manager,p=m.persistent;m.active_set_epoch=a[H.epoch];m.awake_island=a[H.awake]===U?null:a[H.awake];m.free_islands=Array.from(a.slice(L.chunkFreeOffset,L.chunkFreeOffset+a[H.chunkFreeCount]));m.islands={n:a[H.chunkN],v:Array.from({length:a[H.chunkLength]},(_,id)=>{if(a[L.chunkMapOffset+id]===U)return null;const q=chunk(id);return{bodies:Array.from(a.slice(q+2,q+2+a[q+1]),h)};})};
 const joint=j=>{const q=L.jointOffset+j*6;return{key:{variant:'Impulse',value:{index:a[q],generation:a[q+1]}},body1:h(a[q+4]),body2:h(a[q+5])};};
 p.islands={n:a[H.persistentN],v:Array.from({length:a[H.persistentLength]},(_,id)=>{if(a[L.persistentMapOffset+id]===U)return null;const q=pi(id);return{bodies:Array.from(a.slice(q+P.members,q+P.members+a[q+P.count]),h),contact_links:Array.from(a.slice(q+P.edges,q+P.edges+a[q+P.contacts]),e=>({edge_id:e,body1:h(a[L.contactOffset+e*4+2]),body2:h(a[L.contactOffset+e*4+3])})),joint_links:Array.from(a.slice(q+P.jointList,q+P.jointList+a[q+P.joints]),joint),constraint_remove_count:a[q+P.removed],split_denied_until:a[q+P.deniedUntil],sleeping:!!a[q+P.sleeping]};})};
 p.free_islands=Array.from(a.slice(L.persistentFreeOffset,L.persistentFreeOffset+a[H.persistentFreeCount]));p.sleep_scan_stamp=a[H.scan];p.split_island=a[H.split]===U?null:a[H.split];p.contact_link_locs=Array.from({length:a[H.contactLength]},(_,e)=>Array.from(a.slice(L.contactOffset+e*4,L.contactOffset+e*4+2)));p.joint_link_locs=[];for(let j=0;j<2;j++){const q=L.jointOffset+j*6;if(a[q+2]!==U)p.joint_link_locs.push([joint(j).key,[a[q+2],a[q+3]]]);}p.joint_link_locs.sort((a,b)=>a[0].value.index-b[0].value.index||a[0].value.generation-b[0].value.generation);p.removal_journal=Array.from({length:a[H.removalCount]},(_,i)=>({body1:h(a[L.removalOffset+2*i]),body2:h(a[L.removalOffset+2*i+1])}));s.modifiedBodies=Array.from(a.slice(L.modifiedOffset,L.modifiedOffset+a[H.modifiedCount]),h);s.consumedModifiedBodies=Array.from(a.slice(L.consumedOffset,L.consumedOffset+a[H.consumedCount]),h);return s;
}

// Small shared, integer-only kernel dialect. This exact text is emitted as WGSL;
// the host test translator only removes WGSL types/literal suffixes. It does not
// translate source physics or provide a production host forwarding path.
const KERNEL=String.raw`
fn rc_scene_bp(b:u32,i:u32)->u32{return b+SL_bodyOffset+i*SL_bodyStride;}
fn rc_scene_cp(b:u32,id:u32)->u32{return b+SL_chunkOffset+rc_state[b+SL_chunkMapOffset+id]*SL_chunkStride;}
fn rc_scene_pp(b:u32,id:u32)->u32{return b+SL_persistentOffset+rc_state[b+SL_persistentMapOffset+id]*SL_persistentStride;}
fn rc_scene_ep(b:u32,id:u32)->u32{return b+SL_contactOffset+id*4u;}
fn rc_scene_jp(b:u32,id:u32)->u32{return b+SL_jointOffset+id*6u;}
fn rc_scene_bad(b:u32,reason:u32)->bool{rc_state[b+SH_status]=4u;rc_state[b+SH_reason]=reason;return false;}
fn rc_scene_ok(b:u32)->bool{return rc_state[b+SH_status]==1u;}
fn rc_scene_find_body(b:u32,index:u32,generation:u32)->u32{
 for(var i=0u;i<rc_state[b+SH_bodySlots];i++){let q=rc_scene_bp(b,i);if(rc_state[q+SB_present]!=0u&&rc_state[q+SB_index]==index&&rc_state[q+SB_generation]==generation){return i;}}return 0xffffffffu;
}
fn rc_scene_valid_body(b:u32,i:u32)->bool{return i<rc_state[b+SH_bodySlots]&&rc_state[rc_scene_bp(b,i)+SB_present]!=0u;}
fn rc_scene_enqueue(b:u32,i:u32)->bool{
 let q=rc_scene_bp(b,i);if((rc_state[q+SB_changes]&1u)!=0u){return true;}
 let n=rc_state[b+SH_modifiedCount];if(n>=32u){return rc_scene_bad(b,4u);}rc_state[q+SB_changes]=rc_state[q+SB_changes]|1u;rc_state[b+SL_modifiedOffset+n]=i;rc_state[b+SH_modifiedCount]=n+1u;return true;
}
fn rc_scene_free_persistent(b:u32,id:u32)->bool{
 let q=rc_scene_pp(b,id);let n=rc_state[b+SH_persistentFreeCount];if(n>=32u){return rc_scene_bad(b,4u);}
 rc_state[q+SP_nativeId]=0xffffffffu;rc_state[b+SL_persistentMapOffset+id]=0xffffffffu;rc_state[b+SH_persistentN]=rc_state[b+SH_persistentN]-1u;
 if(rc_state[b+SH_split]==id){rc_state[b+SH_split]=0xffffffffu;}rc_state[b+SL_persistentFreeOffset+n]=id;rc_state[b+SH_persistentFreeCount]=n+1u;return true;
}
fn rc_scene_alloc_persistent(b:u32,sleeping:u32)->u32{
 var id=rc_state[b+SH_persistentN];let freeCount=rc_state[b+SH_persistentFreeCount];if(freeCount!=0u){id=rc_state[b+SL_persistentFreeOffset+freeCount-1u];}
 var compact=0xffffffffu;for(var i=0u;i<6u;i++){if(rc_state[b+SL_persistentOffset+i*SL_persistentStride]==0xffffffffu){compact=i;break;}}
 if(id>=32u||compact==0xffffffffu){rc_scene_bad(b,4u);return 0xffffffffu;}
 if(id<rc_state[b+SH_persistentLength]&&rc_state[b+SL_persistentMapOffset+id]!=0xffffffffu){rc_scene_bad(b,6u);return 0xffffffffu;}
 if(freeCount!=0u){rc_state[b+SH_persistentFreeCount]=freeCount-1u;}if(id>=rc_state[b+SH_persistentLength]){rc_state[b+SH_persistentLength]=id+1u;}
 rc_state[b+SL_persistentMapOffset+id]=compact;let q=b+SL_persistentOffset+compact*SL_persistentStride;for(var j=0u;j<SL_persistentStride;j++){rc_state[q+j]=0u;}
 rc_state[q+SP_nativeId]=id;rc_state[q+SP_sleeping]=sleeping;rc_state[b+SH_persistentN]=rc_state[b+SH_persistentN]+1u;return id;
}
fn rc_scene_merge(b:u32,a:u32,c:u32)->u32{
 if(a==c){return a;}var big=a;var small=c;let qa=rc_scene_pp(b,a);let qc=rc_scene_pp(b,c);if(rc_state[qa+SP_count]<rc_state[qc+SP_count]){big=c;small=a;}
 let dst=rc_scene_pp(b,big);let src=rc_scene_pp(b,small);let n=rc_state[dst+SP_count];let z=rc_state[src+SP_count];let nc=rc_state[dst+SP_contacts];let zc=rc_state[src+SP_contacts];let nj=rc_state[dst+SP_joints];let zj=rc_state[src+SP_joints];
 if(n+z>6u||nc+zc>128u||nj+zj>2u){rc_scene_bad(b,4u);return 0xffffffffu;}
 for(var i=0u;i<z;i++){let v=rc_state[src+SP_members+i];let q=rc_scene_bp(b,v);rc_state[q+SB_island]=big;rc_state[q+SB_islandIndex]=n+i;rc_state[dst+SP_members+n+i]=v;}
 for(var i=0u;i<zc;i++){let e=rc_state[src+SP_edges+i];let q=rc_scene_ep(b,e);rc_state[q]=big;rc_state[q+1u]=nc+i;rc_state[dst+SP_edges+nc+i]=e;}
 for(var i=0u;i<zj;i++){let e=rc_state[src+SP_jointList+i];let q=rc_scene_jp(b,e);rc_state[q+2u]=big;rc_state[q+3u]=nj+i;rc_state[dst+SP_jointList+nj+i]=e;}
 rc_state[dst+SP_count]=n+z;rc_state[dst+SP_contacts]=nc+zc;rc_state[dst+SP_joints]=nj+zj;rc_state[dst+SP_removed]=rc_scene_add(rc_state[dst+SP_removed],rc_state[src+SP_removed]);rc_state[dst+SP_sleeping]=rc_state[dst+SP_sleeping]&rc_state[src+SP_sleeping];
 rc_scene_free_persistent(b,small);return big;
}
fn rc_scene_wake_chunk(b:u32,id:u32)->bool{
 if(id==rc_state[b+SH_awake]||id>=rc_state[b+SH_chunkLength]||rc_state[b+SL_chunkMapOffset+id]==0xffffffffu){return true;}
 let c=rc_scene_cp(b,id);let n=rc_state[c+1u];let awake=rc_state[b+SH_awake];rc_state[b+SH_epoch]=rc_scene_add(rc_state[b+SH_epoch],1u);
 if(awake==0xffffffffu){rc_state[b+SH_awake]=id;}else{
  let dst=rc_scene_cp(b,awake);let at=rc_state[dst+1u];let freeCount=rc_state[b+SH_chunkFreeCount];if(at+n>6u||freeCount>=32u){return rc_scene_bad(b,4u);}
  rc_state[b+SL_chunkMapOffset+id]=0xffffffffu;rc_state[b+SH_chunkN]=rc_state[b+SH_chunkN]-1u;rc_state[b+SL_chunkFreeOffset+freeCount]=id;rc_state[b+SH_chunkFreeCount]=freeCount+1u;
  for(var j=0u;j<n;j++){let i=rc_state[c+2u+j];let q=rc_scene_bp(b,i);rc_state[q+SB_activeIsland]=awake;rc_state[q+SB_activeIndex]=at+j;rc_state[dst+2u+at+j]=i;}rc_state[dst+1u]=at+n;
 }
 for(var j=0u;j<n;j++){let i=rc_state[c+2u+j];let q=rc_scene_bp(b,i);if(!rc_scene_enqueue(b,i)){return false;}if(rc_state[q+SB_activation+4u]!=0u){rc_state[q+SB_changes]=rc_state[q+SB_changes]|4u;}rc_state[q+SB_activation+4u]=0u;}
 if(awake!=0xffffffffu){rc_state[c]=0xffffffffu;}return true;
}
fn rc_scene_wake(b:u32,i:u32,strong:bool)->bool{
 if(!rc_scene_valid_body(b,i)){return true;}let q=rc_scene_bp(b,i);if(rc_state[q+SB_dynamic]==0u){return true;}
 if(strong){rc_state[b+SH_resetMask]=rc_state[b+SH_resetMask]|(1u<<i);}rc_state[q+SB_activation+4u]=0u;
 let p=rc_scene_pp(b,rc_state[q+SB_island]);if(rc_state[p+SP_sleeping]!=0u){rc_state[p+SP_sleeping]=0u;let n=rc_state[p+SP_count];
  for(var j=0u;j<n;j++){let v=rc_state[p+SP_members+j];if(!rc_scene_enqueue(b,v)){return false;}rc_state[rc_scene_bp(b,v)+SB_activation+4u]=0u;rc_state[b+SH_resetMask]=rc_state[b+SH_resetMask]|(1u<<v);}
  for(var j=0u;j<n;j++){let v=rc_state[p+SP_members+j];if(!rc_scene_wake_chunk(b,rc_state[rc_scene_bp(b,v)+SB_activeIsland])){return false;}}
 }else{if(!rc_scene_wake_chunk(b,rc_state[q+SB_activeIsland])){return false;}}return true;
}
fn rc_scene_remove_body(b:u32,i:u32)->bool{
 if(!rc_scene_valid_body(b,i)){return rc_scene_bad(b,6u);}let q=rc_scene_bp(b,i);rc_state[b+SH_epoch]=rc_scene_add(rc_state[b+SH_epoch],1u);
 if(rc_state[q+SB_dynamic]!=0u){let id=rc_state[q+SB_island];let p=rc_scene_pp(b,id);let at=rc_state[q+SB_islandIndex];let n=rc_state[p+SP_count]-1u;let moved=rc_state[p+SP_members+n];rc_state[p+SP_count]=n;
  if(at<n){rc_state[p+SP_members+at]=moved;rc_state[rc_scene_bp(b,moved)+SB_islandIndex]=at;}rc_state[p+SP_removed]=rc_scene_add(rc_state[p+SP_removed],1u);
  if(n==0u){for(var j=0u;j<rc_state[p+SP_contacts];j++){let ep=rc_scene_ep(b,rc_state[p+SP_edges+j]);rc_state[ep]=0xffffffffu;rc_state[ep+1u]=0xffffffffu;}
   for(var j=0u;j<rc_state[p+SP_joints];j++){let jp=rc_scene_jp(b,rc_state[p+SP_jointList+j]);rc_state[jp+2u]=0xffffffffu;rc_state[jp+3u]=0xffffffffu;rc_state[b+SH_jointCount]=rc_state[b+SH_jointCount]-1u;}if(!rc_scene_free_persistent(b,id)){return false;}}
  let cid=rc_state[q+SB_activeIsland];let c=rc_scene_cp(b,cid);let pos=rc_state[q+SB_activeIndex];let size=rc_state[c+1u]-1u;let last=rc_state[c+2u+size];rc_state[c+1u]=size;
  if(pos<size){rc_state[c+2u+pos]=last;rc_state[rc_scene_bp(b,last)+SB_activeIndex]=pos;if(!rc_scene_enqueue(b,last)){return false;}}
  if(size==0u){if(rc_state[b+SH_awake]==cid){rc_state[b+SH_awake]=0xffffffffu;}let freeCount=rc_state[b+SH_chunkFreeCount];if(freeCount>=32u){return rc_scene_bad(b,4u);}rc_state[b+SL_chunkFreeOffset+freeCount]=cid;rc_state[b+SH_chunkFreeCount]=freeCount+1u;rc_state[b+SL_chunkMapOffset+cid]=0xffffffffu;rc_state[b+SH_chunkN]=rc_state[b+SH_chunkN]-1u;rc_state[c]=0xffffffffu;}
 }
 rc_state[q+SB_present]=0u;rc_state[b+SH_bodyCount]=rc_state[b+SH_bodyCount]-1u;return true;
}
fn rc_scene_link(b:u32,edge:u32,first:u32,second:u32)->bool{
 if(edge>=128u){return rc_scene_bad(b,4u);}let e=rc_scene_ep(b,edge);if(edge>=rc_state[b+SH_contactLength]){for(var j=rc_state[b+SH_contactLength];j<=edge;j++){let q=rc_scene_ep(b,j);rc_state[q]=0xffffffffu;rc_state[q+1u]=0xffffffffu;}rc_state[b+SH_contactLength]=edge+1u;}if(rc_state[e]!=0xffffffffu){return true;}
 if(!rc_scene_valid_body(b,first)||!rc_scene_valid_body(b,second)){return rc_scene_bad(b,6u);}let ia=rc_state[rc_scene_bp(b,first)+SB_island];let ib=rc_state[rc_scene_bp(b,second)+SB_island];var id=ia;
 if(ia!=0xffffffffu&&ib!=0xffffffffu){id=rc_scene_merge(b,ia,ib);}else if(ia==0xffffffffu){id=ib;}if(!rc_scene_ok(b)){return false;}if(id==0xffffffffu){return true;}
 let p=rc_scene_pp(b,id);let n=rc_state[p+SP_contacts];if(n>=128u){return rc_scene_bad(b,4u);}rc_state[e]=id;rc_state[e+1u]=n;rc_state[e+2u]=first;rc_state[e+3u]=second;rc_state[p+SP_edges+n]=edge;rc_state[p+SP_contacts]=n+1u;return true;
}
fn rc_scene_unlink(b:u32,edge:u32)->bool{
 if(edge>=rc_state[b+SH_contactLength]){return true;}let e=rc_scene_ep(b,edge);let id=rc_state[e];if(id==0xffffffffu){return true;}let n=rc_state[b+SH_removalCount];if(n>=128u){return rc_scene_bad(b,4u);}
 let p=rc_scene_pp(b,id);let at=rc_state[e+1u];let size=rc_state[p+SP_contacts]-1u;let last=rc_state[p+SP_edges+size];rc_state[p+SP_contacts]=size;if(at<size){rc_state[p+SP_edges+at]=last;rc_state[rc_scene_ep(b,last)+1u]=at;}
 rc_state[e]=0xffffffffu;rc_state[e+1u]=0xffffffffu;rc_state[b+SL_removalOffset+2u*n]=rc_state[e+2u];rc_state[b+SL_removalOffset+2u*n+1u]=rc_state[e+3u];rc_state[b+SH_removalCount]=n+1u;return true;
}
fn rc_scene_edge_swap_remove(b:u32,removed:u32,last:u32)->bool{
 let n=rc_state[b+SH_contactLength];if(removed>=n){return true;}let e=rc_scene_ep(b,removed);if(rc_state[e]!=0xffffffffu){return rc_scene_bad(b,6u);}if(n==last+1u){rc_state[b+SH_contactLength]=n-1u;if(removed!=last){let src=rc_scene_ep(b,last);for(var j=0u;j<4u;j++){rc_state[e+j]=rc_state[src+j];}if(rc_state[e]!=0xffffffffu){rc_state[rc_scene_pp(b,rc_state[e])+SP_edges+rc_state[e+1u]]=removed;}}}return true;
}
fn rc_scene_move_contact(b:u32,base:u32,destination:u32,index:u32)->bool{
 let src=rc_scene_pp(b,base);let edge=rc_state[src+SP_edges+index];let n=rc_state[src+SP_contacts]-1u;let last=rc_state[src+SP_edges+n];rc_state[src+SP_contacts]=n;if(index<n){rc_state[src+SP_edges+index]=last;rc_state[rc_scene_ep(b,last)+1u]=index;}
 let e=rc_scene_ep(b,edge);if(destination==0xffffffffu){rc_state[e]=0xffffffffu;rc_state[e+1u]=0xffffffffu;}else{let dst=rc_scene_pp(b,destination);let at=rc_state[dst+SP_contacts];if(at>=128u){return rc_scene_bad(b,4u);}rc_state[e]=destination;rc_state[e+1u]=at;rc_state[dst+SP_edges+at]=edge;rc_state[dst+SP_contacts]=at+1u;}return true;
}
fn rc_scene_move_joint(b:u32,base:u32,destination:u32,index:u32)->bool{
 let src=rc_scene_pp(b,base);let item=rc_state[src+SP_jointList+index];let n=rc_state[src+SP_joints]-1u;let last=rc_state[src+SP_jointList+n];rc_state[src+SP_joints]=n;if(index<n){rc_state[src+SP_jointList+index]=last;rc_state[rc_scene_jp(b,last)+3u]=index;}
 let e=rc_scene_jp(b,item);if(destination==0xffffffffu){rc_state[e+2u]=0xffffffffu;rc_state[e+3u]=0xffffffffu;rc_state[b+SH_jointCount]=rc_state[b+SH_jointCount]-1u;}else{let dst=rc_scene_pp(b,destination);let at=rc_state[dst+SP_joints];if(at>=2u){return rc_scene_bad(b,4u);}rc_state[e+2u]=destination;rc_state[e+3u]=at;rc_state[dst+SP_jointList+at]=item;rc_state[dst+SP_joints]=at+1u;}return true;
}
fn rc_scene_move_member(b:u32,base:u32,destination:u32,index:u32)->bool{
 let src=rc_scene_pp(b,base);let item=rc_state[src+SP_members+index];let n=rc_state[src+SP_count]-1u;let last=rc_state[src+SP_members+n];rc_state[src+SP_count]=n;if(index<n){rc_state[src+SP_members+index]=last;rc_state[rc_scene_bp(b,last)+SB_islandIndex]=index;}
 let dst=rc_scene_pp(b,destination);let at=rc_state[dst+SP_count];if(at>=6u){return rc_scene_bad(b,4u);}let q=rc_scene_bp(b,item);rc_state[q+SB_island]=destination;rc_state[q+SB_islandIndex]=at;rc_state[dst+SP_members+at]=item;rc_state[dst+SP_count]=at+1u;return true;
}
`;
const CONSTANTS=()=>Object.entries({SH:H,SB:B,SP:P,SL:L,JH:JL.header,JC:JL.collider,JE:JL.edge,JL}).flatMap(([prefix,group])=>Object.entries(group).filter(([,v])=>Number.isInteger(v)).map(([k,v])=>`const ${prefix}_${k}:u32=${v}u;`)).join('\n');
const HELPERS=`fn rc_scene_add(a:u32,b:u32)->u32{return a+b;}\nfn rc_scene_float_gt(a:u32,b:u32)->bool{let am=a&0x7fffffffu;let bm=b&0x7fffffffu;if(am>0x7f800000u||bm>0x7f800000u||(am|bm)==0u){return false;}let aneg=(a&0x80000000u)!=0u;let bneg=(b&0x80000000u)!=0u;if(aneg!=bneg){return !aneg;}if(aneg){return a<b;}return a>b;}\nfn rc_scene_float_eq(a:u32,b:u32)->bool{let am=a&0x7fffffffu;let bm=b&0x7fffffffu;if(am>0x7f800000u||bm>0x7f800000u){return false;}return a==b||(am|bm)==0u;}`;
export function generateSceneActivationWGSL(){return '// Resident source scene integer owner. One invocation owns one candidate.\n'+CONSTANTS()+'\n'+HELPERS+'\n'+KERNEL+'\n'+SPLIT_KERNEL+'\n'+PHASE_KERNEL+'\n'+JOURNAL_BRIDGE;}
/** Test-only execution of exactly the emitted integer kernels. */
export function sceneActivationTestKernels(rc_state,{extraWGSL=''}={}){assert(rc_state instanceof Uint32Array,'u32 scene storage required');let text=CONSTANTS()+'\n'+KERNEL+'\n'+SPLIT_KERNEL+'\n'+PHASE_KERNEL+'\n'+JOURNAL_BRIDGE+'\n'+extraWGSL;const names=[...text.matchAll(/fn (rc_scene_\w+)\(/g)].map(m=>m[1]);text=text.replace(/fn (\w+)\(([^)]*)\)(?:->(?:u32|bool))?\s*\{/g,(_,n,args)=>`function ${n}(${args.replace(/:(?:u32|bool)/g,'')}){`).replace(/:(?:u32|bool)(?=\s*=)/g,'').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let').replace(/\bloop\s*\{/g,'while(true){');return new Function('rc_state','rc_scene_add','rc_scene_float_gt','rc_scene_float_eq',text+'\nreturn {'+names.join(',')+'};')(rc_state,(a,b)=>(a+b)>>>0,(a,b)=>frombits(a)>frombits(b),(a,b)=>frombits(a)===frombits(b));}

const SPLIT_KERNEL=String.raw`
fn rc_scene_find_root(b:u32,x:u32)->u32{
 let s=b+SL_scratchOffset;var at=x;for(var limit=0u;limit<6u;limit++){let parent=rc_state[s+at];if(parent==at){return at;}rc_state[s+at]=rc_state[s+parent];at=rc_state[s+at];}rc_scene_bad(b,6u);return 0xffffffffu;
}
fn rc_scene_union(b:u32,a:u32,c:u32)->bool{
 let s=b+SL_scratchOffset;var big=rc_scene_find_root(b,a);var small=rc_scene_find_root(b,c);if(!rc_scene_ok(b)){return false;}if(big==small){return true;}if(rc_state[s+6u+big]<rc_state[s+6u+small]){let t=big;big=small;small=t;}rc_state[s+small]=big;rc_state[s+6u+big]=rc_state[s+6u+big]+rc_state[s+6u+small];return true;
}
fn rc_scene_member_node(b:u32,id:u32,member:u32)->u32{
 let p=rc_scene_pp(b,id);for(var j=0u;j<rc_state[p+SP_count];j++){if(rc_state[p+SP_members+j]==member){return j;}}return 0xffffffffu;
}
fn rc_scene_global_split(b:u32)->bool{
 let id=rc_state[b+SH_split];rc_state[b+SH_split]=0xffffffffu;if(id==0xffffffffu||id>=rc_state[b+SH_persistentLength]||rc_state[b+SL_persistentMapOffset+id]==0xffffffffu){return true;}
 let p=rc_scene_pp(b,id);if(rc_state[p+SP_sleeping]!=0u){return true;}if(rc_state[b+SH_scan]>0xffffffefu){return rc_scene_bad(b,6u);}let n=rc_state[p+SP_count];
 if(n>5u){return rc_scene_bad(b,6u);}if(n<=1u){rc_state[p+SP_removed]=0u;rc_state[p+SP_deniedUntil]=rc_state[b+SH_scan]+16u;return true;}
 let s=b+SL_scratchOffset;for(var i=0u;i<n;i++){rc_state[s+i]=i;rc_state[s+6u+i]=1u;rc_state[s+12u+i]=0xffffffffu;}
 let contacts=rc_state[p+SP_contacts];let joints=rc_state[p+SP_joints];
 for(var i=0u;i<contacts;i++){let e=rc_scene_ep(b,rc_state[p+SP_edges+i]);let a=rc_scene_member_node(b,id,rc_state[e+2u]);let c=rc_scene_member_node(b,id,rc_state[e+3u]);if(a!=0xffffffffu&&c!=0xffffffffu){if(!rc_scene_union(b,a,c)){return false;}}var node=a;if(node==0xffffffffu){node=c;}rc_state[s+18u+i]=node;}
 for(var i=0u;i<joints;i++){let e=rc_scene_jp(b,rc_state[p+SP_jointList+i]);let a=rc_scene_member_node(b,id,rc_state[e+4u]);let c=rc_scene_member_node(b,id,rc_state[e+5u]);if(a!=0xffffffffu&&c!=0xffffffffu){if(!rc_scene_union(b,a,c)){return false;}}var node=a;if(node==0xffffffffu){node=c;}rc_state[s+146u+i]=node;}
 for(var i=0u;i<n;i++){rc_state[s+i]=rc_scene_find_root(b,i);}if(!rc_scene_ok(b)){return false;}var keep=0u;var keepSize=0u;var count=0u;
 for(var i=0u;i<n;i++){if(rc_state[s+i]==i){count++;if(rc_state[s+6u+i]>keepSize){keep=i;keepSize=rc_state[s+6u+i];}}}
 if(count>1u){rc_state[s+12u+keep]=id;for(var i=0u;i<n;i++){let root=rc_state[s+i];if(rc_state[s+12u+root]==0xffffffffu){let destination=rc_scene_alloc_persistent(b,rc_state[p+SP_sleeping]);if(!rc_scene_ok(b)){return false;}rc_state[s+12u+root]=destination;rc_state[b+SH_globalSplitCount]=rc_state[b+SH_globalSplitCount]+1u;}}
  var i=contacts;while(i>0u){i--;let node=rc_state[s+18u+i];var destination=0xffffffffu;if(node!=0xffffffffu){destination=rc_state[s+12u+rc_state[s+node]];}if(destination!=id){if(!rc_scene_move_contact(b,id,destination,i)){return false;}}}
  i=joints;while(i>0u){i--;let node=rc_state[s+146u+i];var destination=0xffffffffu;if(node!=0xffffffffu){destination=rc_state[s+12u+rc_state[s+node]];}if(destination!=id){if(!rc_scene_move_joint(b,id,destination,i)){return false;}}}
  i=n;while(i>0u){i--;let destination=rc_state[s+12u+rc_state[s+i]];if(destination!=id){if(!rc_scene_move_member(b,id,destination,i)){return false;}}}
 }
 rc_state[p+SP_removed]=0u;rc_state[p+SP_deniedUntil]=rc_state[b+SH_scan]+16u;return true;
}
// The contact owner emits incidence in actual body collider order, outgoing
// then incoming order. Persistent link order must NEVER substitute for it.
fn rc_scene_incidence_begin(b:u32)->bool{
 rc_state[b+SH_incidenceValid]=0u;rc_state[b+SH_incidenceCount]=0u;for(var i=0u;i<32u;i++){rc_state[b+SL_incidenceHeadOffset+2u*i]=0xffffffffu;rc_state[b+SL_incidenceHeadOffset+2u*i+1u]=0u;}return true;
}
fn rc_scene_incidence_body(b:u32,member:u32)->bool{
 if(!rc_scene_valid_body(b,member)){return rc_scene_bad(b,6u);}let q=b+SL_incidenceHeadOffset+2u*member;if(rc_state[q]!=0xffffffffu){return rc_scene_bad(b,6u);}rc_state[q]=rc_state[b+SH_incidenceCount];return true;
}
fn rc_scene_incidence_append(b:u32,member:u32,edge:u32,other:u32)->bool{
 if(!rc_scene_valid_body(b,member)||!rc_scene_valid_body(b,other)||edge>=rc_state[b+SH_contactLength]){return rc_scene_bad(b,6u);}let q=b+SL_incidenceHeadOffset+2u*member;let n=rc_state[b+SH_incidenceCount];if(n>=256u){return rc_scene_bad(b,4u);}if(rc_state[q]==0xffffffffu||rc_state[q]+rc_state[q+1u]!=n){return rc_scene_bad(b,6u);}
 let e=rc_scene_ep(b,edge);if(rc_state[e]==0xffffffffu||!((rc_state[e+2u]==member&&rc_state[e+3u]==other)||(rc_state[e+3u]==member&&rc_state[e+2u]==other))){return rc_scene_bad(b,6u);}
 for(var j=0u;j<rc_state[q+1u];j++){if(rc_state[b+SL_incidenceOffset+2u*(rc_state[q]+j)]==edge){return rc_scene_bad(b,6u);}}
 rc_state[b+SL_incidenceOffset+2u*n]=edge;rc_state[b+SL_incidenceOffset+2u*n+1u]=other;rc_state[q+1u]=rc_state[q+1u]+1u;rc_state[b+SH_incidenceCount]=n+1u;return true;
}
fn rc_scene_incidence_end(b:u32)->bool{rc_state[b+SH_incidenceValid]=1u;return true;}
fn rc_scene_validate_incidence(b:u32,id:u32)->bool{
 if(rc_state[b+SH_incidenceValid]!=1u){return rc_scene_bad(b,6u);}let p=rc_scene_pp(b,id);if(rc_state[p+SP_count]>4u||rc_state[p+SP_joints]!=0u){return rc_scene_bad(b,6u);}
 for(var i=0u;i<rc_state[p+SP_count];i++){let member=rc_state[p+SP_members+i];let q=b+SL_incidenceHeadOffset+2u*member;if(rc_state[rc_scene_bp(b,member)+SB_jointCount]!=0u||rc_state[q]==0xffffffffu){return rc_scene_bad(b,6u);}var expected=0u;
  for(var j=0u;j<rc_state[p+SP_contacts];j++){let edge=rc_state[p+SP_edges+j];let e=rc_scene_ep(b,edge);if(rc_state[e+2u]==member||rc_state[e+3u]==member){expected++;var seen=false;for(var z=0u;z<rc_state[q+1u];z++){if(rc_state[b+SL_incidenceOffset+2u*(rc_state[q]+z)]==edge){seen=true;}}if(!seen){return rc_scene_bad(b,6u);}}}
  if(expected!=rc_state[q+1u]){return rc_scene_bad(b,6u);}
 }return true;
}
fn rc_scene_local_split(b:u32,id:u32,first:u32,second:u32)->bool{
 if(!rc_scene_validate_incidence(b,id)){return false;}let s=b+SL_scratchOffset;for(var i=0u;i<32u;i++){rc_state[s+148u+i]=0xffffffffu;}
 rc_state[s+180u]=first;rc_state[s+186u]=second;rc_state[s+192u]=first;rc_state[s+198u]=second;for(var i=0u;i<4u;i++){rc_state[s+204u+i]=1u;}rc_state[s+148u+first]=0u;rc_state[s+148u+second]=1u;var expansions=0u;
 loop {for(var side=0u;side<2u;side++){let frontier=s+180u+side*6u;let reached=s+192u+side*6u;let frontierCount=rc_state[s+204u+side];
  if(frontierCount==0u){let p=rc_scene_pp(b,id);let destination=rc_scene_alloc_persistent(b,rc_state[p+SP_sleeping]);if(!rc_scene_ok(b)){return false;}let count=rc_state[s+206u+side];
   for(var i=0u;i<count;i++){let member=rc_state[reached+i];let q=b+SL_incidenceHeadOffset+2u*member;for(var j=0u;j<rc_state[q+1u];j++){let edge=rc_state[b+SL_incidenceOffset+2u*(rc_state[q]+j)];let e=rc_scene_ep(b,edge);if(rc_state[e]==id){if(!rc_scene_move_contact(b,id,destination,rc_state[e+1u])){return false;}}}}
   for(var i=0u;i<count;i++){let member=rc_state[reached+i];if(!rc_scene_move_member(b,id,destination,rc_state[rc_scene_bp(b,member)+SB_islandIndex])){return false;}}rc_state[b+SH_localSplitCount]=rc_state[b+SH_localSplitCount]+1u;return true;
  }
  let member=rc_state[frontier+frontierCount-1u];rc_state[s+204u+side]=frontierCount-1u;let q=b+SL_incidenceHeadOffset+2u*member;var met=false;
  for(var j=0u;j<rc_state[q+1u];j++){let other=rc_state[b+SL_incidenceOffset+2u*(rc_state[q]+j)+1u];if(!rc_scene_valid_body(b,other)||other==member||rc_state[rc_scene_bp(b,other)+SB_island]!=id){continue;}let seen=rc_state[s+148u+other];if(seen!=0xffffffffu){if(seen!=side){met=true;}}else{let fc=rc_state[s+204u+side];let rc=rc_state[s+206u+side];if(fc>=6u||rc>=6u){return rc_scene_bad(b,4u);}rc_state[s+148u+other]=side;rc_state[frontier+fc]=other;rc_state[reached+rc]=other;rc_state[s+204u+side]=fc+1u;rc_state[s+206u+side]=rc+1u;}}
  if(met){return true;}expansions++;if(expansions>=1024u){let p=rc_scene_pp(b,id);rc_state[p+SP_removed]=rc_scene_add(rc_state[p+SP_removed],1u);return true;}
 }}
}
`;

const PHASE_KERNEL=String.raw`
fn rc_scene_capacity(b:u32)->bool{
 var dynamics=0u;for(var i=0u;i<rc_state[b+SH_bodySlots];i++){let q=rc_scene_bp(b,i);if(rc_state[q+SB_present]!=0u&&rc_state[q+SB_dynamic]!=0u){dynamics++;}}
 if(dynamics<=5u){return true;}if(dynamics!=6u){return rc_scene_bad(b,6u);}var cue=0xffffffffu;
 for(var id=0u;id<rc_state[b+SH_persistentLength];id++){if(rc_state[b+SL_persistentMapOffset+id]==0xffffffffu){continue;}let p=rc_scene_pp(b,id);if(rc_state[p+SP_joints]!=0u){if(cue!=0xffffffffu){return rc_scene_bad(b,6u);}cue=id;}else if(rc_state[p+SP_count]>4u){return rc_scene_bad(b,6u);}}
 if(cue==0xffffffffu){return rc_scene_bad(b,6u);}let p=rc_scene_pp(b,cue);if(rc_state[p+SP_count]!=2u||rc_state[p+SP_joints]!=2u){return rc_scene_bad(b,6u);}let first=rc_state[p+SP_members];let second=rc_state[p+SP_members+1u];var firstCount=0u;var secondCount=0u;var fixed=0xffffffffu;
 for(var j=0u;j<2u;j++){let e=rc_scene_jp(b,rc_state[p+SP_jointList+j]);if(rc_state[e+4u]==rc_state[e+5u]){return rc_scene_bad(b,6u);}for(var side=0u;side<2u;side++){let member=rc_state[e+4u+side];if(!rc_scene_valid_body(b,member)){return rc_scene_bad(b,6u);}let q=rc_scene_bp(b,member);if(rc_state[q+SB_dynamic]!=0u){if(member==first){firstCount++;}else if(member==second){secondCount++;}else{return rc_scene_bad(b,6u);}}else{if(fixed!=0xffffffffu&&fixed!=member){return rc_scene_bad(b,6u);}fixed=member;}}}
 if(fixed==0xffffffffu||!((firstCount==1u&&secondCount==2u)||(firstCount==2u&&secondCount==1u))){return rc_scene_bad(b,6u);}var head=first;var shaft=second;if(firstCount==2u){head=second;shaft=first;}
 for(var i=0u;i<rc_state[b+SH_bodySlots];i++){let q=rc_scene_bp(b,i);if(rc_state[q+SB_present]==0u){continue;}var count=0u;for(var j=0u;j<2u;j++){let e=rc_scene_jp(b,rc_state[p+SP_jointList+j]);if(rc_state[e+4u]==i||rc_state[e+5u]==i){count++;var found=false;for(var z=0u;z<rc_state[q+SB_jointCount];z++){if(rc_state[q+SB_joint0+2u*z]==rc_state[e]&&rc_state[q+SB_joint0+2u*z+1u]==rc_state[e+1u]){found=true;}}if(!found){return rc_scene_bad(b,6u);}}}if(count!=rc_state[q+SB_jointCount]){return rc_scene_bad(b,6u);}}
 if(rc_state[p+SP_contacts]!=0u){if(rc_state[p+SP_contacts]!=1u||rc_state[b+SH_clothBound]!=1u||rc_state[b+SH_clothActive]!=1u||rc_state[b+SH_clothHead]!=head){return rc_scene_bad(b,6u);}let e=rc_scene_ep(b,rc_state[p+SP_edges]);if(rc_state[e+2u]!=rc_state[b+SH_clothFixed]||rc_state[e+3u]!=head||rc_state[rc_scene_bp(b,rc_state[e+2u])+SB_dynamic]!=0u){return rc_scene_bad(b,6u);}}
 for(var id=0u;id<rc_state[b+SH_persistentLength];id++){if(id==cue||rc_state[b+SL_persistentMapOffset+id]==0xffffffffu){continue;}let other=rc_scene_pp(b,id);for(var j=0u;j<rc_state[other+SP_contacts];j++){let e=rc_scene_ep(b,rc_state[other+SP_edges+j]);if(rc_state[e+2u]==first||rc_state[e+2u]==second||rc_state[e+3u]==first||rc_state[e+3u]==second){return rc_scene_bad(b,6u);}}}
 rc_state[b+SH_roleHead]=head;rc_state[b+SH_roleShaft]=shaft;rc_state[b+SH_roleGuide]=fixed;return true;
}
fn rc_scene_begin(b:u32)->bool{
 if(!rc_scene_ok(b)){return false;}let phase=rc_state[b+SH_phase];if(phase!=1u&&phase!=2u&&phase!=3u){return rc_scene_bad(b,6u);}
 rc_state[b+SH_resetMask]=0u;rc_state[b+SH_sleepMask]=0u;rc_state[b+SH_sleptCount]=0u;rc_state[b+SH_invalidatesSolver]=0u;rc_state[b+SH_localSplitCount]=0u;rc_state[b+SH_globalSplitCount]=0u;rc_state[b+SH_splitBid]=0xffffffffu;
 if(phase==3u){rc_state[b+SH_drained]=0u;rc_state[b+SH_invalidatesJoints]=0u;}else{rc_state[b+SH_drained]=1u;if(phase==2u){for(var j=0u;j<rc_state[b+SH_consumedCount];j++){let member=rc_state[b+SL_consumedOffset+j];if(rc_scene_valid_body(b,member)&&rc_state[rc_scene_bp(b,member)+SB_changes]!=0u){return rc_scene_bad(b,6u);}}rc_state[b+SH_consumedCount]=0u;}}
 rc_state[b+SH_phase]=4u;return true;
}
fn rc_scene_api_call(b:u32,member:u32,strong:bool)->bool{
 if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=4u||rc_state[b+SH_drained]!=0u||!rc_scene_valid_body(b,member)){return rc_scene_bad(b,6u);}let q=rc_scene_bp(b,member);if(rc_state[q+SB_dynamic]==0u){return rc_scene_bad(b,6u);}if(!rc_scene_enqueue(b,member)){return false;}
 if(strong){if(rc_state[q+SB_activation+4u]!=0u){rc_state[q+SB_changes]=rc_state[q+SB_changes]|4u;}rc_state[q+SB_activation+4u]=0u;rc_state[b+SH_resetMask]=rc_state[b+SH_resetMask]|(1u<<member);}return true;
}
fn rc_scene_withdraw_cue(b:u32)->bool{
 if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=4u||rc_state[b+SH_drained]!=0u){return rc_scene_bad(b,6u);}if(!rc_scene_capacity(b)){return false;}
 let head=rc_state[b+SH_roleHead];let shaft=rc_state[b+SH_roleShaft];let guide=rc_state[b+SH_roleGuide];if(!rc_scene_valid_body(b,head)||!rc_scene_valid_body(b,shaft)||!rc_scene_valid_body(b,guide)||head==shaft||head==guide||shaft==guide){return rc_scene_bad(b,6u);}
 if(!rc_scene_remove_body(b,head)||!rc_scene_remove_body(b,shaft)||!rc_scene_remove_body(b,guide)){return false;}return true;
}
fn rc_scene_drain_modified(b:u32)->bool{
 if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=4u){return rc_scene_bad(b,6u);}if(rc_state[b+SH_drained]!=0u){return true;}
 let n=rc_state[b+SH_modifiedCount];for(var j=0u;j<n;j++){rc_state[b+SL_consumedOffset+j]=rc_state[b+SL_modifiedOffset+j];}rc_state[b+SH_consumedCount]=n;rc_state[b+SH_modifiedCount]=0u;
 for(var j=0u;j<n;j++){let member=rc_state[b+SL_consumedOffset+j];if(!rc_scene_valid_body(b,member)){continue;}let q=rc_scene_bp(b,member);let flags=rc_state[q+SB_changes];if(flags!=1u&&flags!=5u){return rc_scene_bad(b,6u);}rc_state[b+SH_epoch]=rc_scene_add(rc_state[b+SH_epoch],1u);if((flags&4u)!=0u){if(!rc_scene_wake(b,member,false)){return false;}}if(rc_state[q+SB_jointCount]!=0u){rc_state[b+SH_invalidatesJoints]=1u;}}
 rc_state[b+SH_drained]=1u;return true;
}
fn rc_scene_collision_operation(b:u32,kind:u32,first:u32,second:u32,edge:u32,last:u32)->bool{
 if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=4u||rc_state[b+SH_drained]!=1u){return rc_scene_bad(b,6u);}if(kind==1u){return rc_scene_link(b,edge,first,second);}if(kind==2u){return rc_scene_unlink(b,edge);}if(kind==3u){return rc_scene_edge_swap_remove(b,edge,last);}if(kind==4u){return rc_scene_wake(b,first,false);}if(kind==5u){return rc_scene_wake(b,first,true);}return rc_scene_bad(b,6u);
}
fn rc_scene_collisions_done(b:u32)->bool{
 if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=4u||rc_state[b+SH_drained]!=1u){return rc_scene_bad(b,6u);}if(!rc_scene_capacity(b)){return false;}
 for(var j=0u;j<rc_state[b+SH_consumedCount];j++){let member=rc_state[b+SL_consumedOffset+j];if(rc_scene_valid_body(b,member)){rc_state[rc_scene_bp(b,member)+SB_changes]=0u;}}rc_state[b+SH_consumedCount]=0u;rc_state[b+SH_phase]=5u;rc_state[b+SH_sourcePhase]=2u;return true;
}
fn rc_scene_begin_energy(b:u32)->bool{
 if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=5u||rc_state[b+SH_scan]==0xffffffffu){return rc_scene_bad(b,6u);}rc_state[b+SH_hotMask]=0u;rc_state[b+SH_hotSeen]=0u;rc_state[b+SH_eligibleMask]=0u;rc_state[b+SH_energySeen]=0u;rc_state[b+SH_energyStage]=0u;
 let awake=rc_state[b+SH_awake];var n=0u;if(awake!=0xffffffffu){let c=rc_scene_cp(b,awake);n=rc_state[c+1u];for(var i=0u;i<n;i++){rc_state[b+SL_activeOffset+i]=rc_state[c+2u+i];}}rc_state[b+SH_activeCount]=n;rc_state[b+SH_phase]=7u;return true;
}
fn rc_scene_active_member(b:u32,member:u32)->bool{for(var j=0u;j<rc_state[b+SH_activeCount];j++){if(rc_state[b+SL_activeOffset+j]==member){return true;}}return false;}
// hot is output 6 of the original force graph, not an approximate speed test.
fn rc_scene_force_fact(b:u32,member:u32,hot:bool)->bool{
 if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=7u||rc_state[b+SH_energyStage]!=0u||!rc_scene_active_member(b,member)){return rc_scene_bad(b,6u);}let mask=1u<<member;if((rc_state[b+SH_hotSeen]&mask)!=0u){return rc_scene_bad(b,6u);}rc_state[b+SH_hotSeen]=rc_state[b+SH_hotSeen]|mask;if(hot){rc_state[b+SH_hotMask]=rc_state[b+SH_hotMask]|mask;}return true;
}
fn rc_scene_before_energy_updates(b:u32)->bool{
 if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=7u||rc_state[b+SH_energyStage]!=0u){return rc_scene_bad(b,6u);}for(var j=0u;j<rc_state[b+SH_activeCount];j++){if((rc_state[b+SH_hotSeen]&(1u<<rc_state[b+SL_activeOffset+j]))==0u){return rc_scene_bad(b,6u);}}
 let n=rc_state[b+SH_removalCount];rc_state[b+SH_removalCount]=0u;for(var j=0u;j<n;j++){let first=rc_state[b+SL_removalOffset+2u*j];let second=rc_state[b+SL_removalOffset+2u*j+1u];if(!rc_scene_valid_body(b,first)||!rc_scene_valid_body(b,second)){continue;}let a=rc_scene_bp(b,first);let c=rc_scene_bp(b,second);if(rc_state[a+SB_dynamic]==0u||rc_state[c+SB_dynamic]==0u||rc_state[a+SB_island]!=rc_state[c+SB_island]){continue;}
  let id=rc_state[a+SB_island];let p=rc_scene_pp(b,id);if(rc_state[p+SP_sleeping]!=0u||((rc_state[b+SH_hotMask]&(1u<<first))!=0u&&(rc_state[b+SH_hotMask]&(1u<<second))!=0u)){rc_state[p+SP_removed]=rc_scene_add(rc_state[p+SP_removed],1u);}else{if(!rc_scene_local_split(b,id,first,second)){return false;}}}
 if(!rc_scene_global_split(b)){return false;}rc_state[b+SH_energyStage]=1u;return true;
}
// Caller first runs wake-strong for resetMask members, then update-energy for
// every active row in activeOffset order. activationWords are the 12 exact graph
// output words, with vector signed-zero canonicalization matching Sleep.decode.
fn rc_scene_adopt_energy(b:u32,member:u32,activationWords:u32,eligible:bool)->bool{
 if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=7u||rc_state[b+SH_energyStage]!=1u||!rc_scene_active_member(b,member)){return rc_scene_bad(b,6u);}let mask=1u<<member;if((rc_state[b+SH_energySeen]&mask)!=0u){return rc_scene_bad(b,6u);}let q=rc_scene_bp(b,member)+SB_activation;
 for(var j=0u;j<12u;j++){let value=rc_state[activationWords+j];if((value&0x7f800000u)==0x7f800000u){return rc_scene_bad(b,5u);}rc_state[q+j]=value;if(j>=5u&&(value&0x7fffffffu)==0u){rc_state[q+j]=0u;}}
 if(rc_state[q+4u]!=0u){return rc_scene_bad(b,6u);}rc_state[b+SH_energySeen]=rc_state[b+SH_energySeen]|mask;if(eligible){rc_state[b+SH_eligibleMask]=rc_state[b+SH_eligibleMask]|mask;}return true;
}
fn rc_scene_select_sleep(b:u32)->bool{
 if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=7u||rc_state[b+SH_energyStage]!=1u){return rc_scene_bad(b,6u);}var bid=0xffffffffu;var score=0u;let s=b+SL_scratchOffset;var touched=0u;rc_state[b+SH_sleepMask]=0u;rc_state[b+SH_sleptCount]=0u;
 for(var j=0u;j<rc_state[b+SH_activeCount];j++){let member=rc_state[b+SL_activeOffset+j];let mask=1u<<member;if((rc_state[b+SH_energySeen]&mask)==0u){return rc_scene_bad(b,6u);}let q=rc_scene_bp(b,member);let id=rc_state[q+SB_island];let p=rc_scene_pp(b,id);let timer=rc_state[q+SB_activation+3u];
  if((rc_state[b+SH_eligibleMask]&mask)!=0u&&rc_state[p+SP_removed]>0u&&rc_state[b+SH_scan]>=rc_state[p+SP_deniedUntil]){if(bid==0xffffffffu||rc_scene_float_gt(timer,score)||(rc_scene_float_eq(timer,score)&&id>bid)){bid=id;score=timer;}}
  var seen=false;for(var z=0u;z<touched;z++){if(rc_state[s+208u+z]==id){seen=true;}}if(!seen){rc_state[s+208u+touched]=id;touched++;}
 }
 rc_state[b+SH_splitBid]=bid;if(bid!=0xffffffffu){rc_state[b+SH_split]=bid;}var groups=0u;if(rc_state[b+SH_activeCount]!=0u){rc_state[b+SH_scan]=rc_scene_add(rc_state[b+SH_scan],1u);
  for(var j=0u;j<touched;j++){let id=rc_state[s+208u+j];let p=rc_scene_pp(b,id);var eligible=true;for(var z=0u;z<rc_state[p+SP_count];z++){let member=rc_state[p+SP_members+z];if((rc_state[b+SH_eligibleMask]&(1u<<member))==0u){eligible=false;}}
   if(eligible&&!(rc_state[p+SP_removed]>0u&&rc_state[p+SP_count]>1u)){rc_state[p+SP_sleeping]=1u;if(rc_state[b+SH_split]==id){rc_state[b+SH_split]=0xffffffffu;}rc_state[s+215u+groups]=id;groups++;for(var z=0u;z<rc_state[p+SP_count];z++){let member=rc_state[p+SP_members+z];rc_state[b+SH_sleepMask]=rc_state[b+SH_sleepMask]|(1u<<member);rc_state[b+SH_sleptCount]=rc_state[b+SH_sleptCount]+1u;}}
  }
 }rc_state[s+214u]=groups;rc_state[b+SH_energySeen]=0u;rc_state[b+SH_energyStage]=2u;return true;
}
// Apply original operation='sleep' outputs before moving chunks. The solver
// owner must also consume that graph's zeroed linear/angular outputs.
fn rc_scene_adopt_sleep(b:u32,member:u32,activationWords:u32)->bool{
 let mask=1u<<member;if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=7u||rc_state[b+SH_energyStage]!=2u||(rc_state[b+SH_sleepMask]&mask)==0u||(rc_state[b+SH_energySeen]&mask)!=0u){return rc_scene_bad(b,6u);}let q=rc_scene_bp(b,member)+SB_activation;
 for(var j=0u;j<12u;j++){let value=rc_state[activationWords+j];if((value&0x7f800000u)==0x7f800000u){return rc_scene_bad(b,5u);}rc_state[q+j]=value;if(j>=5u&&(value&0x7fffffffu)==0u){rc_state[q+j]=0u;}}
 if(rc_state[q+4u]!=0x3f800000u){return rc_scene_bad(b,6u);}rc_state[b+SH_energySeen]=rc_state[b+SH_energySeen]|mask;return true;
}
fn rc_scene_finish_energy(b:u32)->bool{
 if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=7u||rc_state[b+SH_energyStage]!=2u||rc_state[b+SH_energySeen]!=rc_state[b+SH_sleepMask]){return rc_scene_bad(b,6u);}let s=b+SL_scratchOffset;let groups=rc_state[s+214u];
 if(groups!=0u){let awake=rc_state[b+SH_awake];let c=rc_scene_cp(b,awake);let first=rc_scene_pp(b,rc_state[s+215u]);if(groups==1u&&rc_state[first+SP_count]==rc_state[c+1u]){rc_state[b+SH_epoch]=rc_scene_add(rc_state[b+SH_epoch],1u);rc_state[b+SH_awake]=0xffffffffu;}else{
  for(var j=0u;j<groups;j++){let p=rc_scene_pp(b,rc_state[s+215u+j]);rc_state[b+SH_epoch]=rc_scene_add(rc_state[b+SH_epoch],1u);let freeCount=rc_state[b+SH_chunkFreeCount];var id=rc_state[b+SH_chunkN];if(freeCount!=0u){id=rc_state[b+SL_chunkFreeOffset+freeCount-1u];}
   var compact=0xffffffffu;for(var z=0u;z<6u;z++){if(rc_state[b+SL_chunkOffset+z*SL_chunkStride]==0xffffffffu){compact=z;break;}}if(id>=32u||compact==0xffffffffu){return rc_scene_bad(b,4u);}if(id<rc_state[b+SH_chunkLength]&&rc_state[b+SL_chunkMapOffset+id]!=0xffffffffu){return rc_scene_bad(b,6u);}if(freeCount!=0u){rc_state[b+SH_chunkFreeCount]=freeCount-1u;}if(id>=rc_state[b+SH_chunkLength]){rc_state[b+SH_chunkLength]=id+1u;}
   let dst=b+SL_chunkOffset+compact*SL_chunkStride;rc_state[dst]=id;rc_state[dst+1u]=rc_state[p+SP_count];
   for(var z=0u;z<rc_state[p+SP_count];z++){let member=rc_state[p+SP_members+z];let q=rc_scene_bp(b,member);let at=rc_state[q+SB_activeIndex];let n=rc_state[c+1u]-1u;let moved=rc_state[c+2u+n];rc_state[c+1u]=n;rc_state[q+SB_activeIsland]=id;rc_state[q+SB_activeIndex]=z;rc_state[dst+2u+z]=member;if(at<n){rc_state[c+2u+at]=moved;rc_state[rc_scene_bp(b,moved)+SB_activeIndex]=at;}}
   rc_state[b+SL_chunkMapOffset+id]=compact;rc_state[b+SH_chunkN]=rc_state[b+SH_chunkN]+1u;
  }
 }rc_state[b+SH_invalidatesSolver]=1u;}
 rc_state[b+SH_phase]=6u;rc_state[b+SH_sourcePhase]=6u;return true;
}
fn rc_scene_post_application(b:u32,member:u32)->bool{
 if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=6u||!rc_scene_valid_body(b,member)){return rc_scene_bad(b,6u);}let q=rc_scene_bp(b,member);if(rc_state[q+SB_dynamic]==0u||rc_state[q+SB_activation+4u]!=0u){return rc_scene_bad(b,6u);}return rc_scene_enqueue(b,member);
}
fn rc_scene_finish_application(b:u32)->bool{if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=6u){return rc_scene_bad(b,6u);}rc_state[b+SH_phase]=3u;rc_state[b+SH_sourcePhase]=3u;return true;}
fn rc_scene_next_internal_pass(b:u32)->bool{
 if(!rc_scene_ok(b)||rc_state[b+SH_phase]!=6u){return rc_scene_bad(b,6u);}rc_state[b+SH_phase]=4u;rc_state[b+SH_drained]=1u;rc_state[b+SH_resetMask]=0u;rc_state[b+SH_sleptCount]=0u;rc_state[b+SH_sleepMask]=0u;rc_state[b+SH_invalidatesJoints]=0u;rc_state[b+SH_invalidatesSolver]=0u;rc_state[b+SH_localSplitCount]=0u;rc_state[b+SH_globalSplitCount]=0u;return true;
}
`;

/** Original 32-input / 30-output energy graph, without reordering or pruning. */
export function sceneEnergyPlan(){return Sleep.buildPlan();}
/** Exact graph from experimental-scene-activation.forcePlan (source equation order). */
export function sceneForcePlan(){const f=Math.fround,inputFloats=32,nodes=[],op=(kind,...args)=>{nodes.push({kind,args});return inputFloats+nodes.length-1;},c=x=>op('const',f(x)),z=c(0),one=c(1),eps=c(1e-20),negativeEps=c(-1e-20),inverse=x=>{const small=op('mul',op('le',negativeEps,x),op('le',x,eps));return op('choose',small,z,op('div',one,op('choose',small,one,x)));},outputs=[0,1,2].map(i=>op('add',i,op('mul',op('mul',3+i,inverse(6+i)),9))),length=i=>op('sqrt',op('add',op('add',op('mul',i,i),op('mul',i+1,i+1)),op('mul',i+2,i+2))),threshold=op('mul',23,24),hot=op('choose',op('lt',threshold,z),one,op('gt',op('add',length(16),op('mul',length(19),22)),threshold));return{inputFloats,nodes,outputs:[...outputs,10,11,12,hot]};}

/** Test/import adapter only. The resident contact owner supplies this order on
 * device every collision pass; this function must not be used between h steps. */
export function seedSceneConnectivity(a,template,input){
 const s=decodeSceneActivation(a,template),byHandle=new Map(s.bodies.map(b=>[key(b.handle),b])),slots=new Map(template.bodies.map((b,i)=>[key(b.handle),i]));
 assert(input?.kind==='owned-rigid-contact-connectivity'&&Array.isArray(input.bodyColliders)&&Array.isArray(input.colliders)&&Array.isArray(input.edges)&&Array.isArray(input.adjacency),'Source local split needs complete owned contact adjacency');
 const colliders=new Map(),rows=new Map(),adj=new Map();
 for(const c of input.colliders){assert(c?.handle&&c?.body&&byHandle.has(key(c.body))&&!colliders.has(key(c.handle)),'Complete distinct collider parent registry required');colliders.set(key(c.handle),c);}
 for(const r of input.bodyColliders){assert(r.body&&!rows.has(key(r.body))&&Array.isArray(r.colliders),'Native body collider order required');rows.set(key(r.body),r.colliders);assert(new Set(r.colliders.map(key)).size===r.colliders.length,'Duplicate body collider');for(const h of r.colliders)assert(key(colliders.get(key(h))?.body??{})===key(r.body),'Collider parent mismatch');}
 for(const r of input.adjacency){assert(r.collider&&!adj.has(key(r.collider))&&Array.isArray(r.outgoing)&&Array.isArray(r.incoming),'Native directional adjacency required');adj.set(key(r.collider),r);}
 input.edges.forEach((e,id)=>{assert(typeof e.active==='boolean','Explicit active edge required');for(let side=1;side<=2;side++){assert(key(colliders.get(key(e['collider'+side]))?.body??{})===key(e['body'+side]),'Graph parent mismatch');const list=adj.get(key(e['collider'+side]))?.[side===1?'outgoing':'incoming'];assert(list&&list.filter(x=>x===id).length===1,'Complete directional graph edge required');}if(e.active){const loc=s.manager.persistent.contact_link_locs[id],l=loc&&s.manager.persistent.islands.v[loc[0]]?.contact_links[loc[1]];assert(l&&key(l.body1)===key(e.body1)&&key(l.body2)===key(e.body2),'Active connectivity endpoints disagree');}});
 for(const [h,r]of adj)for(const[side,list]of[[1,r.outgoing],[2,r.incoming]]){assert(new Set(list).size===list.length,'Duplicate directional edge');for(const id of list)assert(key(input.edges[id]?.['collider'+side]??{})===h,'Directional endpoint mismatch');}
 const kernels=sceneActivationTestKernels(a);kernels.rc_scene_incidence_begin(0);
 for(const b of s.bodies){const ordered=rows.get(key(b.handle));if(!ordered)continue;assert(input.colliders.filter(c=>key(c.body)===key(b.handle)).length===ordered.length,'Partial member collider roster');const slot=slots.get(key(b.handle));assert(kernels.rc_scene_incidence_body(0,slot),'Incidence body rejected');for(const co of ordered){const row=adj.get(key(co));assert(row,'Missing collider adjacency');for(const id of[...row.outgoing,...row.incoming]){const e=input.edges[id];if(!e.active)continue;const other=key(e.body1)===key(b.handle)?e.body2:e.body1;assert(kernels.rc_scene_incidence_append(0,slot,id,slots.get(key(other))),'Incidence edge rejected');}}}
 kernels.rc_scene_incidence_end(0);return a;
}

/** One-time immutable ownership binding; never accepts caller-asserted cloth
 * geometry. The resident cloth producer sets clothActive from its current exact
 * pair-present/active output before collisions_done, each collision pass. */
export function bindSceneCueCloth(a,template,stage,backend){
 const C=globalThis.LabCueClothCacheExperimental;assert(C.isStage(stage,backend),'Actual matching-backend branded cue-cloth stage required');const binding=stage.binding();assert(template.sourceRevision===C.REVISION&&template.sourceRevision===binding.sourceRevision&&template.initialSnapshotSha256===binding.initialSnapshotSha256,'Matching immutable source snapshot required');
 const k=sceneActivationTestKernels(a);assert(k.rc_scene_capacity(0),'Original disconnected six-body cue topology required');const first=k.rc_scene_find_body(0,binding.body1.index,binding.body1.generation),second=k.rc_scene_find_body(0,binding.body2.index,binding.body2.generation);assert(first!==U&&second!==U&&a[L.bodyOffset+first*32+B.dynamic]===0&&second===a[H.roleHead],'Matching fixed cloth/head identities required');a[H.clothFixed]=first;a[H.clothHead]=second;a[H.clothBound]=1;a[H.clothActive]=0;return a;
}

const JOURNAL_BRIDGE=String.raw`
fn rc_scene_journal_body(b:u32,journal:u32,collider:u32)->u32{
 if(collider>=rc_state[journal+JH_colliders]){rc_scene_bad(b,6u);return 0xffffffffu;}let c=journal+JL_colliderOffset+collider*JL_colliderStride;return rc_scene_find_body(b,rc_state[c+JC_bodyIndex],rc_state[c+JC_bodyGeneration]);
}
// Call once for each newly produced contiguous queue range (broad prefix, then
// narrow suffix), never replay the prefix after cue removal. Queue range order
// is the original source operation order.
fn rc_scene_apply_journal(b:u32,journal:u32,start:u32,count:u32)->bool{
 if(rc_state[journal+JH_status]!=0u||start>rc_state[journal+JH_operations]||count>rc_state[journal+JH_operations]-start){return rc_scene_bad(b,6u);}
 for(var i=0u;i<count;i++){let op=journal+JL_operationOffset+(start+i)*JL_operationStride;let kind=rc_state[op];
  if(kind==1u){if(!rc_scene_collision_operation(b,2u,0u,0u,rc_state[op+1u],0u)){return false;}}
  else if(kind==2u){if(!rc_scene_collision_operation(b,3u,0u,0u,rc_state[op+1u],rc_state[op+2u])){return false;}}
  else if(kind==3u){continue;}
  else if(kind==4u||kind==5u){if(kind==4u||rc_state[op+5u]!=0u){var wake=4u;if(kind==4u){wake=5u;}for(var side=0u;side<2u;side++){let member=rc_scene_journal_body(b,journal,rc_state[op+3u+side]);if(!rc_scene_ok(b)){return false;}if(!rc_scene_collision_operation(b,wake,member,0u,0u,0u)){return false;}}}}
  else if(kind==6u){let first=rc_scene_journal_body(b,journal,rc_state[op+3u]);let second=rc_scene_journal_body(b,journal,rc_state[op+4u]);if(!rc_scene_ok(b)||!rc_scene_collision_operation(b,1u,first,second,rc_state[op+1u],0u)){return false;}}
  else{return rc_scene_bad(b,6u);}
 }return true;
}
// Complete contact-owner adjacency, traversed in original parent collider-list
// rank. No geometry or active links are inferred from the persistent islands.
fn rc_scene_incidence_from_journal(b:u32,journal:u32)->bool{
 if(rc_state[journal+JH_status]!=0u||rc_state[journal+JH_colliders]>27u||rc_state[journal+JH_edges]>128u){return rc_scene_bad(b,6u);}if(!rc_scene_incidence_begin(b)){return false;}
 for(var member=0u;member<rc_state[b+SH_bodySlots];member++){let body=rc_scene_bp(b,member);if(rc_state[body+SB_present]==0u||rc_state[body+SB_dynamic]==0u){continue;}if(!rc_scene_incidence_body(b,member)){return false;}var parentCount=0u;
  for(var i=0u;i<rc_state[journal+JH_colliders];i++){let c=journal+JL_colliderOffset+i*JL_colliderStride;if(rc_state[c+JC_live]!=0u&&rc_state[c+JC_bodyIndex]==rc_state[body+SB_index]&&rc_state[c+JC_bodyGeneration]==rc_state[body+SB_generation]){parentCount++;}}
  var prior=0u;var havePrior=false;for(var rankIndex=0u;rankIndex<parentCount;rankIndex++){var selected=0xffffffffu;var rank=0xffffffffu;
   for(var i=0u;i<rc_state[journal+JH_colliders];i++){let c=journal+JL_colliderOffset+i*JL_colliderStride;if(rc_state[c+JC_live]==0u||rc_state[c+JC_bodyIndex]!=rc_state[body+SB_index]||rc_state[c+JC_bodyGeneration]!=rc_state[body+SB_generation]){continue;}let r=rc_state[c+JC_bodyColliderRank];if((!havePrior||r>prior)&&r<rank){rank=r;selected=i;}}
   if(selected==0xffffffffu){return rc_scene_bad(b,6u);}let c=journal+JL_colliderOffset+selected*JL_colliderStride;prior=rank;havePrior=true;
   for(var side=0u;side<2u;side++){var edge=rc_state[c+JC_outgoingHead+side];var walked=0u;while(edge!=0xffffffffu){if(edge>=rc_state[journal+JH_edges]||walked>=128u){return rc_scene_bad(b,6u);}let e=journal+JL_edgeOffset+edge*JL_edgeStride;if(rc_state[e+side]!=selected){return rc_scene_bad(b,6u);}if(rc_state[e+JE_isActive]!=0u){let other=rc_scene_journal_body(b,journal,rc_state[e+1u-side]);if(!rc_scene_ok(b)||!rc_scene_incidence_append(b,member,edge,other)){return false;}}edge=rc_state[e+JE_nextOutgoing+side];walked++;}}
  }
 }return rc_scene_incidence_end(b);
}
`;

/** Import actual original created snapshot bookkeeping only. Cue bodies retain
 * unregistered U32 IDs, changes=255 and zero extent until the device initializer
 * registers them. No initialized/first-h future context is accepted here. */
export function encodeSceneCreatedRegistration(record,{bodyRegistry=[]}={}){
 const Live=globalThis.LabLiveRegisteredOriginExperimental;Live.validateCreatedSource(record);
 const src=record.created,roles=record.roles,joints=src.jointState?.joint_graph?.graph?.edges?.map(e=>e.weight);
 assert(Object.keys(record).every(k=>['created','roles','events'].includes(k)),'Only created state and source event journal accepted');assert(joints?.length===2&&joints.every(j=>j.data.enabled==='Enabled'),'Exactly two enabled original cue joints required');
 const raw=Object.entries(src.bodies),lookup=new Map(raw.map(([role,b])=>[key(roles[role]),b]));assert(raw.length<=32&&new Set(raw.map(([role])=>key(roles[role]))).size===raw.length,'Distinct complete created body registry required');
 const expected=['shaft','head','guide'].map(role=>roles[role]);assert(expected.every(Boolean),'Three original cue bodies required');assert(key(joints[0].body1)===key(roles.shaft)&&key(joints[0].body2)===key(roles.head)&&key(joints[1].body1)===key(roles.guide)&&key(joints[1].body2)===key(roles.shaft),'Source cue graph order required');
 assert(src.modifiedBodies.filter(h=>expected.some(e=>key(e)===key(h))).map(key).join(',')===expected.map(key).join(','),'Original cue modified-body registration order required');
 const creations=record.events.filter(e=>e.method==='createImpulseJoint');assert(creations.length===2&&creations.every((e,i)=>key(e.handle)===key(joints[i].handle)&&key(e.body1)===key(joints[i].body1)&&key(e.body2)===key(joints[i].body2)&&e.wakeUp===true),'Joint insertion journal mismatch');
 for(const role of['shaft','head','guide']){const b=src.bodies[role];assert(b&&b.changes===255&&b.enabled===true&&!b.activation.sleeping&&Object.values(b.ids).every(x=>x===U),'Fresh enabled unregistered cue body required');assert(b.body_type===(role==='guide'?'Fixed':'Dynamic'),'Source cue body types required');if(role!=='guide')assert(b.activation.normalized_linear_threshold<0&&b.activation.time_since_can_sleep===0,'Never-sleep fresh cue already source-reset required');}
 const cueColliders=['shaft','head','guide'].flatMap(r=>src.bodies[r].colliders);assert(cueColliders.length===3&&src.modifiedColliders.length===3&&src.modifiedColliders.every((h,i)=>key(h)===key(cueColliders[i])),'Exactly source-ordered fresh cue collider queue required');
 assert(src.colliders.length===27&&raw.filter(([,b])=>b.body_type==='Dynamic').length===6,'Complete original four-ball/cue registry required');
 const p=src.islands.persistent;assert(src.islands.bootstrapped!==false&&p.bootstrapped===true&&p.split_island===null&&p.removal_journal.length===0&&p.joint_link_locs.length===0,'Fresh disconnected creation manager required');
 for(const h of src.modifiedBodies){const b=lookup.get(key(h));assert(b&&b.enabled&&[0,1,255].includes(b.changes),'Unsupported created source body queue');assert(expected.some(e=>key(e)===key(h))||b.body_type==='Dynamic'&&b.mprops.max_extent>0&&[0,1].includes(b.changes),'Only existing registered spheres and original fresh cue may be modified');}
 const template={kind:'source-scene-activation',phase:'source-created-pre-user-changes',noOtherPendingChanges:true,sourceRevision:src.sourceRevision,initialSnapshotSha256:src.snapshotSha256,roles:copy(roles),manager:copy(src.islands),modifiedBodies:copy(src.modifiedBodies),consumedModifiedBodies:[],bodies:raw.map(([role,b])=>({role,handle:copy(roles[role]),type:b.body_type,enabled:b.enabled,changes:b.changes,ids:copy(b.ids),activation:copy(b.activation),maxExtent:b.mprops.max_extent,jointAdjacency:joints.filter(j=>key(j.body1)===key(roles[role])||key(j.body2)===key(roles[role])).map(j=>copy(j.handle))}))};
 for(const extra of bodyRegistry){if(template.bodies.some(b=>key(b.handle)===key(extra.handle)))continue;assert(extra.type==='Fixed'&&extra.enabled===true&&extra.changes===0&&Object.values(extra.ids).every(x=>x===U)&&Array.isArray(extra.jointAdjacency)&&extra.jointAdjacency.length===0&&Number.isFinite(extra.maxExtent)&&Math.fround(extra.maxExtent)===extra.maxExtent,'Only complete immutable source static registry additions admitted');template.bodies.push(copy(extra));}assert(template.bodies.length<=32,'Created scene body capacity');
 const words=packSceneActivationContext(template);const slots=new Map(template.bodies.map((b,i)=>[key(b.handle),i]));joints.forEach((j,i)=>words.set([j.handle.index,j.handle.generation,U,U,slots.get(key(j.body1)),slots.get(key(j.body2))],L.jointOffset+i*6));return{words,template};
}
