// SPDX-License-Identifier: Apache-2.0
// Device composition of experimental-ccd-bvh-world-bridge.js:24-36, unchanged
// experimental-cue-broad-phase.PLANS.bounds and the resident source BVH/journal.
import '../experimental-cue-broad-phase.js';
import {compileGraph} from './numeric-program.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {SCENE_LAYOUT as S} from './scene-activation.mjs';
import {CUE_LAYOUT as Q} from './cue.mjs';
const Broad=globalThis.LabCueBroadPhaseExperimental,U=0xffffffff,f=Math.fround;
const H=Object.freeze({status:0,phase:1,first:2,colliders:3,bodies:4,freshCount:5,removedCount:6,updateCount:7,liveCount:8,lengthUnit:11,prediction:12,skin:13,head:14,shaft:15,guide:16,removalFrame:17,removalConsumed:18,job:19,cursor:20,completion:21});
const C=Object.freeze({index:0,generation:1,bodyBinding:2,shape:3,localTranslation:4,radius:7,halfHeight:8,bodyColliderRank:9});
const B=Object.freeze({index:0,generation:1,bodyBase:2,sceneSlot:3});
export const WORLD_BROAD_STATUS=Object.freeze({ok:0,invalid:1,capacity:2,unsupported:3,numeric:4});
export const WORLD_BROAD_LAYOUT=Object.freeze({version:1,header:H,collider:C,body:B,maxColliders:27,maxBodies:32,headerWords:32,colliderOffset:32,colliderStride:16,bodyOffset:464,bodyStride:6,freshOffset:656,updatesOffset:704,updateStride:8,removedOffset:920,liveOffset:947,statusesOffset:974,seenOffset:1001,words:1056,bytes:4224,persistent:Object.freeze({offset:0,words:704,bytes:2816}),transient:Object.freeze({offset:704,words:352,bytes:1408})});
const L=WORLD_BROAD_LAYOUT;
const need=(yes,message)=>{if(!yes)throw new RangeError('Resident world broad: '+message);};
const uint=x=>Number.isInteger(x)&&x>=0&&x<=U;
const handle=h=>h&&uint(h.index)&&uint(h.generation);
const same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
const bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
const native=x=>typeof x==='number'&&Number.isFinite(x)&&Object.is(f(x),x);
/** Complete journal incidence ownership without inventing order. The original
 * broad bridge records moving parents only. Missing fixed-parent lists may be
 * completed ONLY after proving their full registry ownership is a singleton:
 * a one-element list has no hidden ordering decision. Multi-collider fixed
 * parents require the original decoded parent list and are rejected here. */
export function completeJournalBodyColliderOrder(seed,{sourceBodyColliderOrder=[]}={}){
 need(Array.isArray(seed?.colliders)&&Array.isArray(seed.bodyColliders)&&Array.isArray(sourceBodyColliderOrder),'original parent registries');
 const rows=structuredClone([...seed.bodyColliders,...sourceBodyColliderOrder]),keys=new Set();
 for(const row of rows){need(handle(row.body)&&Array.isArray(row.colliders),'exact source parent list');const key=row.body.index+':'+row.body.generation;need(!keys.has(key),'duplicate original parent list');keys.add(key);const owned=seed.colliders.filter(c=>same(c.parent?.handle,row.body));need(row.colliders.length===owned.length&&new Set(row.colliders.map(h=>h.index+':'+h.generation)).size===owned.length&&row.colliders.every(h=>owned.some(c=>same(c.handle,h))),'complete original parent collider ownership');}
 for(const c of seed.colliders){const key=c.parent.handle.index+':'+c.parent.handle.generation;if(keys.has(key))continue;const owned=seed.colliders.filter(d=>same(d.parent.handle,c.parent.handle));need(owned.length===1&&owned[0].bodyType==='Fixed','missing multi-collider or moving parent requires decoded original list');rows.push({body:structuredClone(c.parent.handle),colliders:[structuredClone(c.handle)]});keys.add(key);}
 return rows;
}
/** Initial binding only: bodyBase is an absolute canonical body64 offset.
 * Shapes, original local poses, parent collider lists and fresh order are
 * immutable source descriptors, never a future broad-phase operation trace. */
