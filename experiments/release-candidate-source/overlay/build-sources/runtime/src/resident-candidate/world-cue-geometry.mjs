import {generateProfiledNumericWGSL,NUMERIC_PROFILE} from './numeric-profile.mjs';
/* SPDX-License-Identifier: Apache-2.0
 * Original current-pose cue exclusion plus persistent empty manifold ownership.
 * Fixed original collider registry and native hull order are immutable; every
 * moving pose, edge lifetime and numerical decision is device resident.
 */
import {compileGraph} from './numeric-program.mjs';
import {createEmptyCueCachePrograms,initializeEmptyCueCache,generateEmptyCueCacheWGSL,generateEmptyConvexQueryWGSL} from './cue-empty-caches.mjs';
import {packSharedConvexHull,generateConvexPointWGSL} from './convex-point.mjs';
import {generateRawContactQueryWGSL} from './raw-strike.mjs';
import * as importedQuery from '../experimental-cue-obstacle-contact.js';
const Query=importedQuery.default??globalThis.LabCueObstacleContactExperimental;
import * as importedGuard from '../experimental-cue-rigid-exclusion.js';
const Guard=importedGuard.default??globalThis.LabCueRigidExclusionExperimental;
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import * as importedTopology from '../experimental-cue-convex-topology.js';
const Topology=importedTopology.default??globalThis.LabCueConvexTopologyExperimental;
const U=0xffffffff,f=Math.fround,key=h=>h.index+':'+h.generation,same=(a,b)=>key(a)===key(b),bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
const need=(ok,msg)=>{if(!ok)throw new RangeError('World cue geometry: '+msg);};
export const WORLD_CUE_GEOMETRY_LAYOUT=Object.freeze({words:3456,bytes:13824,maxPairs:56,pairOffset:32,pairStride:56,cacheWords:48,poseInput:3168,poseOutput:3188,cacheInput:3202,cacheOutput:3258,query:3292,queryOutput:3324,queryMetadata:3340,proof:3356,normalQuery:3360,normalOutput:3388,scratchWords:13632,
 header:Object.freeze({status:0,phase:1,cursor:2,epoch:3,pairs:4,edge:5,cache:6,kind:7,geometryBase:8,poseComplete:9,queryReady:10,cacheReady:11,prediction:12,recycle:13,clothRow:14}),geometryHeaderWords:16,colliderStride:32,pairDescriptorStride:8});
const L=WORLD_CUE_GEOMETRY_LAYOUT;
/** Same scalar glam pose composition as source empty-cache/initialization
 * graphs. Retain identity quaternion products and every f32 operation. */
export function worldCuePosePlan(){const inputFloats=20,nodes=[],op=(kind,...args)=>{nodes.push({kind,args});return inputFloats+nodes.length-1;},c=x=>op('const',f(x)),z=c(0),one=c(1),two=c(2),add=(a,b)=>op('add',a,b),sub=(a,b)=>op('sub',a,b),mul=(a,b)=>op('mul',a,b),v=(i,n=3)=>Array.from({length:n},(_,j)=>i+j),va=(a,b)=>a.map((x,i)=>add(x,b[i])),vm=(a,b)=>a.map(x=>mul(x,b)),dot=(a,b)=>add(add(mul(a[0],b[0]),mul(a[1],b[1])),mul(a[2],b[2])),cross=(a,b)=>[sub(mul(a[1],b[2]),mul(a[2],b[1])),sub(mul(a[2],b[0]),mul(a[0],b[2])),sub(mul(a[0],b[1]),mul(a[1],b[0]))],qm=(a,b)=>[sub(add(add(mul(a[3],b[0]),mul(a[0],b[3])),mul(a[1],b[2])),mul(a[2],b[1])),add(add(sub(mul(a[3],b[1]),mul(a[0],b[2])),mul(a[1],b[3])),mul(a[2],b[0])),add(sub(add(mul(a[3],b[2]),mul(a[0],b[1])),mul(a[1],b[0])),mul(a[2],b[3])),sub(sub(sub(mul(a[3],b[3]),mul(a[0],b[0])),mul(a[1],b[1])),mul(a[2],b[2]))],rotate=(q,a)=>{const b=q.slice(0,3);return va(va(vm(a,sub(mul(q[3],q[3]),dot(b,b))),vm(b,mul(dot(a,b),two))),vm(cross(b,a),mul(q[3],two)));};const outputs=[];for(const b of[0,10])outputs.push(...va(v(b),rotate(v(b+3,4),v(b+7))),...qm(v(b+3,4),[z,z,z,one]));return{inputFloats,nodes,outputs};}
export function createWorldCueGeometryPrograms(){const pose=compileGraph(Guard.buildPlan()),cache=createEmptyCueCachePrograms(),header=new Uint32Array(8);header.set([0x52435747,8,8+pose.program.length,8+pose.program.length+cache.convexOffset,Math.max(pose.scratchWords,cache.scratchWords)]);const words=new Uint32Array(8+pose.program.length+cache.words.length);words.set(header);words.set(pose.program,8);words.set(cache.words,header[2]);return Object.freeze({words,pose,cache,scratchWords:13632,numericScratchWords:header[4]});}
/** Common source initial descriptors only. geometryBase is the future immutable
 * buffer offset, not a candidate-dependent address or a host geometry result. */
