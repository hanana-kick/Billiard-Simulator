// SPDX-License-Identifier: Apache-2.0
// Real two-dynamic cue owner AFTER genuine-three energy/current roster, BEFORE
// sphere solve. Source inactive-CCD component only, never a whole-world commit.
import {assertThreeBallFirstNumericalPlan,executeThreeBallFirstNumericalCueSourceForTest,executeThreeBallFirstNumericalSphereSourceForTest} from './three-ball-first-numerical.mjs';
import {SCENE_LAYOUT as S,sceneActivationTestKernels} from './scene-activation.mjs';
import {SCENE_WORLD_LAYOUT as W} from './scene-world.mjs';
import {CONTACT_JOURNAL_LAYOUT as G} from './contact-journal.mjs';
import {compileGraph,executeLowered} from './numeric-program.mjs';
import {equalData} from '../browser-initial-import/exact-data.mjs';
import Joint from '../experimental-cue-joint-stepper.js';
import CCD from '../experimental-ccd-inactive.js';
const owned=new WeakMap(),copy=structuredClone,key=h=>h.index+':'+h.generation,align=n=>Math.ceil(n/64)*64;
const need=(p,m)=>{if(!p)throw Object.assign(new RangeError('Three-ball first cue: '+m),{code:'three-ball-first-cue-unsupported'});};
const bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
export const THREE_BALL_FIRST_CUE_CAPABILITY=Object.freeze({hostSourceComponentOnly:true,actualCueDynamicCount:2,actualCueFixedCount:1,actualCueJointCount:2,
 firstCreatedCollisionOnly:true,sourceInactiveCcdPreAndPost:true,allDynamicPostCcdVerified:false,inactiveWhileCueAuthority:false,generalCcdPassAuthority:false,nativeSelectedSolveDtVerified:false,
 nativeInternalBoundaryVerified:false,sphereSolveDispatched:false,worldCommits:0,physicalSteps:0,wholeH:false,runtimeIntegrated:false,gpuQualified:false,defaultBackend:false});