export function encodeWorldBroad(seed,{bindings,firstUpdate=true}={}){
 need(Array.isArray(seed?.colliders)&&seed.colliders.length<=27&&Array.isArray(seed.bodyColliders)&&Array.isArray(seed.modifiedColliders)&&seed.modifiedColliders.length<=27,'complete original broad registry/order');need(Array.isArray(bindings)&&bindings.length<=32&&typeof firstUpdate==='boolean','bounded canonical body bindings');need(native(seed.lengthUnit)&&seed.lengthUnit>0&&native(seed.normalizedPredictionDistance)&&seed.normalizedPredictionDistance>0,'source native margin parameters');
 const a=new Uint32Array(L.words);a[H.first]=+firstUpdate;a[H.colliders]=seed.colliders.length;a[H.bodies]=bindings.length;a[H.freshCount]=seed.modifiedColliders.length;a[H.lengthUnit]=bits(seed.lengthUnit);a[H.prediction]=bits(seed.normalizedPredictionDistance);a[H.skin]=bits(f(f(.04)*seed.lengthUnit));
 const seenBodies=new Set();bindings.forEach((b,i)=>{need(handle(b.body)&&uint(b.bodyBase)&&uint(b.sceneSlot)&&b.sceneSlot<32,'exact canonical body binding');const k=b.body.index+':'+b.body.generation;need(!seenBodies.has(k),'distinct parent handles');seenBodies.add(k);a.set([b.body.index,b.body.generation,b.bodyBase,b.sceneSlot,0,0],L.bodyOffset+i*6);});
 const sourceLists=new Map();for(const row of seed.bodyColliders){need(handle(row.body)&&Array.isArray(row.colliders)&&row.colliders.length<=27,'original parent list');const key=row.body.index+':'+row.body.generation;need(!sourceLists.has(key),'duplicate parent list');need(new Set(row.colliders.map(h=>h.index+':'+h.generation)).size===row.colliders.length,'duplicate parent collider');sourceLists.set(key,row.colliders);for(const h of row.colliders)need(seed.colliders.some(c=>same(c.handle,h)&&same(c.parent.handle,row.body)),'exact parent collider ownership');}
 const seen=new Set();seed.colliders.forEach((c,i)=>{need(handle(c.handle)&&c.handle.index<27&&!seen.has(c.handle.index)&&handle(c.parent?.handle),'bounded unique collider generations');seen.add(c.handle.index);const binding=bindings.findIndex(b=>same(b.body,c.parent.handle)),isFixed=c.bodyType==='Fixed',shape=c.shape?.variant;need(isFixed||binding>=0&&['Ball','Cylinder'].includes(shape),'bound original moving sphere/cylinder');let rank=0;if(!isFixed){const list=sourceLists.get(c.parent.handle.index+':'+c.parent.handle.generation);need(list,'source moving-parent collider list');rank=list.findIndex(h=>same(h,c.handle));need(rank>=0,'complete moving parent collider list');}const p=L.colliderOffset+i*16;a.set([c.handle.index,c.handle.generation,binding<0?U:binding,isFixed?0:shape==='Ball'?1:2],p);if(!isFixed){const local=c.parent.pos_wrt_parent;need(local?.translation?.length===3&&local.translation.every(native)&&local.rotation?.length===4&&local.rotation.every((x,j)=>x===[0,0,0,1][j]),'original identity local rotation');need(native(c.shape.value.radius)&&c.shape.value.radius>0&&native(c.shape.value.half_height??0),'native collider dimensions');a.set(local.translation.map(bits),p+4);a[p+7]=bits(c.shape.value.radius);a[p+8]=bits(c.shape.value.half_height??0);}a[p+9]=rank;});
 const slots=seed.modifiedColliders.map(h=>{const n=seed.colliders.findIndex(c=>same(c.handle,h));need(n>=0&&a[L.colliderOffset+n*16+3]!==0,'fresh moving collider generation');return n;});need(new Set(slots).size===slots.length,'source fresh order distinct');a.set(slots,L.freshOffset);
 for(const[role,field]of[['head','head'],['shaft','shaft'],['guide','guide']]){const i=bindings.findIndex(b=>same(b.body,seed.roles?.[role]));need(i>=0,'source cue role body binding');a[H[field]]=i;}
 return a;
}
export function createWorldBroadPrograms(){const compiled=compileGraph(Broad.PLANS.bounds);return Object.freeze({program:compiled.program,compiled,scratchWords:compiled.scratchWords,sourcePlan:Broad.PLANS.bounds});}
/** Stages are gather -> evaluate -> scatter, repeated at most 27 times, then
 * commit. Separate pipelines keep the numeric interpreter outside source body
 * and collider walks. Neither work counts nor rows are read back to the CPU. */
