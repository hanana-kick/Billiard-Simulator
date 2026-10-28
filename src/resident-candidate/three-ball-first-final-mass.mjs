// SPDX-License-Identifier: Apache-2.0
// Rapier b716d375 advance_to_final_positions: AFTER each awake body's collider
// AABB harvest, refresh its world mass properties. This is not creation replay.
import Init from '../experimental-cue-initialization.js';
import {assertThreeBallCreatedOwnerTemplate} from './three-ball-created-owner.mjs';
import {compileGraph,generateNumericLibraryWGSL} from './numeric-program.mjs';
import {generateSceneActivationWGSL,SCENE_LAYOUT as S} from './scene-activation.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
const owned=new WeakMap(),U=0xffffffff,key=h=>h.index+':'+h.generation;
const need=(p,m)=>{if(!p)throw Object.assign(new RangeError('Three-ball final mass: '+m),{code:'three-ball-final-mass-unsupported'});};
const bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
export const THREE_BALL_FIRST_FINAL_MASS_LAYOUT=Object.freeze({words:256,headerWords:32,params:32,paramStride:16,input:112,output:152,outputStride:12,
 header:Object.freeze({magic:0,version:1,status:2,phase:3,cursor:4,completed:5,mask:6,slot:7,role:8,epoch:9})});
export const THREE_BALL_FIRST_FINAL_MASS_CAPABILITY=Object.freeze({actualSpheres:3,actualCueDynamics:2,sourceWorldMassPrefix:true,perAwakeBodyAfterColliderHarvest:true,
 noCreationReplay:true,unchangedRetainedLocalMass:true,lockedAxes:false,generalMassRecomputation:false,sourceCueSnapshotUnchanged:true,hostSourceComponentOnly:true,
 nativeWholeHVerified:false,wholeH:false,worldCommit:false,gpuQualified:false,runtimeIntegrated:false});
/** Only authentic retained local mass is packed. Current/future poses are NOT
 * factory inputs; the generated gather reads the current produced body bank. */