const H=Object.freeze({magic:0,version:1,status:2,phase:3,ballCount:4,dynamicCount:5,colliderCount:6,jointCount:7,numericReady:8,ccdMask:9,completed:10,dt:11,shaftSlot:12,headSlot:13,guideSlot:14,epoch:15});
export const THREE_BALL_FIRST_CUE_HEADER=H;
function kernel(d,p){return `
fn rc_scene_three_cue_fail(s:u32,c:u32)->bool{rc_state[c+2u]=4u;return rc_scene_bad(s,6u);}
fn rc_scene_three_cue_gather(s:u32,j:u32,w:u32,b:u32,c:u32,input:u32,saved:u32,initOut:u32)->bool{
 if(rc_state[c]!=0x52334355u||rc_state[c+1u]!=1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=0u||rc_state[c+4u]!=3u||rc_state[c+5u]!=5u||rc_state[c+6u]!=25u||rc_state[c+7u]!=2u||rc_state[c+8u]!=0u||rc_state[c+9u]!=0u||rc_state[c+10u]!=0u||rc_state[s+${S.header.phase}u]!=6u||rc_state[s+${S.header.jointCount}u]!=2u||rc_state[w+${W.header.continuation}u]!=10u||rc_state[j+${G.header.sequence}u]!=1u||rc_state[j+${G.header.edges}u]!=3u){return rc_scene_three_cue_fail(s,c);}
 if(rc_state[s+${S.header.roleShaft}u]!=rc_state[c+12u]||rc_state[s+${S.header.roleHead}u]!=rc_state[c+13u]||rc_state[s+${S.header.roleGuide}u]!=rc_state[c+14u]||rc_state[input+131u]!=rc_state[c+11u]){return rc_scene_three_cue_fail(s,c);}
 let guide=rc_scene_bp(s,rc_state[c+14u]);if(!rc_scene_valid_body(s,rc_state[c+14u])||rc_state[guide+${S.body.dynamic}u]!=0u||rc_state[guide+${S.body.index}u]!=rc_state[c+24u]||rc_state[guide+${S.body.generation}u]!=rc_state[c+25u]){return rc_scene_three_cue_fail(s,c);}
 for(var n=0u;n<2u;n++){let actual=s+${S.jointOffset}u+n*6u;let original=c+28u+n*6u;if(rc_state[actual]!=rc_state[original]||rc_state[actual+1u]!=rc_state[original+1u]||rc_state[actual+4u]!=rc_state[original+2u]||rc_state[actual+5u]!=rc_state[original+3u]){return rc_scene_three_cue_fail(s,c);}}
 for(var role=0u;role<2u;role++){
  let slot=rc_state[c+12u+role];let member=rc_scene_bp(s,slot);let binding=c+16u+role*4u;
  if(!rc_scene_valid_body(s,slot)||rc_state[member+${S.body.index}u]!=rc_state[binding]||rc_state[member+${S.body.generation}u]!=rc_state[binding+1u]||rc_state[member+${S.body.activation+4}u]!=0u||rc_state[binding+2u]!=slot||rc_state[binding+3u]!=3u+role||rc_state[w+${W.bodyMapOffset}u+slot]!=3u+role){return rc_scene_three_cue_fail(s,c);}
  let src=b+(3u+role)*64u;let dst=input+role*48u;let original=initOut+role*30u;
  // Exact registration graph outputs, never initial zero max_extent metadata.
  if(rc_state[original+12u]!=rc_state[member+${S.body.maxExtent}u]||rc_state[original+13u]!=rc_state[src+63u]){return rc_scene_three_cue_fail(s,c);}rc_state[src+62u]=rc_state[original+12u];
  for(var k=0u;k<64u;k++){rc_state[saved+role*64u+k]=rc_state[src+k];}
  for(var k=0u;k<13u;k++){rc_state[dst+k]=rc_state[src+k];}
  for(var k=0u;k<3u;k++){rc_state[dst+13u+k]=rc_state[src+56u+k];rc_state[dst+16u+k]=rc_state[src+13u+k];rc_state[dst+29u+k]=rc_state[src+28u+k];rc_state[dst+32u+k]=rc_state[src+35u+k];rc_state[dst+35u+k]=rc_state[src+38u+k];}
  rc_state[dst+19u]=rc_state[src+16u];rc_state[dst+20u]=rc_state[src+17u];rc_state[dst+21u]=rc_state[src+18u];rc_state[dst+22u]=rc_state[src+20u];rc_state[dst+23u]=rc_state[src+21u];rc_state[dst+24u]=rc_state[src+24u];
  for(var k=0u;k<4u;k++){rc_state[dst+25u+k]=rc_state[src+31u+k];rc_state[dst+38u+k]=rc_state[src+42u+k];}
 }
 rc_state[c+15u]=rc_state[s+${S.header.epoch}u];rc_state[c+3u]=1u;return true;
}
fn rc_scene_three_cue_scatter(s:u32,b:u32,c:u32,out:u32)->bool{
 if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+8u]!=1u||rc_state[c+15u]!=rc_state[s+${S.header.epoch}u]){return rc_scene_three_cue_fail(s,c);}
 for(var role=0u;role<2u;role++){var at=out+${p.bodyLayout[0]}u;if(role==1u){at=out+${p.bodyLayout[1]}u;}let dst=b+(3u+role)*64u;
  for(var k=0u;k<13u;k++){rc_state[dst+k]=rc_state[at+k];}
  rc_state[dst+16u]=rc_state[at+13u];rc_state[dst+17u]=rc_state[at+14u];rc_state[dst+18u]=rc_state[at+15u];rc_state[dst+19u]=rc_state[at+14u];rc_state[dst+20u]=rc_state[at+16u];rc_state[dst+21u]=rc_state[at+17u];rc_state[dst+22u]=rc_state[at+15u];rc_state[dst+23u]=rc_state[at+17u];rc_state[dst+24u]=rc_state[at+18u];
 }
 rc_state[c+3u]=2u;return true;
}
fn rc_scene_three_cue_ccd_input(b:u32,c:u32,saved:u32,input:u32,role:u32)->bool{
 if(role>1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=2u||(rc_state[c+9u]&(1u<<role))!=0u){return false;}let cur=saved+role*64u;let next=b+(3u+role)*64u;
 for(var k=0u;k<64u;k++){rc_state[input+k]=0u;}for(var k=0u;k<13u;k++){rc_state[input+k]=rc_state[cur+k];}
 for(var k=0u;k<3u;k++){rc_state[input+13u+k]=rc_state[cur+47u+k];rc_state[input+16u+k]=rc_state[cur+38u+k];rc_state[input+19u+k]=rc_state[cur+13u+k];rc_state[input+31u+k]=rc_state[cur+56u+k];}
 for(var k=0u;k<9u;k++){rc_state[input+22u+k]=rc_state[cur+16u+k];}rc_state[input+34u]=rc_state[cur+62u];rc_state[input+35u]=rc_state[cur+63u];rc_state[input+36u]=rc_state[c+11u];
 for(var k=0u;k<7u;k++){rc_state[input+37u+k]=rc_state[next+6u+k];}return true;
}
fn rc_scene_three_cue_ccd_finish(s:u32,c:u32,out:u32,role:u32)->bool{
 if(role>1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=2u||rc_state[c+15u]!=rc_state[s+${S.header.epoch}u]||(rc_state[c+9u]&(1u<<role))!=0u||rc_state[out+17u]!=0u||rc_state[out+18u]!=0x3f800000u){return rc_scene_three_cue_fail(s,c);}
 rc_state[c+9u]=rc_state[c+9u]|(1u<<role);if(rc_state[c+9u]==3u){rc_state[c+3u]=3u;rc_state[c+10u]=1u;}return true;
}
`;} 
export function createThreeBallFirstCuePlan(numerical){
 need(arguments.length===1,'only locally branded original numerical plan');assertThreeBallFirstNumericalPlan(numerical);const seed=numerical.first.template.seed,p=Joint.buildPlan(),joint=compileGraph(p),postPlan=CCD.sourcePlans().post,post=compileGraph(postPlan);
 const control=align(numerical.initialWords.length),input=control+64,saved=input+144,output=saved+128,ccdInput=align(output+p.outputs.length),ccdOutput=ccdInput+128,words=align(ccdOutput+40),initialWords=new Uint32Array(words);
 initialWords.set(numerical.initialWords);const slots=['shaft','head','guide'].map(role=>numerical.first.template.bindings.find(b=>b.role===role)?.sceneSlot??numerical.first.template.registration.control.template.bodies.findIndex(b=>key(b.handle)===key(seed.cueBroadSeed.roles[role])));
 initialWords.set([0x52334355,1,1,0,3,5,25,2,0,0,0,bits(seed.cueInitial.cue.dt),...slots],control);
 for(let i=0;i<2;i++){const role=['shaft','head'][i],h=seed.cueBroadSeed.roles[role];initialWords.set([h.index,h.generation,slots[i],3+i],control+16+i*4);}
 const guide=seed.cueBroadSeed.roles.guide;initialWords.set([guide.index,guide.generation,slots[2],0],control+24);
 const joints=seed.cueInitial.sourceCreation.created.jointState.joint_graph.graph.edges.map(e=>e.weight),sceneSlot=h=>numerical.first.template.registration.control.template.bodies.findIndex(b=>key(b.handle)===key(h));
 need(joints.length===2,'exact original two-joint graph');joints.forEach((j,i)=>initialWords.set([j.handle.index,j.handle.generation,sceneSlot(j.body1),sceneSlot(j.body2),0,0],control+28+i*6));
 initialWords.set(new Uint32Array(Joint.pack(seed.cueInitial.cue).buffer),input);
 const layout=Object.freeze({...numerical.layout,control,input,saved,output,ccdInput,ccdOutput,words}),code=kernel(layout,p);
 const programs=Object.freeze({joint:joint.program.slice(),post:post.program.slice()});
 const plan=Object.freeze({kind:'resident-three-ball-first-cue-plan-v1',numerical,sourceIdentity:numerical.first.sourceIdentity,layout,initialWords,programs,code,capability:THREE_BALL_FIRST_CUE_CAPABILITY});
 const seals=[initialWords,...Object.values(programs)];for(const a of seals)Object.preventExtensions(a);owned.set(plan,{p,postPlan,seals:seals.map(a=>[a,a.slice()])});return plan;
}
export function assertThreeBallFirstCuePlan(plan){const p=owned.get(plan);need(p,'local original cue plan required');assertThreeBallFirstNumericalPlan(plan.numerical);for(const[a,b]of p.seals){let okay=false;try{okay=a.length===b.length&&a.every((x,i)=>x===b[i]);}catch{}need(okay,'cue inputs/program mutated or detached');}return plan;}
export function threeBallFirstCueTestKernels(plan,words){assertThreeBallFirstCuePlan(plan);return sceneActivationTestKernels(words,{extraWGSL:plan.code});}
export async function executeThreeBallFirstCueForTest(plan,options={}){return executeCue(plan,options,false);}
export async function executeThreeBallFirstCueSphereSourceForTest(plan,options={}){return executeCue(plan,options,true);}
async function executeCue(plan,options,solveSpheres){
 need(options&&Object.keys(options).join(',')==='testOnly'&&options.testOnly===true,'explicit testOnly; no current/future/dt overrides');assertThreeBallFirstCuePlan(plan);
 const numeric=await (solveSpheres?executeThreeBallFirstNumericalSphereSourceForTest:executeThreeBallFirstNumericalCueSourceForTest)(plan.numerical,{testOnly:true}),original=numeric.sourceExpected.cueSolve;
 if(!original.available)return{kind:'resident-three-ball-first-cue-host-test-result-v1',available:false,reason:original.reason,capability:THREE_BALL_FIRST_CUE_CAPABILITY,numerical:numeric};
 const record=owned.get(plan),d=plan.layout,seed=plan.numerical.first.template.seed,words=plan.initialWords.slice();words.set(numeric.words);const k=threeBallFirstCueTestKernels(plan,words),init=plan.numerical.first.template.registration.layout.numericOutputs;
 need(k.rc_scene_three_cue_gather(0,d.journal,d.energy,d.bodies,d.control,d.input,d.saved,init),'exact source cue gather');
 const input=new Float32Array(words.buffer,d.input*4,144),expectedInput=Joint.pack(original.input);equalData(Array.from(input),Array.from(expectedInput),'every source current cue joint input');
 const beforeSolve=words.slice(),raw=executeLowered(plan.programs.joint,input,{testOnly:true}),decoded=Joint.decode(raw,record.p);
 equalData(decoded,(({backend,...x})=>x)(original.completed.jointResult),'every original source joint output, impulses and bounded substep trace');
 words.set(new Uint32Array(raw.buffer,raw.byteOffset,raw.length),d.output);words[d.control+H.numericReady]=1;need(k.rc_scene_three_cue_scatter(0,d.bodies,d.control,d.output),'genuine two-dynamic numerical writeback');
 const checks=[];
 for(const [i,role]of ['shaft','head'].entries()){
  need(k.rc_scene_three_cue_ccd_input(d.bodies,d.control,d.saved,d.ccdInput+i*64,i),'source post-CCD input gather');const q=original.input[role],m=seed.cueInitial.ccd[role];
  const expected={kind:'dynamic-body-ccd-check',bodyType:'dynamic',sleeping:false,softFrame:false,...copy(m),maxExtent:numeric.scene.bodies.find(b=>key(b.handle)===key(seed.cueBroadSeed.roles[role])).maxExtent,dt:original.input.dt,linear:q.linear,angular:q.angular,translation:q.translation,rotation:q.rotation,invMass:q.invMass,invInertia:[q.invInertia[0],q.invInertia[1],q.invInertia[2],q.invInertia[1],q.invInertia[3],q.invInertia[4],q.invInertia[2],q.invInertia[4],q.invInertia[5]],localCom:q.localCom,nextTranslation:decoded[role].translation,nextRotation:decoded[role].rotation};
  const packed=new Float32Array(words.buffer,(d.ccdInput+i*64)*4,64);equalData(Array.from(packed),Array.from(CCD.pack(expected)),'all current source post-CCD fields');
  const out=executeLowered(plan.programs.post,packed,{testOnly:true}),source=original.completed.ccd.find(c=>c.body===role&&c.phase==='post-solved-pose');
  for(const[name,field]of Object.entries(record.postPlan.layout)){const wanted=Array.isArray(source[name])?source[name]:[Number(source[name])];equalData(Array.from(out.slice(field.offset,field.offset+field.length)),wanted,'original cue post-CCD '+role+' '+name);}
  need(out[record.postPlan.layout.active.offset]===0&&out[record.postPlan.layout.supported.offset]===1,'actual source cue post-CCD must be inactive');words.set(new Uint32Array(out.buffer,out.byteOffset,out.length),d.ccdOutput+i*20);need(k.rc_scene_three_cue_ccd_finish(0,d.control,d.ccdOutput+i*20,i),'unchanged inactive predicate completion');checks.push(copy(source));
 }
 need(words[d.control+H.ccdMask]===3&&words[d.control+H.completed]===1,'both real cue bodies checked');
 // Neither sphere owner nor application clocks are advanced by cue-only output.
 equalData(Array.from(words.subarray(d.bodies,d.bodies+192)),Array.from(numeric.words.subarray(d.bodies,d.bodies+192)),'all three sphere rows untouched by cue solve');
 return{kind:'resident-three-ball-first-cue-host-test-result-v1',available:true,capability:THREE_BALL_FIRST_CUE_CAPABILITY,sourceIdentity:plan.sourceIdentity,words,beforeSolve,decoded,checks,numerical:numeric,
  sourceExpected:{joint:original.completed.jointResult,ccd:checks,pendingApplicationTime:original.completed.simulationTime},jointIdentities:copy(seed.cueInitial.sourceCreation.created.jointState.joint_graph.graph.edges.map(e=>e.weight)),history:copy(seed.history)};
}
export function requireThreeBallAfterCueContinuation(plan){need(arguments.length===1,'no external continuation inputs');assertThreeBallFirstCuePlan(plan);throw Object.assign(new RangeError('Cue inactive-CCD component complete only: sphere solve/CCD world authority, geometry and application commit remain unavailable.'),{code:'three-ball-after-cue-continuation-unavailable'});}