export const WORLD_BROAD_DRIVER=Object.freeze({maximumRows:27,collisionPending:4,postPending:5});
export function generateWorldBroadWGSL(programs=createWorldBroadPrograms()){
 const outputs=programs.compiled.outputSlots;
 return `
fn rc_wb_fail(b:u32,s:u32){if(rc_state[b]==0u){rc_state[b]=s;}}
fn rc_wb_c(b:u32,i:u32)->u32{return b+32u+i*16u;}
fn rc_wb_body(b:u32,i:u32)->u32{return b+464u+i*6u;}
fn rc_wb_bvh_error(b:u32,error:u32)->bool{if(error==0u){return true;}rc_wb_fail(b,select(select(3u,1u,error==2u),2u,error==1u));return false;}
fn rc_wb_binding(b:u32,index:u32,generation:u32)->u32{for(var i=0u;i<rc_state[b+4u];i++){let p=rc_wb_body(b,i);if(rc_state[p]==index&&rc_state[p+1u]==generation){return i;}}return 0xffffffffu;}
fn rc_wb_check_collider(b:u32,j:u32,slot:u32)->bool{if(slot>=rc_state[b+3u]||slot>=rc_jr(j,2u)){rc_wb_fail(b,1u);return false;}let c=rc_wb_c(b,slot);let q=rc_jc(slot);if(rc_state[c]!=rc_jr(j,q)||rc_state[c+1u]!=rc_jr(j,q+1u)){rc_wb_fail(b,1u);return false;}return true;}
fn rc_wb_ready(b:u32,phase:u32)->bool{if(rc_state[b]!=0u){return false;}if(rc_state[b+1u]!=phase||rc_state[b+19u]!=0u){rc_wb_fail(b,1u);return false;}return true;}
// Removal is the completed CURRENT device cue receipt, consumed once per
// cue.frame. It remains present through later CCD passes and must not replay.
fn rc_world_broad_begin_collision(b:u32,v:u32,j:u32,scene:u32,cue:u32){
 if(!rc_wb_ready(b,0u)){return;}if((rc_state[b+2u]!=0u)!=(rc_state[v+12u]!=0u)){rc_wb_fail(b,1u);return;}rc_state[b+6u]=0u;rc_state[b+7u]=0u;rc_state[b+8u]=0u;rc_state[b+20u]=0u;rc_journal_begin(j);if(rc_jr(j,0u)!=0u){rc_wb_fail(b,rc_jr(j,0u));return;}
 var removals=0u;if(cue!=0xffffffffu){if(rc_state[cue+${Q.header.status}u]!=1u){rc_wb_fail(b,1u);return;}if(rc_state[b+18u]==0u||rc_state[b+17u]!=rc_state[cue+${Q.header.frame}u]){removals=rc_state[cue+${Q.header.removedCount}u];}}
 if(removals!=0u&&removals!=3u){rc_wb_fail(b,3u);return;}if(removals!=0u&&rc_state[b+2u]!=0u){rc_wb_fail(b,3u);return;}
 for(var role=0u;role<removals;role++){if(rc_state[cue+${Q.removedRoles}u+role]!=role){rc_wb_fail(b,1u);return;}let member=rc_state[cue+${Q.header.headSlot}u+role];let body=rc_wb_body(b,rc_state[b+14u+role]);let p=rc_scene_bp(scene,member);if(member!=rc_state[body+3u]||rc_state[p+1u]!=rc_state[body]||rc_state[p+2u]!=rc_state[body+1u]||rc_state[p]!=0u){rc_wb_fail(b,1u);return;}rc_journal_withdraw_body(j,rc_state[body],rc_state[body+1u]);if(rc_jr(j,0u)!=0u){rc_wb_fail(b,rc_jr(j,0u));return;}}
 if(removals!=0u){rc_state[b+17u]=rc_state[cue+${Q.header.frame}u];rc_state[b+18u]=1u;}
 for(var i=0u;i<rc_jr(j,12u);i++){let slot=rc_jr(j,${J.removedOffset}u+i);if(!rc_wb_check_collider(b,j,slot)){return;}rc_state[b+920u+i]=rc_state[rc_wb_c(b,slot)];}rc_state[b+6u]=rc_jr(j,12u);
 var liveCount=0u;for(var i=0u;i<rc_state[b+3u];i++){if(!rc_wb_check_collider(b,j,i)){return;}if(rc_jr(j,rc_jc(i)+6u)!=0u){rc_state[b+947u+liveCount]=rc_state[rc_wb_c(b,i)];liveCount++;}}rc_state[b+8u]=liveCount;
 if(rc_state[b+2u]!=0u){rc_state[b+7u]=rc_state[b+5u];for(var i=0u;i<rc_state[b+5u];i++){rc_state[b+704u+i*8u]=rc_state[b+656u+i];}}rc_state[b+1u]=4u;
}
// Final current awake chunk, NOT the pre-energy activeOffset snapshot: sleep
// uses source swap-removals and changes native body/collider emission order.
fn rc_world_broad_begin_post(b:u32,j:u32,scene:u32){
 if(!rc_wb_ready(b,2u)){return;}if(rc_jr(j,1u)!=3u){rc_wb_fail(b,1u);return;}for(var i=0u;i<32u;i++){rc_state[b+1001u+i]=0u;}var updates=0u;let awake=rc_state[scene+${S.header.awake}u];if(awake!=0xffffffffu){let chunk=rc_scene_cp(scene,awake);let count=rc_state[chunk+1u];if(count>6u){rc_wb_fail(b,2u);return;}for(var i=0u;i<count;i++){let member=rc_state[chunk+2u+i];if(member>=32u||rc_state[b+1001u+member]!=0u||!rc_scene_valid_body(scene,member)){rc_wb_fail(b,1u);return;}rc_state[b+1001u+member]=1u;let q=rc_scene_bp(scene,member);let binding=rc_wb_binding(b,rc_state[q+1u],rc_state[q+2u]);if(binding==0xffffffffu||rc_state[rc_wb_body(b,binding)+3u]!=member){rc_wb_fail(b,1u);return;}for(var rank=0u;rank<27u;rank++){for(var slot=0u;slot<rc_state[b+3u];slot++){let c=rc_wb_c(b,slot);if(rc_state[c+2u]!=binding||rc_state[c+9u]!=rank||rc_jr(j,rc_jc(slot)+6u)==0u){continue;}if(updates>=27u){rc_wb_fail(b,2u);return;}rc_state[b+704u+updates*8u]=slot;updates++;}}}}
 rc_state[b+7u]=updates;rc_state[b+20u]=0u;rc_state[b+1u]=5u;
}
// Only gathers the current canonical pose and immutable original local shape.
fn rc_world_broad_gather(b:u32,j:u32,scene:u32,scratch:u32){
 if(rc_state[b]!=0u||rc_state[b+19u]!=0u||rc_state[b+20u]>=rc_state[b+7u]){return;}if(rc_state[b+1u]!=4u&&rc_state[b+1u]!=5u){rc_wb_fail(b,1u);return;}let row=b+704u+rc_state[b+20u]*8u;let slot=rc_state[row];if(!rc_wb_check_collider(b,j,slot)){return;}let c=rc_wb_c(b,slot);if(rc_state[c+3u]==0u||rc_state[c+2u]>=rc_state[b+4u]||rc_jr(j,rc_jc(slot)+6u)==0u){rc_wb_fail(b,3u);return;}let binding=rc_wb_body(b,rc_state[c+2u]);let member=rc_state[binding+3u];let sb=rc_scene_bp(scene,member);if(!rc_scene_valid_body(scene,member)||rc_state[sb+1u]!=rc_state[binding]||rc_state[sb+2u]!=rc_state[binding+1u]){rc_wb_fail(b,1u);return;}let body=rc_state[binding+2u];if(body==0xffffffffu){rc_wb_fail(b,1u);return;}
 for(var i=0u;i<24u;i++){rc_scratch[scratch+i]=0u;}for(var i=0u;i<3u;i++){rc_scratch[scratch+i]=rc_state[body+6u+i];rc_scratch[scratch+7u+i]=rc_state[c+4u+i];}for(var i=0u;i<4u;i++){rc_scratch[scratch+3u+i]=rc_state[body+9u+i];}rc_scratch[scratch+10u]=rc_state[c+7u];rc_scratch[scratch+11u]=rc_state[c+8u];rc_scratch[scratch+12u]=select(0u,0x3f800000u,rc_state[c+3u]==2u);rc_scratch[scratch+20u]=rc_state[b+11u];rc_scratch[scratch+21u]=rc_state[b+12u];rc_state[b+19u]=1u;rc_state[b+21u]=0u;
}
// Exactly one numerical interpreter callsite, in a separate compute pipeline.
fn rc_world_broad_evaluate(b:u32,program:u32,scratch:u32){if(rc_state[b]==0u&&rc_state[b+19u]==1u&&rc_state[b+21u]==0u){rc_state[b+21u]=rc_num_eval(program,scratch);}}
fn rc_world_broad_scatter(b:u32,scratch:u32){if(rc_state[b]!=0u||rc_state[b+19u]==0u){return;}if(rc_state[b+21u]!=1u){rc_wb_fail(b,4u);return;}let row=b+704u+rc_state[b+20u]*8u;let c=rc_wb_c(b,rc_state[row]);rc_state[row]=rc_state[c];${Array.from(outputs.slice(0,6),(id,i)=>`rc_state[row+${i+1}u]=rc_scratch[scratch+${id}u];`).join('')}rc_state[row+7u]=rc_state[b+13u];rc_state[b+20u]++;rc_state[b+19u]=0u;}
fn rc_world_broad_commit_collision(b:u32,v:u32,j:u32){if(!rc_wb_ready(b,4u)){return;}if(rc_state[b+20u]!=rc_state[b+7u]){rc_wb_fail(b,1u);return;}if(!rc_wb_bvh_error(b,rc_bvh_prepare_update(v,b+704u,rc_state[b+7u],b+920u,rc_state[b+6u],b+920u,0u,b+947u,rc_state[b+8u],b+974u))){return;}
 // Consume source changed-tree BVTT BEFORE deferred optimize joins.
 rc_journal_prepare_bvh(j,v);if(rc_jr(j,0u)!=0u){rc_wb_fail(b,rc_jr(j,0u));return;}rc_state[b+2u]=0u;rc_state[b+1u]=1u;
}
fn rc_world_broad_before_queries(b:u32,v:u32){if(rc_state[b]!=0u){return;}if(rc_state[b+1u]==0u||rc_state[b+1u]>2u){rc_wb_fail(b,1u);return;}rc_wb_bvh_error(b,rc_bvh_join(v));}
fn rc_world_broad_narrow(b:u32,j:u32,geometry:u32,count:u32){if(!rc_wb_ready(b,1u)){return;}rc_journal_narrow(j,geometry,count);if(rc_jr(j,0u)!=0u){rc_wb_fail(b,rc_jr(j,0u));return;}rc_state[b+1u]=2u;}
fn rc_world_broad_commit_post(b:u32,v:u32){if(!rc_wb_ready(b,5u)){return;}if(rc_state[b+20u]!=rc_state[b+7u]){rc_wb_fail(b,1u);return;}if(!rc_wb_bvh_error(b,rc_bvh_set_aabbs(v,b+704u,rc_state[b+7u],b+974u))){return;}rc_state[b+1u]=3u;}
// Only after all other stage owners seal may the world publish a whole h.
fn rc_world_broad_finish(b:u32,j:u32){if(!rc_wb_ready(b,3u)){return;}rc_journal_finish(j);if(rc_jr(j,0u)!=0u){rc_wb_fail(b,rc_jr(j,0u));return;}rc_state[b+1u]=0u;}
`;}
