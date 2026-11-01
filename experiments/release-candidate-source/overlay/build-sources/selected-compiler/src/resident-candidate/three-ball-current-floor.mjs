// SPDX-License-Identifier: Apache-2.0
// Current genuine-three second-collision floor owner. Current cache publication is transactional:
// every source fat/narrow predicate runs on a private draft before any cache write.
import {assertThreeBallFirstHPlan} from './three-ball-first-h.mjs';
import {threeBallFloorFatPlan} from './three-ball-first-post.mjs';
import {createNarrowPrograms,generateNarrowphaseWGSL} from './narrowphase.mjs';
import {compileGraph,generateNumericLibraryWGSL} from './numeric-program.mjs';
import {SCENE_LAYOUT as S,generateSceneActivationWGSL} from './scene-activation.mjs';
import {SCENE_INITIALIZATION_LAYOUT as I} from './scene-initialization.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {CONTACT_ROSTER_LAYOUT as R} from './contact-roster.mjs';
import {CUE_LAYOUT as Q} from './cue.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
import {threeBallRetainedControlBase} from './three-ball-retained-control.mjs';
const owned=new WeakMap(),U=0xffffffff,key=h=>h.index+':'+h.generation,bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
const need=(p,m)=>{if(!p)throw Object.assign(new RangeError('Three-ball current floor: '+m),{code:'three-ball-current-floor-unsupported'});};
export const THREE_BALL_CURRENT_FLOOR_LAYOUT=Object.freeze({words:704,records:32,recordStride:16,fatInputs:80,fatOutputs:152,bounds:176,draft:208,prior:640,hints:664,
 header:Object.freeze({magic:0,version:1,status:2,phase:3,cursor:4,completed:5,mask:6,epoch:7,refreshed:8,awake:9,dt:10})});
export const THREE_BALL_CURRENT_FLOOR_CAPABILITY=Object.freeze({genuineSpheres:3,currentSourceFatAndGeometry:true,currentEntryMasks:true,transactionalCachePublication:true,sourceComponentOnly:true,
 fixedInnerH:2,retainedCurrentFatBounds:true,collisionPhaseAuthority:false,wholeH:false,nativeBoundaryVerified:false,gpuQualified:false,runtimeIntegrated:false});