export function packWorldCueGeometry(seed,{geometryBase=0}={}){
 need(seed.kind==='original-live-registered-four-ball-created-world'&&seed.cueBroadSeed?.colliders?.length===27&&seed.balls?.length===4,'complete original fixed four-ball scene');need(Number.isInteger(geometryBase)&&geometryBase>=0,'shared immutable offset');
 const colliders=seed.cueBroadSeed.colliders,created=seed.cueInitial.sourceCreation.created,roles=seed.cueInitial.sourceCreation.roles,canonical=[...seed.balls.map(b=>b.body),roles.shaft,roles.head],cue=new Set(seed.contactGraphSeed.cueColliders.map(key)),ip=created.integration,pred=f(ip.normalized_prediction_distance*ip.length_unit),recycle=f(ip.normalized_contact_recycle_distance*ip.length_unit);
 const order=[...seed.sceneRegistry.statics.map(s=>s.collider.handle),...seed.sceneRegistry.objects.flatMap(s=>[s.primaryCollider.handle,s.pairCollider.handle])],hulls=new Map((seed.cueEmptyConvexHulls??[]).map(x=>[key(x.hull.handle),x.hull])),rows=[];
 const interacts=(a,b)=>{const x=a.flags.collision_groups,y=b.flags.collision_groups;need(x.test_mode==='And'&&y.test_mode==='And','source And filters');return!!((x.memberships&y.filter)&&(y.memberships&x.filter));};
 for(const c of colliders.filter(c=>cue.has(key(c.handle))))for(const h of order){const a=colliders.find(x=>same(x.handle,h));need(a,'registry original collider');if(!interacts(c,a))continue;let kind=0;if(c.shape.variant==='Cylinder'&&a.shape.variant==='Ball')kind=1;if(c.shape.variant==='Cylinder'&&a.shape.variant==='ConvexPolyhedron')kind=2;const cloth=same(a.handle,seed.pairSeed.floorCollider)&&c.shape.variant==='Ball';if(cloth)kind=3;rows.push({a,b:c,kind});}
 need(rows.length===56,'complete source filter roster');need(rows.filter(x=>x.kind===3).length===1,'one delegated head cloth owner');
 const guarded=Guard.validateInitial({created,roles,sceneRegistry:seed.sceneRegistry});need(guarded.pairs.length===56,'source complete guard roster');const own={roles,cue:Object.fromEntries(['shaft','head'].map(r=>[r,seed.cueInitial.cue[r]])),balls:seed.balls.map(b=>({body:b.body,translation:b.state.translation,rotation:b.state.rotation,radius:b.radius}))};
 const colliderOffset=16,pairOffset=colliderOffset+27*32,hullOffset=pairOffset+56*8,geometry=[],table=new Uint32Array(hullOffset),state=new Uint32Array(L.words);let next=hullOffset;
 table.set([0x52435747,1,27,56,geometryBase+colliderOffset,geometryBase+pairOffset]);const support=new Map();
 for(const [k,hull]of hulls){Topology.assertNativeHull(hull);const words=new Uint32Array(300+1156),floats=new Float32Array(words.buffer);floats[0]=hull.points.length;hull.points.forEach((p,i)=>floats.set(p,1+3*i));words.set(words.subarray(0,100),200);words.set(packSharedConvexHull(hull),300);support.set(k,{support:geometryBase+next,point:geometryBase+next+300,hull});geometry.push(words);next+=words.length;}
 colliders.forEach((c,i)=>{const p=colliderOffset+i*32,shape=c.shape.variant,code={Cylinder:0,Cuboid:1,ConvexPolyhedron:2,Ball:3}[shape],body=canonical.findIndex(h=>same(h,c.parent.handle)),fixed=c.bodyType==='Fixed';need(code!==undefined&&(fixed||body>=0),'every original collider shape/body binding');const local=c.parent.pos_wrt_parent;need(local.rotation.every((x,j)=>x===[0,0,0,1][j]),'source identity local rotations');need(!fixed||local.translation.every(x=>x===0),'source static collider-world pose has zero local translation');const h=support.get(key(c.handle));if(code===2)need(h,'complete original native hull roster');table.set([c.handle.index,c.handle.generation,c.parent.handle.index,c.parent.handle.generation,body<0?U:body,code,h?.support??0,h?.point??0],p);table.set(c.pos.translation.map(bits),p+8);table.set(c.pos.rotation.map(bits),p+11);table.set(local.translation.map(bits),p+15);const d=code===0?[c.shape.value.half_height,c.shape.value.radius,0]:code===1?c.shape.value.half_extents:code===3?[c.shape.value.radius,0,0]:[0,0,0];table.set(d.map(bits),p+18);table[p+21]=bits(c.shape.value.radius??0);table[p+22]=bits(c.shape.value.half_height??0);table[p+23]=bits(c.material.friction);table[p+24]=bits(c.material.restitution);if(h){table.set([0,1,2].map(j=>bits(Math.min(...h.hull.points.map(v=>v[j])))),p+25);table.set([0,1,2].map(j=>bits(Math.max(...h.hull.points.map(v=>v[j])))),p+28);}});
 rows.forEach(({a,b,kind},i)=>{const ai=colliders.indexOf(a),bi=colliders.indexOf(b),p=pairOffset+i*8,h=support.get(key(a.handle));need(a.material.friction_combine_rule==='Multiply'&&b.material.friction_combine_rule==='Multiply'&&a.material.restitution_combine_rule==='Multiply'&&b.material.restitution_combine_rule==='Multiply','source Multiply pair materials');if(kind===1)need(a.material.friction===1&&a.material.restitution===1,'source primary sphere material');const original=guarded.pairs[i];need(same(original.a.handle,b.handle)&&same(original.b.col.handle,a.handle),'unchanged original guard pair order');const guardInput=Guard.pack(original,own,pred),guardWords=new Uint32Array(guardInput.buffer);const guardOffset=geometryBase+next;geometry.push(guardWords);next+=guardWords.length;table.set([ai,bi,kind,h?.support??0,h?.point??0,bits(f(a.material.friction*b.material.friction)),bits(f(a.material.restitution*b.material.restitution)),guardOffset],p);const at=L.pairOffset+i*L.pairStride;if(kind===1||kind===2)state.set(initializeEmptyCueCache({kind:kind===1?'sphere-cylinder':'convex-cylinder',pairId:i,hullOffset:h?.support??0,sphereRadius:kind===1?a.shape.value.radius:0,cylinderRadius:b.shape.value.radius,cylinderHalfHeight:b.shape.value.half_height}),at);state[at+51]=U;if(kind===3)state[L.header.clothRow]=i;});
 state[L.header.pairs]=56;state[L.header.geometryBase]=geometryBase;state[L.header.prediction]=bits(pred);state[L.header.recycle]=bits(recycle);const geometryWords=new Uint32Array(next);geometryWords.set(table);let offset=hullOffset;for(const words of geometry){geometryWords.set(words,offset);offset+=words.length;}
 return Object.freeze({stateWords:state,geometryWords,programs:createWorldCueGeometryPrograms(),layout:L,counts:Object.freeze({pairs:56,sphereCylinder:rows.filter(r=>r.kind===1).length,convexCylinder:rows.filter(r=>r.kind===2).length,delegatedCloth:1,hulls:hulls.size}),rows:Object.freeze(rows.map(({a,b,kind})=>Object.freeze({collider1:a.handle,collider2:b.handle,kind})))});
}