export function createThreeBallFirstFinalMassPlan(template){
 need(arguments.length===1,'one authentic initial template only');assertThreeBallCreatedOwnerTemplate(template);
 const full=Init.buildPlan(),outputs=full.outputs.slice(0,12),end=Math.max(...outputs)-full.inputFloats+1;
 // A literal source node PREFIX: no pruning, reassociation, synthetic collider
 // or newly invented mass formula. Inputs19..39 are unused original ABI lanes.
 const graph={inputFloats:full.inputFloats,nodes:full.nodes.slice(0,end),outputs},compiled=compileGraph(graph),initialWords=new Uint32Array(256),L=THREE_BALL_FIRST_FINAL_MASS_LAYOUT;
 initialWords.set([0x5233464d,1,1,0,0,0,0,U,U,U]);
 const bindings=template.bindings.filter(b=>b.canonicalIndex!==null&&b.canonicalIndex!==undefined);need(bindings.length===5&&bindings.every((b,i)=>b.canonicalIndex===i),'exact five actual dynamic roles');
 for(const b of bindings){const native=template.seed.nativeBodies.find(n=>key(n.handle)===key(b.body)),m=native?.mprops,l=m?.local_mprops;
  need(native?.body_type==='Dynamic'&&native.enabled===true&&m.flags===0&&l,'original enabled unlocked dynamic local mass');
  const values=[...l.local_com,l.inv_mass,...l.inv_principal_inertia,...l.principal_inertia_local_frame];need(values.length===11&&values.every(x=>Number.isFinite(x)&&Object.is(x,Math.fround(x))),'exact retained native f32 local mass');
  const at=L.params+b.canonicalIndex*L.paramStride;initialWords.set([b.sceneSlot,b.body.index,b.body.generation,b.canonicalIndex,...values.map(bits),1],at);
 }
 const program=compiled.program.slice(),plan=Object.freeze({kind:'resident-three-ball-first-final-mass-plan-v1',template,sourceIdentity:template.sourceIdentity,layout:L,stateWords:256,initialWords,program,scratchWords:compiled.scratchWords,capability:THREE_BALL_FIRST_FINAL_MASS_CAPABILITY});
 for(const a of[initialWords,program])Object.preventExtensions(a);owned.set(plan,{compiled,initial:initialWords.slice(),program:program.slice(),testPrograms:new Map()});return plan;
}
export function assertThreeBallFirstFinalMassPlan(plan){const p=owned.get(plan);need(p,'locally owned final-mass plan');assertThreeBallCreatedOwnerTemplate(plan.template);for(const[k,want]of[['initialWords',p.initial],['program',p.program]]){let ok=false;try{ok=plan[k].length===want.length&&plan[k].every((x,i)=>x===want[i]);}catch{}need(ok,'mutated/detached '+k);}return plan;}
function bases(plan,options){assertThreeBallFirstFinalMassPlan(plan);need(options&&Object.keys(options).sort().join(',')==='programBase,scratchBase,stateBase','exact three absolute owner bases');for(const x of Object.values(options))need(Number.isSafeInteger(x)&&x>=0&&x<0x10000000,'bounded u32 owner base');need(options.stateBase>=plan.template.initialWords.length,'mass state must not overlap authentic initial bank');return options;}
export function generateThreeBallFirstFinalMassWGSL(plan,options){
 const {stateBase:c,programBase:p,scratchBase:t}=bases(plan,options),L=plan.layout,o=owned.get(plan).compiled.outputSlots,b=plan.template.segments.bodies.offset;
 const params=Array.from({length:5},(_,i)=>Array.from(plan.initialWords.subarray(L.params+i*16,L.params+(i+1)*16)));
 return `
fn rc_three_final_mass_fail()->bool{rc_state[${c+2}u]=4u;return false;}
fn rc_three_final_mass_identity(role:u32)->bool{
 ${params.map((row,i)=>`if(role==${i}u){let p=${c+L.params+i*16}u;return ${row.map((value,k)=>`rc_state[p+${k}u]==${value}u`).join('&&')};}`).join('\n')}
 return false;
}
fn rc_three_final_mass_gather(slot:u32)->bool{
 let c=${c}u;let awake=rc_state[${S.header.awake}u];if(rc_state[c]!=0x5233464du||rc_state[c+1u]!=1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=0u||rc_state[c+5u]!=0u||rc_state[${S.header.status}u]!=1u||rc_state[${S.header.phase}u]!=6u||rc_state[${S.header.bodyCount}u]!=22u||awake==0xffffffffu){return rc_three_final_mass_fail();}
 let chunk=rc_scene_cp(0u,awake);let cursor=rc_state[c+4u];if(rc_state[chunk+1u]>5u||cursor>=rc_state[chunk+1u]||rc_state[chunk+2u+cursor]!=slot||!rc_scene_valid_body(0u,slot)){return rc_three_final_mass_fail();}
 var role=0xffffffffu;${params.map((row,i)=>`if(slot==${row[0]}u){role=${i}u;}`).join('')}if(role>=5u||!rc_three_final_mass_identity(role)||(rc_state[c+6u]&(1u<<role))!=0u){return rc_three_final_mass_fail();}
 let param=c+${L.params}u+role*16u;let scene=rc_scene_bp(0u,slot);if(rc_state[scene+${S.body.index}u]!=rc_state[param+1u]||rc_state[scene+${S.body.generation}u]!=rc_state[param+2u]||rc_state[scene+${S.body.dynamic}u]!=1u||rc_state[scene+${S.body.activation+4}u]!=0u){return rc_three_final_mass_fail();}
 if(cursor==0u){rc_state[c+9u]=rc_state[${S.header.epoch}u];}else{if(rc_state[c+9u]!=rc_state[${S.header.epoch}u]){return rc_three_final_mass_fail();}}
 let body=${b}u+role*64u;for(var n=0u;n<40u;n++){rc_scratch[${t}u+n]=0u;rc_state[c+${L.input}u+n]=0u;}
 for(var n=0u;n<7u;n++){let x=rc_state[body+6u+n];if((x&0x7f800000u)==0x7f800000u){return rc_three_final_mass_fail();}rc_scratch[${t}u+n]=x;rc_state[c+${L.input}u+n]=x;}
 for(var n=0u;n<11u;n++){let x=rc_state[param+4u+n];rc_scratch[${t+7}u+n]=x;rc_state[c+${L.input+7}u+n]=x;}rc_scratch[${t+18}u]=1065353216u;rc_state[c+${L.input+18}u]=1065353216u;
 rc_state[c+7u]=slot;rc_state[c+8u]=role;rc_state[c+3u]=1u;return true;
}
fn rc_three_final_mass_evaluate()->bool{
 let c=${c}u;if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+8u]>=5u||rc_state[c+9u]!=rc_state[${S.header.epoch}u]){return rc_three_final_mass_fail();}
 if(rc_num_eval(${p}u,${t}u)!=1u){return rc_three_final_mass_fail();}let out=c+${L.output}u+rc_state[c+8u]*12u;
 ${Array.from(o,(slot,i)=>`if((rc_scratch[${t+slot}u]&0x7f800000u)==0x7f800000u){return rc_three_final_mass_fail();}rc_state[out+${i}u]=rc_scratch[${t+slot}u];`).join('')}
 rc_state[c+3u]=2u;return true;
}
fn rc_three_final_mass_scatter(slot:u32)->bool{
 let c=${c}u;let role=rc_state[c+8u];if(rc_state[c+2u]!=1u||rc_state[c+3u]!=2u||rc_state[c+7u]!=slot||role>=5u||!rc_three_final_mass_identity(role)||rc_state[c+9u]!=rc_state[${S.header.epoch}u]){return rc_three_final_mass_fail();}
 let body=${b}u+role*64u;for(var n=0u;n<7u;n++){if(rc_state[body+6u+n]!=rc_state[c+${L.input}u+n]){return rc_three_final_mass_fail();}}
 let out=c+${L.output}u+role*12u;for(var n=0u;n<3u;n++){rc_state[body+59u+n]=rc_state[out+n];rc_state[body+13u+n]=rc_state[out+3u+n];}
 ${[6,7,8,7,9,10,8,10,11].map((at,i)=>`rc_state[body+${16+i}u]=rc_state[out+${at}u];`).join('')}
 rc_state[c+6u]=rc_state[c+6u]|(1u<<role);rc_state[c+4u]++;rc_state[c+3u]=0u;return true;
}
fn rc_three_final_mass_finish()->bool{
 let c=${c}u;let awake=rc_state[${S.header.awake}u];if(rc_state[c+2u]!=1u||rc_state[c+3u]!=0u||rc_state[c+5u]!=0u||rc_state[c+9u]!=rc_state[${S.header.epoch}u]||awake==0xffffffffu){return rc_three_final_mass_fail();}
 let chunk=rc_scene_cp(0u,awake);if(rc_state[c+4u]!=rc_state[chunk+1u]||rc_state[c+4u]>5u){return rc_three_final_mass_fail();}var mask=0u;for(var n=0u;n<rc_state[chunk+1u];n++){let slot=rc_state[chunk+2u+n];var role=0xffffffffu;${params.map((row,i)=>`if(slot==${row[0]}u){role=${i}u;}`).join('')}if(role>=5u){return rc_three_final_mass_fail();}mask=mask|(1u<<role);}if(mask!=rc_state[c+6u]){return rc_three_final_mass_fail();}rc_state[c+5u]=1u;rc_state[c+3u]=3u;return true;
}
`;
}
/** Unqualified exact-emitted-source component harness. No receipt or physical
 * publication is issued: only the composed broad owner can establish placement
 * after each body's actual AABB harvest. */