export function createThreeBallCurrentFloorPlan(first){
 need(arguments.length===1,'one authentic first-h plan only');assertThreeBallFirstHPlan(first);const template=first.template,seed=template.seed,L=THREE_BALL_CURRENT_FLOOR_LAYOUT;
 const fat=compileGraph(threeBallFloorFatPlan()),narrow=createNarrowPrograms(),floor=narrow.entries.floor.compiled,initialWords=new Uint32Array(L.words);initialWords.set([0x52334346,1,1]);initialWords[L.header.dt]=bits(seed.balls[0].state.dt);
 need(seed.balls.length===3&&seed.contactGraphSeed.edges.length===3&&seed.geometryCatalog.length===18,'actual three spheres and complete identity catalog');
 const journal=template.initialWords.subarray(template.segments.journal.offset),slot=h=>{for(let i=0;i<25;i++){const at=J.colliderOffset+i*J.colliderStride;if(journal[at]===h.index&&journal[at+1]===h.generation)return i;}throw new RangeError('Original collider missing');};
 seed.balls.forEach((ball,i)=>{const binding=template.bindings.find(b=>b.canonicalIndex===i),edgeId=seed.contactGraphSeed.edges.findIndex(e=>key(e.collider2)===key(ball.collider)),edge=seed.contactGraphSeed.edges[edgeId],g=seed.geometryCatalog[i],s=ball.state,t=s.topology;
  need(binding&&key(edge.collider1)===key(g.collider1)&&key(edge.collider2)===key(ball.collider)&&t.pairPresent&&t.manifoldPresent&&t.pointPresent&&t.active,'retained exact floor edge and active one-point topology');
  initialWords.set([binding.sceneSlot,ball.body.index,ball.body.generation,slot(edge.collider1),slot(edge.collider2),edge.collider1.index,edge.collider1.generation,ball.collider.index,ball.collider.generation],L.records+i*16);initialWords[L.records+i*16+12]=edgeId;
  const input=new Float32Array(24);input.set(s.translation);input.set([s.radius,Math.fround(s.normalizedPredictionDistance*s.lengthUnit),s.lengthUnit],3);input.set(t.floorMin,6);input.set(t.floorMax,9);input.set(t.ballMin,12);input.set(t.ballMax,15);initialWords.set(new Uint32Array(input.buffer),L.fatInputs+i*24);initialWords.set([...t.ballMin,...t.ballMax].map(bits),L.bounds+i*6);
 });
 const program=new Uint32Array(fat.program.length+floor.program.length);program.set(fat.program);program.set(floor.program,fat.program.length);
 const plan=Object.freeze({kind:'resident-three-ball-current-floor-plan-v1',first,template,sourceIdentity:template.sourceIdentity,layout:L,stateWords:L.words,initialWords,program,scratchWords:Math.max(fat.scratchWords,floor.scratchWords),capability:THREE_BALL_CURRENT_FLOOR_CAPABILITY});
 for(const a of[initialWords,program])Object.preventExtensions(a);owned.set(plan,{fat,narrow,initial:initialWords.slice(),program:program.slice(),compiled:new Map()});return plan;
}
export function assertThreeBallCurrentFloorPlan(plan){const p=owned.get(plan);need(p,'locally branded plan');assertThreeBallFirstHPlan(plan.first);for(const[k,v]of[['initialWords',p.initial],['program',p.program]]){let ok=false;try{ok=plan[k].length===v.length&&plan[k].every((x,i)=>x===v[i]);}catch{}need(ok,'mutated/detached '+k);}return plan;}
function bases(plan,at){assertThreeBallCurrentFloorPlan(plan);need(at&&Object.keys(at).sort().join(',')==='programBase,scratchBase,stateBase','exact absolute bases');need(Object.values(at).every(x=>Number.isSafeInteger(x)&&x>=0&&x<0x10000000)&&at.stateBase>=plan.first.layout.words,'bounded disjoint state');return at;}
export function generateThreeBallCurrentFloorWGSL(plan,at){return generateFloor(plan,at,null);}
export function generateThreeBallRetainedFloorWGSL(plan,at,{controlBase,previousFatBounds}={}){
 threeBallRetainedControlBase(controlBase);need(Number.isSafeInteger(previousFatBounds)&&previousFatBounds>=0&&previousFatBounds<0x10000000,'actual retained fat-bound base');return generateFloor(plan,at,{controlBase,previousFatBounds});
}
function generateFloor(plan,at,retained){
 const {stateBase:c,programBase:p,scratchBase:t}=bases(plan,at),L=plan.layout,r=owned.get(plan),a=plan.template.segments,b=a.bodies.offset,j=a.journal.offset,q=a.cue.offset,cache=a.floorCaches.offset,roster=a.roster.offset,init=plan.template.registration.layout.initialization;
 const frame=retained?`rc_state[${retained.controlBase+6}u]`:'2u',sequence=retained?`rc_state[${retained.controlBase+7}u]`:'1u',proof=retained?`rc_state[${retained.controlBase}u]!=0x52335248u||rc_state[${retained.controlBase+1}u]!=1u||rc_state[${retained.controlBase+2}u]!=1u||rc_state[${retained.controlBase+3}u]!=2u||rc_state[${retained.controlBase+25}u]!=1u||rc_state[${retained.controlBase+10}u]!=rc_state[${S.header.epoch}u]||`:'',edgeCheck=retained?`(rc_state[j+${J.header.edges}u]<3u||rc_state[j+${J.header.edges}u]>9u)`:`rc_state[j+${J.header.edges}u]!=3u`,rosterCheck=retained?`rc_state[${roster+R.header.edgeCount}u]!=rc_state[j+${J.header.edges}u]`:`rc_state[${roster+R.header.edgeCount}u]!=3u`,fatBounds=retained?.previousFatBounds??plan.first.layout.fatBounds;
 const move=[[0,0,31],[34,35,3],[37,38,3],[42,41,1],[43,42,1],[44,43,1],[46,44,1],[47,45,1],[48,46,1],[110,31,4]],rearmed=retained?`if(rc_state[c+11u]!=rc_state[${retained.controlBase+6}u]){return rc_three_floor_fail();}`:'';
 const rearm=retained?`
fn rc_three_floor_rearm()->bool{
 let c=${c}u;let h=${retained.controlBase}u;if(rc_state[h]!=0x52335248u||rc_state[h+1u]!=1u||rc_state[h+2u]!=1u||rc_state[h+3u]!=2u||rc_state[h+25u]!=1u||rc_state[h+6u]!=rc_state[h+5u]+1u||rc_state[c]!=0x52334346u||rc_state[c+1u]!=1u||rc_state[c+2u]!=1u){return rc_three_floor_fail();}
 if(rc_state[c+11u]==0u){if(rc_state[h+24u]!=0u||rc_state[c+3u]!=0u||rc_state[c+4u]!=0u||rc_state[c+5u]!=0u){return rc_three_floor_fail();}}
 else{if(rc_state[c+11u]!=rc_state[h+5u]||rc_state[c+3u]!=4u||rc_state[c+5u]!=1u||rc_state[c+6u]!=7u){return rc_three_floor_fail();}}
 for(var n=3u;n<=9u;n++){rc_state[c+n]=0u;}rc_state[c+11u]=rc_state[h+6u];return true;
}
`:'';
 return generateNarrowphaseWGSL(r.narrow)+rearm+`\n
fn rc_three_floor_fail()->bool{rc_state[${c+2}u]=4u;return false;}
fn rc_three_floor_begin()->bool{
 let c=${c}u;let j=${j}u;let q=${q}u;let init=${init}u;${rearmed}
 if(${proof}rc_state[c]!=0x52334346u||rc_state[c+1u]!=1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=0u||rc_state[c+5u]!=0u||rc_state[${S.header.status}u]!=1u||rc_state[${S.header.phase}u]!=4u||rc_state[${S.header.bodyCount}u]!=22u||rc_state[init+${I.header.status}u]!=1u||rc_state[init+${I.header.phase}u]!=2u||rc_state[init+${I.header.colliderCount}u]!=25u||rc_state[q+${Q.header.frame}u]!=${frame}||rc_state[q+${Q.header.initialNumericMask}u]!=7u||rc_state[q+${Q.header.needsSolve}u]!=1u||rc_state[j+${J.header.colliders}u]!=25u||${edgeCheck}||rc_state[j+${J.header.sequence}u]!=${sequence}||rc_state[j+${J.header.phase}u]!=0u||rc_state[${roster}u]!=0u||${rosterCheck}||rc_state[${roster+R.header.sequence}u]!=${sequence}||rc_state[${plan.first.layout.control+3}u]!=11u||rc_state[${plan.first.layout.control+6}u]!=1u||rc_state[${plan.first.layout.postControl+2}u]!=1u||rc_state[${plan.first.layout.postControl+7}u]!=1u){return rc_three_floor_fail();}
 let awake=rc_state[${S.header.awake}u];rc_state[c+7u]=rc_state[${S.header.epoch}u];rc_state[c+9u]=awake;
 for(var n=0u;n<3u;n++){let r=c+${L.records}u+n*16u;let e=j+${J.edgeOffset}u+rc_state[r+12u]*${J.edgeStride}u;let body=rc_scene_bp(0u,rc_state[r]);
 ${Array.from({length:3},(_,i)=>`if(n==${i}u&&(${Array.from(plan.initialWords.slice(L.records+i*16,L.records+i*16+9),(v,k)=>`rc_state[r+${k}u]!=${v}u`).concat([`rc_state[r+12u]!=${plan.initialWords[L.records+i*16+12]}u`]).join('||')})){return rc_three_floor_fail();}`).join('')}
 if(!rc_scene_valid_body(0u,rc_state[r])||rc_state[body+${S.body.index}u]!=rc_state[r+1u]||rc_state[body+${S.body.generation}u]!=rc_state[r+2u]||rc_state[body+${S.body.dynamic}u]!=1u||rc_state[e]!=rc_state[r+3u]||rc_state[e+1u]!=rc_state[r+4u]||rc_state[e+2u]!=1u||rc_state[e+3u]!=rc_state[r+12u]+1u||rc_state[e+4u]!=0u){return rc_three_floor_fail();}
 var entry=0u;for(var side=0u;side<2u;side++){let cs=rc_state[r+3u+side];let cl=j+${J.colliderOffset}u+cs*${J.colliderStride}u;let ic=init+${I.colliderOffset}u+cs*4u;if(rc_state[cl]!=rc_state[r+5u+side*2u]||rc_state[cl+1u]!=rc_state[r+6u+side*2u]||rc_state[ic]!=rc_state[cl]||rc_state[ic+1u]!=rc_state[cl+1u]||rc_state[cl+6u]!=1u){return rc_three_floor_fail();}let parent=rc_state[ic+2u];if(!rc_scene_valid_body(0u,parent)){return rc_three_floor_fail();}let bp=rc_scene_bp(0u,parent);if(rc_state[bp+${S.body.index}u]!=rc_state[cl+2u]||rc_state[bp+${S.body.generation}u]!=rc_state[cl+3u]){return rc_three_floor_fail();}if(awake!=0xffffffffu&&rc_state[bp+${S.body.activeIsland}u]==awake){entry=entry|(1u<<side);}if(rc_state[bp+${S.body.dynamic}u]==1u&&rc_state[bp+${S.body.activation+4}u]==0u){entry=entry|(4u<<side);}if(rc_state[ic+3u]>2u){entry=entry|16u;}}
 let rawSleep=rc_state[body+${S.body.activation+4}u];if(rawSleep!=0u&&rawSleep!=0x3f800000u){return rc_three_floor_fail();}let sleeping=select(0u,1u,rawSleep!=0u);rc_state[r+9u]=entry;rc_state[r+10u]=select(0u,1u,(entry&19u)!=0u);rc_state[r+11u]=sleeping;
 // The previous completed h owns the CURRENT fat box; immutable t0 bounds
 // in this fresh work region are never used as a future physical input.
 for(var k=0u;k<6u;k++){let x=rc_state[${fatBounds}u+n*6u+k];if((x&0x7f800000u)==0x7f800000u){return rc_three_floor_fail();}rc_state[c+${L.fatInputs+12}u+n*24u+k]=x;rc_state[c+${L.bounds}u+n*6u+k]=x;}
 let old=${cache}u+n*144u;if(rc_state[old+128u]!=1u||rc_state[old+129u]!=1u||rc_state[old+130u]!=1u||rc_state[old+131u]!=1u){return rc_three_floor_fail();}for(var k=0u;k<144u;k++){rc_state[c+${L.draft}u+n*144u+k]=rc_state[old+k];}
 let prior=${roster+R.edgeOffset}u+rc_state[r+12u]*${R.edgeStride}u;let dest=c+${L.prior}u+n*8u;${[9,10,11,12,15,16,17,21].map((v,k)=>`rc_state[dest+${k}u]=rc_state[prior+${v}u];`).join('')}
 }rc_state[c+3u]=1u;return true;
}
fn rc_three_floor_gather()->bool{
 let c=${c}u;let n=rc_state[c+4u];if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||n>=3u||rc_state[c+7u]!=rc_state[${S.header.epoch}u]){return rc_three_floor_fail();}let r=c+${L.records}u+n*16u;let body=${b}u+n*64u;let input=c+${L.fatInputs}u+n*24u;let draft=c+${L.draft}u+n*144u;
 if(rc_state[r+11u]==0u){${move.map(([dst,src,len])=>`for(var k=0u;k<${len}u;k++){rc_state[draft+${dst}u+k]=rc_state[body+${src}u+k];}`).join('')}rc_state[draft+40u]=rc_state[c+10u];for(var k=0u;k<3u;k++){rc_state[input+k]=rc_state[body+6u+k];}}
 for(var k=0u;k<24u;k++){rc_scratch[${t}u+k]=rc_state[input+k];}rc_state[c+3u]=2u;return true;
}
fn rc_three_floor_fat()->bool{
 let c=${c}u;let n=rc_state[c+4u];if(rc_state[c+2u]!=1u||rc_state[c+3u]!=2u||n>=3u){return rc_three_floor_fail();}let r=c+${L.records}u+n*16u;if(rc_state[r+11u]==0u){if(rc_num_eval(${p}u,${t}u)!=1u){return rc_three_floor_fail();}let out=c+${L.fatOutputs}u+n*8u;${Array.from(r.fat.outputSlots,(s,k)=>`rc_state[out+${k}u]=rc_scratch[${t+s}u];`).join('')}if(rc_state[out+6u]!=0x3f800000u){return rc_three_floor_fail();}for(var k=0u;k<6u;k++){rc_state[c+${L.bounds}u+n*6u+k]=rc_state[out+k];}}rc_state[c+3u]=3u;return true;
}
fn rc_three_floor_narrow()->bool{
 let c=${c}u;let n=rc_state[c+4u];if(rc_state[c+2u]!=1u||rc_state[c+3u]!=3u||n>=3u){return rc_three_floor_fail();}let r=c+${L.records}u+n*16u;let draft=c+${L.draft}u+n*144u;
 if(rc_state[r+11u]==0u){if(rc_narrow_floor(draft,${t}u,${p+r.fat.program.length}u,1u,rc_state[r+10u])!=0u){return rc_three_floor_fail();}if(rc_state[draft+138u]!=0u){rc_state[c+8u]=rc_state[c+8u]|(1u<<n);}}
 if(rc_state[draft+128u]!=1u||rc_state[draft+129u]!=1u||rc_state[draft+130u]!=1u||rc_state[draft+131u]!=1u||rc_state[draft+137u]!=0u){return rc_three_floor_fail();}rc_state[c+6u]=rc_state[c+6u]|(1u<<n);rc_state[c+4u]++;rc_state[c+3u]=1u;return true;
}
fn rc_three_floor_publish()->bool{
 let c=${c}u;if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+4u]!=3u||rc_state[c+5u]!=0u||rc_state[c+6u]!=7u||rc_state[c+7u]!=rc_state[${S.header.epoch}u]){return rc_three_floor_fail();}
 for(var k=0u;k<432u;k++){rc_state[${cache}u+k]=rc_state[c+${L.draft}u+k];}rc_state[c+5u]=1u;rc_state[c+3u]=4u;return true;
}
`;}
export function buildThreeBallCurrentFloorSource(plan,at){bases(plan,at);const library=['@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;',generateNumericLibraryWGSL({preserveSubnormals:true}),generateSceneActivationWGSL(),generateThreeBallCurrentFloorWGSL(plan,at)].join('\n');const names=['begin','gather','fat','narrow','publish'],stages=names.map(name=>Object.freeze({name,code:linkResidentWGSL([library,`@compute @workgroup_size(1) fn main(){rc_three_floor_${name}();}`]).code,entryPoint:'main'}));
 const source=linkResidentWGSL([library,'fn rc_three_floor_component(){if(!rc_three_floor_begin()){return;}for(var n=0u;n<3u;n++){if(!rc_three_floor_gather()||!rc_three_floor_fat()||!rc_three_floor_narrow()){return;}}rc_three_floor_publish();}'],{entry:'rc_three_floor_component'}).code;
 return Object.freeze({source,stages:Object.freeze(stages),commands:Object.freeze([Object.freeze({stage:0}),Object.freeze({stages:Object.freeze([1,2,3]),cycles:3}),Object.freeze({stage:4})])});}