/** Include source numeric/cache/query libraries once in their respective stage
 * modules. Every function uses one candidate's absolute state addresses. */
export function generateWorldCueGeometryWGSL(){return `
fn rc_wcg_fail(g:u32,reason:u32){if(rc_state[g]==0u){rc_state[g]=reason;}}
fn rc_wcg_descriptor(g:u32)->u32{let geometryRoot=rc_state[g+8u];return rc_geometry[geometryRoot+5u]+rc_state[g+2u]*8u;}
fn rc_wcg_collider(g:u32,slot:u32)->u32{return rc_geometry[rc_state[g+8u]+4u]+slot*32u;}
fn rc_wcg_cache(g:u32)->u32{return g+32u+rc_state[g+2u]*56u;}
fn rc_wcg_reset(cache:u32){rc_state[cache+2u]=1u;rc_state[cache+3u]=0u;rc_state[cache+4u]=0u;rc_state[cache+5u]=0u;rc_state[cache+11u]=0u;for(var i=16u;i<48u;i++){rc_state[cache+i]=0u;}rc_state[cache+50u]=0u;rc_state[cache+51u]=0xffffffffu;}
fn rc_world_cue_geometry_begin(g:u32,journal:u32){
 if(rc_state[g]!=0u){return;}if(rc_state[g+1u]==1u||rc_state[journal]!=0u||rc_state[journal+1u]!=2u||rc_state[journal+2u]!=27u||rc_state[g+4u]!=56u||rc_state[g+3u]==0xffffffffu){rc_wcg_fail(g,1u);return;}
 let geometryRoot=rc_state[g+8u];if(rc_geometry[geometryRoot]!=0x52435747u||rc_geometry[geometryRoot+2u]!=27u||rc_geometry[geometryRoot+3u]!=56u){rc_wcg_fail(g,1u);return;}
 // Registry slots are generation-checked against the complete immutable import.
 for(var i=0u;i<27u;i++){let co=rc_wcg_collider(g,i);let jc=journal+32u+i*12u;if(rc_state[jc]!=rc_geometry[co]||rc_state[jc+1u]!=rc_geometry[co+1u]||rc_state[jc+2u]!=rc_geometry[co+2u]||rc_state[jc+3u]!=rc_geometry[co+3u]){rc_wcg_fail(g,1u);return;}}
 rc_state[g+1u]=1u;rc_state[g+2u]=0u;rc_state[g+3u]++;rc_state[g+9u]=0u;rc_state[g+10u]=0u;rc_state[g+11u]=0u;
}
fn rc_world_cue_geometry_gather(g:u32,journal:u32,bodies:u32){
 if(rc_state[g]!=0u||rc_state[g+1u]!=1u||rc_state[g+2u]>=56u){return;}
 rc_state[g+9u]=0u;rc_state[g+10u]=0u;rc_state[g+11u]=0u;let pair=rc_wcg_descriptor(g);let cache=rc_wcg_cache(g);let a=rc_geometry[pair];let b=rc_geometry[pair+1u];let kind=rc_geometry[pair+2u];rc_state[g+7u]=kind;rc_state[g+6u]=cache;rc_state[g+5u]=0xffffffffu;
 if(a>=27u||b>=27u){rc_wcg_fail(g,1u);return;}
 for(var edge=0u;edge<rc_state[journal+3u];edge++){let e=journal+356u+edge*8u;if(rc_state[e]==a&&rc_state[e+1u]==b){rc_state[g+5u]=edge;break;}}
 let edge=rc_state[g+5u];if(rc_state[journal+32u+a*12u+6u]==0u||rc_state[journal+32u+b*12u+6u]==0u){if(edge!=0xffffffffu){rc_wcg_fail(g,1u);return;}rc_wcg_reset(cache);return;}
 if(edge==0xffffffffu){rc_wcg_reset(cache);}else{let e=journal+356u+edge*8u;if(rc_state[cache+50u]==0u||rc_state[cache+48u]!=rc_state[e+3u]||rc_state[cache+49u]!=rc_state[e+4u]){rc_wcg_reset(cache);}rc_state[cache+48u]=rc_state[e+3u];rc_state[cache+49u]=rc_state[e+4u];rc_state[cache+50u]=1u;rc_state[cache+51u]=edge;if(kind!=3u&&(kind==0u||rc_state[e+2u]!=0u)){rc_wcg_fail(g,3u);return;}}
 // Source tip/cloth geometry is owned separately, NEVER exclusion-as-inactive.
 if(kind==3u){return;}
 for(var side=0u;side<2u;side++){let co=rc_wcg_collider(g,select(a,b,side!=0u));let dst=g+3168u+side*10u;let body=rc_geometry[co+4u];
  for(var i=0u;i<7u;i++){var word=rc_geometry[co+8u+i];if(body!=0xffffffffu){if(body>=6u){rc_wcg_fail(g,1u);return;}word=rc_state[bodies+body*64u+6u+i];}rc_state[dst+i]=word;}
  for(var i=0u;i<3u;i++){rc_state[dst+7u+i]=rc_geometry[co+15u+i];}}
 rc_state[g+9u]=1u;
}
fn rc_world_cue_geometry_pose(g:u32,bundle:u32,scratch:u32){
 if(rc_state[g]!=0u||rc_state[g+9u]!=1u){return;}let program=bundle+rc_program[bundle+1u];let geometryRoot=rc_geometry[rc_wcg_descriptor(g)+7u];for(var i=0u;i<132u;i++){rc_scratch[scratch+i]=rc_geometry[geometryRoot+i];}
 // Exact original guard orientation: cue FIRST, obstacle SECOND. Only current
 // body poses change; initial positions in immutable packing are never used.
 for(var i=0u;i<7u;i++){rc_scratch[scratch+i]=rc_state[g+3178u+i];rc_scratch[scratch+16u+i]=rc_state[g+3168u+i];}
 if(rc_num_eval(program,scratch)!=1u){rc_wcg_fail(g,4u);return;}let outputs=program+rc_program[program+8u];for(var i=0u;i<18u;i++){rc_state[g+3188u+i]=rc_scratch[scratch+rc_program[outputs+i]];}rc_state[g+9u]=2u;
}
fn rc_world_cue_geometry_query_input(g:u32){
 if(rc_state[g]!=0u||rc_state[g+9u]!=2u){return;}let pair=rc_wcg_descriptor(g);let obstacle=rc_wcg_collider(g,rc_geometry[pair]);let cue=rc_wcg_collider(g,rc_geometry[pair+1u]);let obstacleKind=rc_geometry[obstacle+5u];let cueKind=rc_geometry[cue+5u];
 if(rc_state[g+3188u]==0x3f800000u){rc_state[g+10u]=2u;return;}
 // Preserve source contact_manifolds_convex_ball threshold radius+prediction,
 // not the different rounded contactShape(distance-radius)<=prediction test.
 if(cueKind==0u&&obstacleKind==3u&&rc_geometry[obstacle]<rc_geometry[cue]){if(rc_state[g+3196u]!=0x3f800000u){rc_wcg_fail(g,3u);return;}rc_state[g+10u]=2u;return;}
 if(cueKind!=0u||rc_geometry[obstacle+4u]!=0xffffffffu||(obstacleKind!=1u&&obstacleKind!=2u)){rc_wcg_fail(g,3u);return;}
 for(var i=0u;i<32u;i++){rc_state[g+3292u+i]=0u;}
 for(var i=0u;i<3u;i++){rc_state[g+3292u+i]=rc_state[g+3190u+i];rc_state[g+3302u+i]=rc_state[g+3193u+i];rc_state[g+3299u+i]=rc_geometry[cue+18u+i];rc_state[g+3309u+i]=rc_geometry[obstacle+18u+i];}
 for(var i=0u;i<4u;i++){rc_state[g+3295u+i]=rc_state[g+3181u+i];rc_state[g+3305u+i]=rc_state[g+3171u+i];}
 rc_state[g+3312u]=0u;rc_state[g+3313u]=bitcast<u32>(f32(obstacleKind));rc_state[g+3314u]=rc_geometry[rc_geometry[pair+7u]+128u];rc_state[g+10u]=1u;
}
fn rc_world_cue_geometry_query_active(g:u32)->bool{return rc_state[g]==0u&&rc_state[g+10u]==1u;}
fn rc_world_cue_geometry_hull(g:u32)->u32{return rc_geometry[rc_wcg_descriptor(g)+3u]+100u;}
fn rc_world_cue_geometry_point_hull(g:u32)->u32{return rc_geometry[rc_wcg_descriptor(g)+4u];}
// Called only after the source contact query finish dispatch.
fn rc_world_cue_geometry_after_query(g:u32,scratch:u32){
 if(rc_state[g]!=0u||rc_state[g+9u]!=2u){return;}let pair=rc_wcg_descriptor(g);let cache=rc_wcg_cache(g);
 if(rc_state[g+10u]==1u){if(rc_state[g+3324u]!=0u||rc_scratch[scratch]!=0x40800000u||rc_scratch[scratch+112u]!=0x3f800000u||!rc_empty_finite(rc_scratch[scratch+113u])||!(bitcast<f32>(rc_scratch[scratch+113u])>bitcast<f32>(rc_state[g+3314u]))){rc_wcg_fail(g,3u);return;}rc_state[g+10u]=2u;}
 if(rc_state[g+10u]!=2u){rc_wcg_fail(g,3u);return;}
 // Device-owned original guard proof (fast support axes, exact source sphere
 // predicate, or completed strict GJK support bound at prediction+BAND).
 rc_state[g+3356u]=1u;rc_state[g+3357u]=rc_state[g+3u];rc_state[g+3358u]=rc_state[g+2u];rc_state[g+3359u]=rc_state[g+12u];if(rc_state[g+5u]==0xffffffffu){return;}
 let kind=rc_state[g+7u];if(kind!=1u&&kind!=2u){rc_wcg_fail(g,3u);return;}for(var i=0u;i<56u;i++){rc_state[g+3202u+i]=0u;}
 for(var side=0u;side<2u;side++){let co=rc_wcg_collider(g,rc_geometry[pair+side]);let input=g+3202u+side*11u;for(var i=0u;i<10u;i++){rc_state[input+i]=rc_state[g+3168u+side*10u+i];}rc_state[input+10u]=rc_geometry[co+21u];}
 let first=rc_wcg_collider(g,rc_geometry[pair]);let second=rc_wcg_collider(g,rc_geometry[pair+1u]);rc_state[g+3224u]=rc_geometry[second+22u];rc_state[g+3225u]=rc_state[g+13u];rc_state[g+3226u]=rc_state[g+12u];for(var i=0u;i<6u;i++){rc_state[g+3245u+i]=rc_geometry[first+25u+i];}
 if(!rc_empty_cache_begin(cache,g+3202u,g+3356u,rc_state[g+3u])){rc_wcg_fail(g,3u);return;}rc_state[g+11u]=1u;
}
fn rc_world_cue_geometry_cache(g:u32,bundle:u32,scratch:u32){
 if(rc_state[g]!=0u||rc_state[g+11u]!=1u){return;}let cache=rc_wcg_cache(g);let program=bundle+rc_program[bundle+select(2u,3u,rc_state[g+7u]==2u)];
 if(!rc_empty_cache_numeric(cache,g+3202u,g+3258u,program,scratch)){rc_wcg_fail(g,4u);return;}rc_empty_cache_query_input(cache,g+3202u,g+3258u,g+3360u);rc_state[g+11u]=2u;
}
fn rc_world_cue_geometry_cache_active(g:u32)->bool{return rc_state[g]==0u&&rc_state[g+11u]==2u;}
// A persistent original empty manifold has one manifold and ZERO point/solver
// contacts. Normal pointers stay resident, including source frozen normals.
fn rc_world_cue_geometry_finish_row(g:u32,journal:u32,facts:u32,views:u32,refreshed:u32){
 if(rc_state[g]!=0u||rc_state[g+1u]!=1u||rc_state[g+2u]>=56u){return;}let edge=rc_state[g+5u];let kind=rc_state[g+7u];let cache=rc_wcg_cache(g);
 if(kind==3u){if(edge!=0xffffffffu){let e=journal+356u+edge*8u;let fact=facts+edge*6u;if(rc_state[fact]!=edge||rc_state[fact+1u]!=rc_state[e+3u]||rc_state[fact+2u]!=rc_state[e+4u]||rc_state[fact+4u]!=1u){rc_wcg_fail(g,3u);return;}}}
 else if(rc_state[g+9u]!=0u){if(rc_state[g+10u]!=2u){rc_wcg_fail(g,4u);return;}if(edge!=0xffffffffu){if(rc_state[g+11u]!=2u||!rc_empty_cache_commit(cache,g+3202u,g+3258u,g+3388u)){rc_wcg_fail(g,3u);return;}let e=journal+356u+edge*8u;let fact=facts+edge*6u;rc_state[fact]=edge;rc_state[fact+1u]=rc_state[e+3u];rc_state[fact+2u]=rc_state[e+4u];rc_state[fact+3u]=0u;rc_state[fact+4u]=1u;rc_state[fact+5u]=0u;
 let view=views+edge*8u;rc_state[view]=rc_state[e+3u];rc_state[view+1u]=rc_state[e+4u];rc_state[view+2u]=1u;rc_state[view+3u]=cache+42u;rc_state[view+4u]=0u;rc_state[view+5u]=cache+46u;rc_state[view+6u]=1u;rc_state[view+7u]=0u;rc_state[refreshed+edge]=u32(rc_state[cache+33u]==0u);}}
 rc_state[g+2u]++;rc_state[g+9u]=0u;rc_state[g+10u]=0u;rc_state[g+11u]=0u;if(rc_state[g+2u]==56u){rc_state[g+1u]=2u;}
}
`;}