export async function executeThreeBallFirstFinalMassWordsForTest(plan,words,options){
 need(options?.testOnly===true&&Object.keys(options).sort().join(',')==='programBase,scratchBase,stateBase,testOnly','explicit component test and absolute bases only');const {testOnly,...at}=options;bases(plan,at);need(words instanceof Uint32Array&&words.length>=at.stateBase+256,'complete owner bank');
 const r=owned.get(plan),id=JSON.stringify(at);let compiled=r.testPrograms.get(id);if(!compiled){const {compileMicrocodeWGSL}=await import('./microcode-compiler.mjs');const source=['@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;',generateNumericLibraryWGSL({preserveSubnormals:true}),generateSceneActivationWGSL(),generateThreeBallFirstFinalMassWGSL(plan,at),`fn rc_three_final_mass_component_test(){let awake=rc_state[${S.header.awake}u];if(awake==0xffffffffu){rc_three_final_mass_fail();return;}let chunk=rc_scene_cp(0u,awake);for(var n=0u;n<rc_state[chunk+1u];n++){let slot=rc_state[chunk+2u+n];if(!rc_three_final_mass_gather(slot)||!rc_three_final_mass_evaluate()||!rc_three_final_mass_scatter(slot)){return;}}rc_three_final_mass_finish();}`].join('\n');compiled=compileMicrocodeWGSL(linkResidentWGSL([source],{entry:'rc_three_final_mass_component_test'}).code,{entry:'rc_three_final_mass_component_test'});r.testPrograms.set(id,compiled);}
 const program=new Uint32Array(at.programBase+plan.program.length);program.set(plan.program,at.programBase);const {createMicrocodeVmReferenceForTest}=await import('./microcode-vm.mjs'),vm=createMicrocodeVmReferenceForTest({testOnly:true,code:compiled.instructions,count:1,localWords:compiled.localWords,stackCapacity:compiled.callDepth,entryPc:compiled.entryPc,bindings:[words,program,new Uint32Array(1),new Uint32Array(at.scratchBase+plan.scratchWords),new Uint32Array(1)]});vm.begin();let status=1,chunks=0;while(status===1){status=vm.advance(0,65536);need(++chunks<256,'bounded component transport');}need(status===2,'component VM error '+vm.state[3]);return words;
}
