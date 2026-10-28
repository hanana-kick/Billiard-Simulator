// SPDX-License-Identifier: Apache-2.0
// Genuine-three INITIAL floor-only solver preparation. Distinct source port.
// 18 catalog identities, 3 actual sphere bindings; two cue dynamics are NOT
// part of this numerical block. Scatter is an unqualified component only,
// never composed before the deferred cue joint owner and actual CCD authority.
// Source contact-owner composition, not a new numerical solver. Original
// experimental-coupled-contact-owner.solvePrepared keeps canonical ball order,
// filters sleeping bodies, then flattens native persistent buckets 0..128.
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {CONTACT_ROSTER_LAYOUT as R} from './contact-roster.mjs';
import {SCENE_LAYOUT as S} from './scene-activation.mjs';
import {coupledStateLayout} from './coupled-solver.mjs';
const U=0xffffffff,f=Math.fround,need=(v,m)=>{if(!v)throw new RangeError('Resident three-ball solver: '+m);};
const H=Object.freeze({status:0,phase:1,bodyCount:2,contactCount:3,journalSequence:4,journalRevision:5,activeEpoch:6,substeps:7,pgs:8,relax:9,delegated:10,delegatedC1:11,delegatedG1:12,delegatedC2:13,delegatedG2:14,delegatedBody:15,delegatedBodyGeneration:16});
export const THREE_BALL_SOLVER_LAYOUT=Object.freeze({version:1,header:H,commonOffset:32,commonWords:13,bodyOffset:48,bodyStride:8,body:Object.freeze({index:0,generation:1,sceneSlot:2,local:3,activeSetId:4}),contactOffset:72,contactStride:4,contact:Object.freeze({edge:0,lifeLo:1,lifeHi:2,catalogRow:3}),seenOffset:144,words:272,bytes:1088,persistent:Object.freeze({offset:0,words:72}),transient:Object.freeze({offset:72,words:200}),coupled:coupledStateLayout(3,18)});
export const THREE_BALL_SOLVER_STATUS=Object.freeze({ok:0,invalid:1,capacity:2,unsupported:3,numeric:4});
const L=THREE_BALL_SOLVER_LAYOUT,C=L.coupled;
const bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0],same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
const identical=(a,b)=>Array.isArray(a)&&Array.isArray(b)?a.length===b.length&&a.every((x,i)=>Object.is(x,b[i])):Object.is(a,b);
const COMMON=['dt','lengthUnit','normalizedMaxLinearVelocity','dynamicFrequency','dynamicDamping','staticFrequency','staticDamping','warmstartCoefficient','normalizedMaxCorrectiveVelocity','frictionInBiasPass'];
/** Initial original constants/identities only. solveDt and every future body,
 * contact, active set, color/bucket and cache value are read from device state. */
export function encodeThreeBallSolver(seed,{sceneSlots,delegateCueCloth=false}={}){
 need(Array.isArray(seed?.balls)&&seed.balls.length===3&&Array.isArray(sceneSlots)&&sceneSlots.length===3&&new Set(sceneSlots).size===3&&sceneSlots.every(x=>Number.isInteger(x)&&x>=0&&x<32),'three original ball bindings');
 const a=new Uint32Array(L.words),first=seed.balls[0].state;
 for(const [i,k]of COMMON.entries()){if(i===0)continue;if(k==='frictionInBiasPass'){need(first[k]===false||first[k]===0,'source bias friction disabled');continue;}need(Number.isFinite(first[k])&&Object.is(f(first[k]),first[k]),'exact common native '+k);a[L.commonOffset+i]=bits(first[k]);}
 need(first.gravity?.length===3&&first.gravity.every(x=>Number.isFinite(x)&&Object.is(f(x),x)),'original native gravity');a.set(first.gravity.map(bits),L.commonOffset+10);
 for(const [k,h]of [['substeps',H.substeps],['pgsIterations',H.pgs],['stabilizationIterations',H.relax]]){need(Number.isInteger(first[k])&&first[k]>=1&&first[k]<=32,'source iteration count '+k);a[h]=first[k];}
 seed.balls.forEach((b,i)=>{need(Number.isInteger(b.body.index)&&Number.isInteger(b.body.generation),'generation-bearing ball');for(const k of [...COMMON.slice(1),'gravity','substeps','pgsIterations','stabilizationIterations'])need(identical(b.state[k],first[k]),'shared source constants differ '+k);a.set([b.body.index,b.body.generation,sceneSlots[i],U,U,0,0,0],L.bodyOffset+i*8);});
 need(delegateCueCloth===false,'cue contact owner is not composed');
 return a;
}
export function packThreeBallSolverState(seed,bindings){const rows=Array.isArray(bindings)?bindings:bindings?.bindings;need(Array.isArray(rows),'initial world bindings');return encodeThreeBallSolver(seed,{sceneSlots:seed.balls.map(b=>{const row=rows.find(r=>same(r.body??r.handle,b.body));need(row,'original ball in binding registry');return row.sceneSlot;})});}
/** Requires geometry-world + journal + roster + scene declarations. No numeric
 * interpreter is reachable. Caller runs the existing coupled staged pipelines
 * externally, then scatters only after their source status is complete. */