/** Unqualified component harness only. The composed second-h owner must place
 * begin before broad and the geometry phases after its real current broad. */
export async function executeThreeBallCurrentFloorWordsForTest(plan,words,options){need(options?.testOnly===true&&Object.keys(options).sort().join(',')==='programBase,scratchBase,stateBase,testOnly','explicit test-only words and bases');const{testOnly,...at}=options;bases(plan,at);need(words instanceof Uint32Array&&words.length>=at.stateBase+plan.stateWords,'complete bank');const r=owned.get(plan),id=JSON.stringify(at);let compiled=r.compiled.get(id);if(!compiled){const{compileMicrocodeWGSL}=await import('./microcode-compiler.mjs');compiled=compileMicrocodeWGSL(buildThreeBallCurrentFloorSource(plan,at).source,{entry:'rc_three_floor_component'});r.compiled.set(id,compiled);}const program=new Uint32Array(at.programBase+plan.program.length);program.set(plan.program,at.programBase);const{createMicrocodeVmReferenceForTest}=await import('./microcode-vm.mjs'),vm=createMicrocodeVmReferenceForTest({testOnly:true,code:compiled.instructions,count:1,localWords:compiled.localWords,stackCapacity:compiled.callDepth,entryPc:compiled.entryPc,bindings:[words,program,new Uint32Array(1),new Uint32Array(at.scratchBase+plan.scratchWords),new Uint32Array(1)]});vm.begin();let status=1,chunks=0;while(status===1){status=vm.advance(0,65536);need(++chunks<256,'bounded component transport');}need(status===2,'emitted component VM error '+vm.state[3]);return words;}