export const WORLD_CUE_GEOMETRY_STAGES=Object.freeze(['gather','pose','input','contact-init','contact-gjk','contact-epa','contact-finish','after-query','cache','normal-init','normal-gjk','normal-finish','advance']);

/** One original GJK step per dispatch, original256 cap, no host decision/read. */
export function generateWorldCueGeometryStageWGSL(stage,{numericProfile,queryTransport='staged',queryChunk=8}={}){
 if(!WORLD_CUE_GEOMETRY_STAGES.includes(stage))throw new RangeError('World cue source stage required');
 if(!['staged','resident-loop','chunked'].includes(queryTransport)||![2,4,8].includes(queryChunk))throw new RangeError('Explicit source query transport required');
 const loop=queryTransport==='resident-loop',chunked=queryTransport==='chunked';
 let extra='',body='';
 if(stage==='gather')body='rc_world_cue_geometry_gather(g,journal,bodies);';
 else if(stage==='pose')body='rc_world_cue_geometry_pose(g,bundle,scratch);';
 else if(stage==='input')body='rc_world_cue_geometry_query_input(g);';
 else if(stage.startsWith('contact-')){const name=stage.slice(8);
  // Original live guard refinement is only cylinder against fixed box/hull.
  // Sphere/cylinder uses its source analytic predicate above. Omit the point
  // call tree only in this opt-in owner; an unexpected point request remains
  // explicit unsupported in the unchanged raw-contact adapter, never a miss.
  extra=generateRawContactQueryWGSL(Query,name,{pointStageCode:chunked?'':generateConvexPointWGSL(name==='gjk'&&loop?'gjk-loop':name),storageLoop:loop,queryChunk:chunked?queryChunk:1});body='if(rc_world_cue_geometry_query_active(g)){rc_raw_contact_stage(scratch,g+3292u,g+3324u,rc_world_cue_geometry_hull(g),g+3340u,rc_world_cue_geometry_point_hull(g));}';}
 else if(stage==='after-query')body='rc_world_cue_geometry_after_query(g,scratch);';
 else if(stage==='cache')body='rc_world_cue_geometry_cache(g,bundle,scratch);';
 else if(stage.startsWith('normal-')){extra=generateEmptyConvexQueryWGSL(stage.slice(7),{storageLoop:loop,queryChunk:chunked?queryChunk:1});body='if(rc_world_cue_geometry_cache_active(g)){rc_empty_convex_query_stage(rc_wcg_cache(g),scratch,g+3360u,g+3388u);}';}
 else body='rc_world_cue_geometry_finish_row(g,journal,facts,views,refreshed);';
 return generateProfiledNumericWGSL(numericProfile)+generateEmptyCueCacheWGSL()+generateWorldCueGeometryWGSL()+extra+`
fn rc_world_cue_geometry_stage(g:u32,journal:u32,bodies:u32,facts:u32,views:u32,refreshed:u32,bundle:u32,scratch:u32){${body}}`;
}