export function generateThreeBallSolverWGSL(){return `
fn rc_t3s_fail(w:u32,status:u32){if(rc_state[w]==0u){rc_state[w]=status;}}
fn rc_t3s_body(w:u32,index:u32,generation:u32)->u32{for(var i=0u;i<3u;i++){let q=w+48u+i*8u;if(rc_state[q]==index&&rc_state[q+1u]==generation){return i;}}return 0xffffffffu;}
fn rc_t3s_local(w:u32,i:u32)->u32{if(i>=3u){return 0xffffffffu;}return rc_state[w+48u+i*8u+3u];}
fn rc_three_solver_coefficient(c:u32)->u32{return c+${C.coefficientBase}u;}
fn rc_three_solver_roster(c:u32)->u32{return c+${C.rosterBase}u;}
fn rc_t3s_scene_body(w:u32,s:u32,i:u32)->u32{let q=w+48u+i*8u;let slot=rc_state[q+2u];if(!rc_scene_valid_body(s,slot)){rc_t3s_fail(w,1u);return 0xffffffffu;}let p=rc_scene_bp(s,slot);if(rc_state[p+1u]!=rc_state[q]||rc_state[p+2u]!=rc_state[q+1u]||rc_state[p+3u]!=1u){rc_t3s_fail(w,1u);return 0xffffffffu;}return p;}
fn rc_t3s_epoch(w:u32,j:u32,r:u32,s:u32)->bool{if(rc_state[j]!=0u||rc_state[r]!=0u||rc_state[s+${S.header.status}u]!=1u||rc_state[s+${S.header.phase}u]!=6u||rc_state[j+${J.header.phase}u]!=3u||rc_state[r+${R.header.phase}u]!=0u||rc_state[r+${R.header.valid}u]!=1u||rc_state[j+${J.header.edges}u]!=rc_state[r+${R.header.edgeCount}u]||rc_state[j+${J.header.sequence}u]!=rc_state[r+${R.header.sequence}u]||rc_state[j+${J.header.revision}u]!=rc_state[r+${R.header.revision}u]||rc_state[r+${R.header.activeEpoch}u]!=rc_state[s+${S.header.epoch}u]||rc_state[r+${R.header.graphEpoch}u]!=rc_state[r+${R.header.activeEpoch}u]){rc_t3s_fail(w,1u);return false;}return true;}
fn rc_t3s_edge(w:u32,j:u32,r:u32,edge:u32)->u32{if(edge>=rc_state[j+3u]){rc_t3s_fail(w,1u);return 0xffffffffu;}let e=j+${J.edgeOffset}u+edge*8u;let p=r+${R.edgeOffset}u+edge*24u;let x=j+${J.colliderOffset}u+rc_state[e]*12u;let y=j+${J.colliderOffset}u+rc_state[e+1u]*12u;if(rc_state[p]!=rc_state[x]||rc_state[p+1u]!=rc_state[x+1u]||rc_state[p+2u]!=rc_state[y]||rc_state[p+3u]!=rc_state[y+1u]||rc_state[p+4u]!=rc_state[x+2u]||rc_state[p+5u]!=rc_state[x+3u]||rc_state[p+6u]!=rc_state[y+2u]||rc_state[p+7u]!=rc_state[y+3u]||rc_state[p+8u]!=rc_state[e+2u]||rc_state[p+9u]!=rc_state[e+3u]||rc_state[p+10u]!=rc_state[e+4u]){rc_t3s_fail(w,1u);return 0xffffffffu;}return p;}
fn rc_three_solver_gather(w:u32,j:u32,r:u32,s:u32,bodies:u32,catalog:u32,caches:u32,c:u32,solveDt:u32,cueClothView:u32){
 if(rc_state[w]!=0u){return;}if(rc_state[w+1u]!=0u&&rc_state[w+1u]!=2u){rc_t3s_fail(w,1u);return;}if(!rc_t3s_epoch(w,j,r,s)){return;}if((solveDt&0x7f800000u)==0x7f800000u||bitcast<f32>(solveDt)<=0.0){rc_t3s_fail(w,4u);return;}
 for(var i=0u;i<${C.stateWords}u;i++){rc_state[c+i]=0u;}for(var i=0u;i<128u;i++){rc_state[w+144u+i]=0u;}for(var i=0u;i<13u;i++){rc_state[c+i]=rc_state[w+32u+i];}rc_state[c]=solveDt;
 // Unchanged source owner order is canonical ball indices, filtered by sleep.
 var count=0u;for(var i=0u;i<3u;i++){let p=rc_t3s_scene_body(w,s,i);if(p==0xffffffffu){return;}let q=w+48u+i*8u;rc_state[q+3u]=0xffffffffu;rc_state[q+4u]=0xffffffffu;let activeId=rc_state[p+${S.body.activeIndex}u];let rb=rc_body(r,rc_state[q],rc_state[q+1u]);if(rb==0xffffffffu){rc_t3s_fail(w,1u);return;}let asleep=rc_state[p+${S.body.activation+4}u]!=0u;if(asleep){if(rc_r(r,rb+3u)!=0xffffffffu){rc_t3s_fail(w,1u);return;}continue;}
 if(activeId==0xffffffffu||rc_r(r,rb+3u)!=activeId){rc_t3s_fail(w,1u);return;}let awake=rc_state[s+${S.header.awake}u];if(awake==0xffffffffu){rc_t3s_fail(w,1u);return;}let chunk=rc_scene_cp(s,awake);if(activeId>=rc_state[chunk+1u]||rc_state[chunk+2u+activeId]!=rc_state[q+2u]){rc_t3s_fail(w,1u);return;}rc_state[q+3u]=count;rc_state[q+4u]=activeId;for(var k=0u;k<64u;k++){rc_state[c+64u+count*64u+k]=rc_state[bodies+i*64u+k];}count++;
 }rc_state[w+2u]=count;
 // Native touching components cannot cross sleep or ball/cue solve ownership.
 for(var edge=0u;edge<rc_state[j+3u];edge++){let p=rc_t3s_edge(w,j,r,edge);if(p==0xffffffffu){return;}if(rc_state[p+8u]==0u){continue;}let a=rc_t3s_body(w,rc_state[p+4u],rc_state[p+5u]);let b=rc_t3s_body(w,rc_state[p+6u],rc_state[p+7u]);if(a==0xffffffffu&&b==0xffffffffu){continue;}let ba=rc_body(r,rc_state[p+4u],rc_state[p+5u]);let bb=rc_body(r,rc_state[p+6u],rc_state[p+7u]);if(ba==0xffffffffu||bb==0xffffffffu){rc_t3s_fail(w,1u);return;}let da=rc_r(r,ba+2u)==1u;let db=rc_r(r,bb+2u)==1u;if((da&&a==0xffffffffu)||(db&&b==0xffffffffu)||(a!=0xffffffffu&&b!=0xffffffffu&&((rc_t3s_local(w,a)==0xffffffffu)!=(rc_t3s_local(w,b)==0xffffffffu)))){rc_t3s_fail(w,3u);return;}}
 let roster=rc_three_solver_roster(c);let descriptor=roster+8u;var contacts=0u;
 for(var color=0u;color<130u;color++){let bucket=r+${R.bucketOffset}u+color*2u;let start=rc_state[bucket];let n=rc_state[bucket+1u];if(start>128u||n>128u-start||(color==129u&&n!=0u)){rc_t3s_fail(w,3u);return;}for(var k=0u;k<n;k++){let edge=rc_state[r+${R.refOffset}u+start+k];if(edge>=128u||rc_state[w+144u+edge]!=0u){rc_t3s_fail(w,1u);return;}rc_state[w+144u+edge]=1u;let p=rc_t3s_edge(w,j,r,edge);if(p==0xffffffffu){return;}if(rc_state[p+15u]!=1u||rc_state[p+17u]!=1u||(rc_state[p+16u]&1u)==0u||rc_state[p+21u]!=color*4194304u+k||rc_state[p+18u]!=color){rc_t3s_fail(w,3u);return;}
 let a=rc_t3s_body(w,rc_state[p+4u],rc_state[p+5u]);let b=rc_t3s_body(w,rc_state[p+6u],rc_state[p+7u]);if(a==0xffffffffu&&b==0xffffffffu){rc_t3s_fail(w,3u);return;}
 if(contacts>=18u){rc_t3s_fail(w,2u);return;}let la=rc_t3s_local(w,a);let lb=rc_t3s_local(w,b);if(b==0xffffffffu||lb==0xffffffffu||(a!=0xffffffffu&&la==0xffffffffu)||rc_state[p+20u]!=rc_state[w+48u+b*8u+4u]||(a!=0xffffffffu&&rc_state[p+19u]!=rc_state[w+48u+a*8u+4u])){rc_t3s_fail(w,3u);return;}
 let row=rc_geometry_find(catalog,18u,rc_state[p],rc_state[p+1u],rc_state[p+2u],rc_state[p+3u]);if(row==0xffffffffu){rc_t3s_fail(w,3u);return;}let gr=catalog+row*16u;let kind=rc_geometry[gr];if(kind!=0u||(a==0xffffffffu&&rc_state[p+19u]!=0xffffffffu)){rc_t3s_fail(w,3u);return;}let cache=caches+rc_geometry[gr+7u];var hasActive=false;switch kind{case 0u:{hasActive=rc_state[cache+129u]==1u&&rc_state[cache+131u]==1u;}case 1u:{hasActive=bitcast<f32>(rc_state[cache+203u])==1.0&&bitcast<f32>(rc_state[cache+202u])==1.0;}case 2u:{hasActive=rc_state[cache+390u]==1u&&bitcast<f32>(rc_state[cache+318u])==1.0;}default:{}}if(!hasActive){rc_t3s_fail(w,3u);return;}if(rc_geometry[gr+6u]!=b||(kind==1u&&(a==0xffffffffu||rc_geometry[gr+5u]!=a))||(kind!=1u&&(a!=0xffffffffu||rc_geometry[gr+5u]!=0xffffffffu))){rc_t3s_fail(w,1u);return;}
 let raw=c+64u+count*64u+contacts*32u;if(rc_geometry_to_contact(catalog,caches,row,raw)!=0u){rc_t3s_fail(w,3u);return;}rc_state[descriptor+contacts*4u]=select(select(2u,1u,kind==0u),0u,kind==1u);rc_state[descriptor+contacts*4u+1u]=la;rc_state[descriptor+contacts*4u+2u]=lb;rc_state[w+72u+contacts*4u]=edge;rc_state[w+73u+contacts*4u]=rc_state[p+9u];rc_state[w+74u+contacts*4u]=rc_state[p+10u];rc_state[w+75u+contacts*4u]=row;contacts++;
 }}
 rc_state[w+3u]=contacts;rc_state[roster]=count;rc_state[roster+1u]=contacts;rc_state[roster+2u]=contacts;rc_state[roster+3u]=rc_state[w+7u];rc_state[roster+4u]=rc_state[w+8u];rc_state[roster+5u]=rc_state[w+9u];for(var i=0u;i<contacts;i++){rc_state[descriptor+contacts*4u+i]=i;}if(count==0u){if(contacts!=0u){rc_t3s_fail(w,1u);return;}rc_state[roster+6u]=1u;}rc_state[w+4u]=rc_state[j+4u];rc_state[w+5u]=rc_state[j+5u];rc_state[w+6u]=rc_state[s+${S.header.epoch}u];rc_state[w+1u]=1u;
}
fn rc_three_solver_scatter(w:u32,j:u32,r:u32,s:u32,bodies:u32,catalog:u32,caches:u32,c:u32){
 if(rc_state[w]!=0u){return;}if(rc_state[w+1u]!=1u||!rc_t3s_epoch(w,j,r,s)||rc_state[w+4u]!=rc_state[j+4u]||rc_state[w+5u]!=rc_state[j+5u]||rc_state[w+6u]!=rc_state[s+${S.header.epoch}u]){rc_t3s_fail(w,1u);return;}let roster=rc_three_solver_roster(c);if(rc_state[roster+6u]!=1u){rc_t3s_fail(w,4u);return;}
 // Only source numerical output fields: pose/velocities, refreshed inertia,
 // effective force and per-substep increments. Immutable mass/shape/CCD fields
 // 56..63 and original body flags never come back from solver working storage.
 for(var i=0u;i<3u;i++){let local=rc_t3s_local(w,i);if(local==0xffffffffu){continue;}if(local>=rc_state[w+2u]){rc_t3s_fail(w,1u);return;}let sourceBody=c+64u+local*64u;let destinationBody=bodies+i*64u;for(var k=0u;k<13u;k++){rc_state[destinationBody+k]=rc_state[sourceBody+k];}for(var k=16u;k<25u;k++){rc_state[destinationBody+k]=rc_state[sourceBody+k];}for(var k=47u;k<56u;k++){rc_state[destinationBody+k]=rc_state[sourceBody+k];}}
 for(var i=0u;i<rc_state[w+3u];i++){let map=w+72u+i*4u;let edge=rc_state[map];let p=rc_t3s_edge(w,j,r,edge);if(p==0xffffffffu){return;}if(rc_state[p+9u]!=rc_state[map+1u]||rc_state[p+10u]!=rc_state[map+2u]){rc_t3s_fail(w,1u);return;}let raw=c+64u+rc_state[w+2u]*64u+i*32u;if(rc_geometry_from_contact(catalog,caches,rc_state[map+3u],raw)!=0u){rc_t3s_fail(w,3u);return;}}
 rc_state[w+1u]=2u;
}
`;}
