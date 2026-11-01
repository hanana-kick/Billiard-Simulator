// SPDX-License-Identifier: Apache-2.0
// HOST source composition only: actual floor fat -> post CCD -> JS-number
// angular patch -> scene mutation queues. Collision geometry still HOST-owned.
import {assertThreeBallFirstSpherePlan,executeThreeBallFirstSpherePostForTest,executeThreeBallFirstSpherePhysicalForTest,THREE_BALL_FIRST_SPHERE_HEADER as P} from './three-ball-first-sphere.mjs';
import {createApplicationPrograms} from './application.mjs';
import {executeSourceNumberProgramReference} from './raw-strike.mjs';
import {numberWords,wordsNumber} from './source-number.mjs';
import {compileGraph,executeLowered} from './numeric-program.mjs';
import {SCENE_LAYOUT as S,sceneActivationTestKernels,decodeSceneActivation} from './scene-activation.mjs';
import {packFloorNarrow} from './narrowphase.mjs';
import {threeBallSolverTestKernels} from './three-ball-first-numerical.mjs';
import {equalData} from '../browser-initial-import/exact-data.mjs';
const owned=new WeakMap(),physicalReceipts=new WeakMap(),copy=structuredClone,f=Math.fround,align=n=>Math.ceil(n/64)*64;
const need=(p,m)=>{if(!p)throw Object.assign(new RangeError('Three-ball first post: '+m),{code:'three-ball-first-post-unsupported'});};
const bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0],floats=a=>Array.from(new Float32Array(a.buffer,a.byteOffset,a.length));
export const THREE_BALL_FIRST_POST_CAPABILITY=Object.freeze({hostSourceComponentOnly:true,collisionInputBackend:'owned-host-source-component-test-only',numericInputBackend:'sealed-canonical-host-test-gather',
 actualSpheres:3,actualCueDynamics:2,sourceNumberProfile:'original-js-number-v1',postFatBeforeSphereCcd:true,floorCachePayloadComplete:true,angularPatchAfterSphereCcd:true,sceneApplicationQueues:true,
 nativeInternalBoundaryVerified:false,bvhCommit:false,journalCommit:false,cueClockCommit:false,applicationClockCommit:false,worldCommits:0,physicalSteps:0,wholeH:false,runtimeIntegrated:false,gpuQualified:false});
export const THREE_BALL_FIRST_POST_HEADER=Object.freeze({magic:0,version:1,status:2,phase:3,cursor:4,fatMask:5,patchMask:6,completed:7,epoch:8,sourceH:10,requiredMask:12});
const H=THREE_BALL_FIRST_POST_HEADER;
// Exact mechanical transcription of experimental-world-lifecycle.js:14 fatPlan.
// The independent live Floor.solvePrepared owner remains the expectation.
export function threeBallFloorFatPlan(){const inputFloats=24,nodes=[],op=(kind,...args)=>{nodes.push({kind,args});return inputFloats+nodes.length-1;},c=x=>op('const',f(x)),add=(a,b)=>op('add',a,b),sub=(a,b)=>op('sub',a,b),mul=(a,b)=>op('mul',a,b),choose=(p,a,b)=>op('choose',p,a,b),half=mul(4,c(.5)),skin=mul(c(.04),5),rawMin=[0,1,2].map(p=>sub(sub(p,3),half)),rawMax=[0,1,2].map(p=>add(add(p,3),half));let contained=c(1);for(let i=0;i<3;i++)contained=mul(contained,mul(op('le',12+i,rawMin[i]),op('le',rawMax[i],15+i)));const min=rawMin.map((x,i)=>choose(contained,12+i,sub(x,skin))),max=rawMax.map((x,i)=>choose(contained,15+i,add(x,skin)));let pair=c(1);for(let i=0;i<3;i++)pair=mul(pair,mul(op('le',6+i,max[i]),op('le',min[i],9+i)));return{inputFloats,nodes,outputs:[...min,...max,pair,contained]};}
function code(){return `
fn rc_scene_three_post_fail(s:u32,c:u32)->bool{rc_state[c+2u]=4u;return rc_scene_bad(s,6u);}
fn rc_scene_three_post_begin(s:u32,p:u32,c:u32)->bool{
 if(rc_state[c]!=0x52335041u||rc_state[c+1u]!=1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=0u||rc_state[c+7u]!=0u||rc_state[p+${P.phase}u]!=1u||rc_state[p+${P.completed}u]!=0u||rc_state[s+${S.header.phase}u]!=6u){return rc_scene_three_post_fail(s,c);}rc_state[c+8u]=rc_state[s+${S.header.epoch}u];rc_state[c+12u]=rc_state[p+${P.awakeMask}u];rc_state[c+3u]=1u;return true;
}
fn rc_scene_three_post_fat_input(s:u32,p:u32,c:u32,b:u32,input:u32,n:u32)->bool{
 if(n>=3u||rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+4u]!=0u||rc_state[c+6u]!=0u||rc_state[c+8u]!=rc_state[s+${S.header.epoch}u]||(rc_state[c+12u]&(1u<<n))==0u||rc_state[c+5u]!=(((1u<<n)-1u)&rc_state[c+12u])||(rc_state[p+${P.postMask}u]&(1u<<n))!=0u){return rc_scene_three_post_fail(s,c);}for(var k=0u;k<3u;k++){rc_state[input+k]=rc_state[b+n*64u+6u+k];}return true;
}
fn rc_scene_three_post_fat_finish(s:u32,c:u32,out:u32,bounds:u32,n:u32)->bool{
 if(n>=3u||rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+4u]!=0u||rc_state[c+6u]!=0u||rc_state[c+8u]!=rc_state[s+${S.header.epoch}u]||(rc_state[c+12u]&(1u<<n))==0u||rc_state[out+6u]!=0x3f800000u||rc_state[c+5u]!=(((1u<<n)-1u)&rc_state[c+12u])){return rc_scene_three_post_fail(s,c);}for(var k=0u;k<6u;k++){rc_state[bounds+n*6u+k]=rc_state[out+k];}rc_state[c+5u]=rc_state[c+5u]|(1u<<n);return true;
}
fn rc_scene_three_post_patch(s:u32,p:u32,c:u32,b:u32,out:u32,n:u32)->bool{
 if(n>=3u||rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+4u]!=n||rc_state[c+8u]!=rc_state[s+${S.header.epoch}u]||rc_state[p+${P.completed}u]!=1u||rc_state[p+${P.postMask}u]!=rc_state[c+12u]||rc_state[c+5u]!=rc_state[c+12u]){return rc_scene_three_post_fail(s,c);}let mask=1u<<n;
 if((rc_state[c+12u]&mask)!=0u){if((rc_state[c+5u]&mask)==0u||(rc_state[p+${P.postMask}u]&mask)==0u||rc_state[out+38u]!=1u||rc_state[out]>1u||rc_state[out+1u]!=0u){return rc_scene_three_post_fail(s,c);}if(rc_state[out]!=0u){let slot=rc_state[p+16u+n*4u+2u];if(!rc_scene_post_application(s,slot)){return rc_scene_three_post_fail(s,c);}for(var k=0u;k<3u;k++){rc_state[b+n*64u+3u+k]=rc_state[out+32u+k];}}}
 rc_state[c+6u]=rc_state[c+6u]|mask;rc_state[c+4u]=n+1u;return true;
}
fn rc_scene_three_post_complete(s:u32,p:u32,c:u32)->bool{
 if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+4u]!=3u||rc_state[c+5u]!=rc_state[c+12u]||rc_state[c+6u]!=7u||rc_state[c+7u]!=0u||rc_state[p+${P.completed}u]!=1u){return rc_scene_three_post_fail(s,c);}if(!rc_scene_finish_application(s)){return rc_scene_three_post_fail(s,c);}rc_state[c+3u]=2u;rc_state[c+7u]=1u;return true;
}
`;}
export function createThreeBallFirstPostPlan(sphere){
 need(arguments.length===1,'only locally branded first sphere plan');assertThreeBallFirstSpherePlan(sphere);const seed=sphere.cue.numerical.first.template.seed,fat=compileGraph(threeBallFloorFatPlan()),app=createApplicationPrograms();
 const control=align(sphere.initialWords.length),fatInputs=control+64,fatOutputs=fatInputs+72,bounds=fatOutputs+24,patchOutputs=align(bounds+18),words=align(patchOutputs+120),initialWords=new Uint32Array(words);initialWords.set(sphere.initialWords);initialWords.set([0x52335041,1,1],control);initialWords.set(numberWords(seed.application.dt/seed.application.strokeSubsteps),control+H.sourceH);
 seed.balls.forEach((b,i)=>{const s=b.state,t=s.topology,a=new Float32Array(24);a.set(s.translation);a.set([s.radius,f(s.normalizedPredictionDistance*s.lengthUnit),s.lengthUnit],3);a.set(t.floorMin,6);a.set(t.floorMax,9);a.set(t.ballMin,12);a.set(t.ballMax,15);initialWords.set(new Uint32Array(a.buffer),fatInputs+i*24);initialWords.set([...t.ballMin,...t.ballMax].map(bits),bounds+i*6);});
 const layout=Object.freeze({...sphere.layout,postControl:control,fatInputs,fatOutputs,fatBounds:bounds,patchOutputs,words}),programs=Object.freeze({fat:fat.program.slice(),angular:app.entries.angular.compiled.words.slice(),native:app.entries.native.compiled.program.slice()});
 const plan=Object.freeze({kind:'resident-three-ball-first-post-plan-v1',sphere,sourceIdentity:sphere.sourceIdentity,layout,initialWords,programs,code:code(),capability:THREE_BALL_FIRST_POST_CAPABILITY});const seals=[initialWords,...Object.values(programs)];for(const a of seals)Object.preventExtensions(a);owned.set(plan,{fat,angular:app.entries.angular.compiled,native:app.entries.native.compiled,seals:seals.map(a=>[a,a.slice()])});return plan;
}
export function assertThreeBallFirstPostPlan(plan){const r=owned.get(plan);need(r,'local first-post plan');assertThreeBallFirstSpherePlan(plan.sphere);for(const[a,b]of r.seals){let okay=false;try{okay=a.length===b.length&&a.every((x,i)=>x===b[i]);}catch{}need(okay,'post inputs/program mutated or detached');}return plan;}
export function threeBallFirstPostTestKernels(plan,words){assertThreeBallFirstPostPlan(plan);return sceneActivationTestKernels(words,{extraWGSL:plan.code});}
// Internal composition functions consume only the private branded parent chain;
// they do not brand output or provide a public physical-state admission path.
export function beginThreeBallFirstPost(plan,words,numeric){
 assertThreeBallFirstPostPlan(plan);const d=plan.layout,k=threeBallFirstPostTestKernels(plan,words);need(k.rc_scene_three_post_begin(0,d.sphereControl,d.postControl),'current cue/sphere preparation');
 // These bounds are current pre-solve geometry input, from the same authenticated
 // HOST Floor.prepare dependency already used by the numerical cache gather.
 numeric.preparedFloors.forEach((p,i)=>{const values=[...p.state.topology.ballMin,...p.state.topology.ballMax].map(bits);words.set(values,d.fatInputs+i*24+12);words.set(values,d.fatBounds+i*6);});
 equalData(wordsNumber(words.subarray(d.postControl+H.sourceH,d.postControl+H.sourceH+2)),numeric.timing.sourceH,'original binary64 application h');
}
export function executeThreeBallFirstPostFat(plan,words,numeric,i){
 const d=plan.layout,k=threeBallFirstPostTestKernels(plan,words),input=d.fatInputs+i*24,out=d.fatOutputs+i*8;
 need(k.rc_scene_three_post_fat_input(0,d.sphereControl,d.postControl,d.bodies,input,i),'fat must precede this sphere post-CCD');const raw=executeLowered(plan.programs.fat,new Float32Array(words.buffer,input*4,24),{testOnly:true});words.set(new Uint32Array(raw.buffer),out);need(k.rc_scene_three_post_fat_finish(0,d.postControl,out,d.fatBounds,i),'retained actual floor fat bounds');
 const expected=numeric.sourceExpected.sphereSolve[i].state;equalData(Array.from(raw.slice(0,6)),[...expected.topology.ballMin,...expected.topology.ballMax],'independent original post-fat bounds');
 const geometry=threeBallSolverTestKernels(words,plan.sphere.cue.numerical.catalog);need(geometry.rc_geometry_gather(0,d.caches,d.bodies,i,bits(numeric.timing.dt))===0,'owned current body to existing floor cache');
 equalData(Array.from(words.subarray(d.caches+i*144,d.caches+(i+1)*144)),Array.from(packFloorNarrow(expected)),'complete original post-floor cache payload');
}
export function executeThreeBallFirstPostPatch(plan,words,numeric,i){
 const d=plan.layout,seed=plan.sphere.cue.numerical.first.template.seed,r=owned.get(plan),out=d.patchOutputs+i*40,body=d.bodies+i*64,cache=d.caches+i*144,k=threeBallFirstPostTestKernels(plan,words),expected=numeric.sourceExpected.postApplication.patches[i];
 const skippedSleeping=(words[d.postControl+H.requiredMask]&(1<<i))===0;need(skippedSleeping===!!expected.skippedSleeping,'actual scene sleep skip, not oracle-selected application');
 if(!skippedSleeping){
  const input=[1,...floats(words.subarray(cache+55,cache+58)),...floats(words.subarray(body+3,body+6)),floats(words.subarray(body+1,body+2))[0],seed.balls[i].mass,seed.balls[i].radius,seed.application.params.gravity,wordsNumber(words.subarray(d.postControl+H.sourceH,d.postControl+H.sourceH+2)),seed.application.params.rollingLength,seed.application.params.spinLength,words[cache+130],...floats(words.subarray(cache+70,cache+71)),...Array(31).fill(0)];
  need(words[cache+128]===1&&words[cache+129]===1&&words[cache+130]===1&&words[cache+131]===1,'single original active floor manifold only');
  const result=executeSourceNumberProgramReference(r.angular,input);need(result.done,'exact Number program completed');words.set(result.raw,out);
  const torque=[0,1,2].map(j=>wordsNumber(result.raw.subarray(2+2*j,4+2*j))),q=torque.map(f),m=floats(words.subarray(body+16,body+25)),angular=floats(words.subarray(body+3,body+6));equalData(m[1],m[3]);equalData(m[2],m[6]);equalData(m[5],m[7]);
  equalData(torque,expected.metadata.torque,'original JS-number torque');equalData(q,expected.metadata.torqueF32,'native cast boundary');equalData(!!result.raw[0],expected.metadata.applied,'actual application eligibility');
  const next=result.raw[0]&&q.some(x=>x!==0)?Array.from(executeLowered(plan.programs.native,Float32Array.from([...angular,m[0],m[1],m[2],m[4],m[5],m[8],...q]),{testOnly:true})):angular;
  equalData(next,expected.angular,'ordered native f32 torque application');words.set(next.map(bits),out+32);words.set(q.map(bits),out+35);words[out+38]=1;
 }
 need(k.rc_scene_three_post_patch(0,d.sphereControl,d.postControl,d.bodies,out,i),'original object-order patch after this CCD check');
}
export function finishThreeBallFirstPost(plan,words,numeric){
 const d=plan.layout,k=threeBallFirstPostTestKernels(plan,words);need(k.rc_scene_three_post_complete(0,d.sphereControl,d.postControl),'all actual source post application queues');
 const scene=decodeSceneActivation(words,plan.sphere.cue.numerical.first.template.registration.control.template),expected=numeric.sourceExpected.postApplication.scene;
 for(const name of ['phase','sourceRevision','roles','manager','bodies','modifiedBodies','consumedModifiedBodies'])equalData(scene[name],expected[name],'full source post application scene '+name);
 for(let i=0;i<3;i++){
  const floor=numeric.sourceExpected.sphereSolve[i].state,body=numeric.sourceExpected.postApplication.states[i],at=d.bodies+i*64;
  equalData(Array.from(words.subarray(d.caches+i*144,d.caches+(i+1)*144)),Array.from(packFloorNarrow(floor)),'all source final floor cache payloads, including unchanged sleepers');
  equalData(floats(words.subarray(d.fatBounds+i*6,d.fatBounds+(i+1)*6)),[...floor.topology.ballMin,...floor.topology.ballMax],'all original source fat bounds');
  for(const[name,offset,n]of [['linear',0,3],['angular',3,3],['translation',6,3],['rotation',9,4],['invInertia',16,9],['force',47,3]])equalData(floats(words.subarray(at+offset,at+offset+n)),body[name],'complete source post-body '+i+' '+name);
 }
 const patches=Array.from({length:3},(_,i)=>{const at=d.patchOutputs+i*40;return(words[d.postControl+H.requiredMask]&(1<<i))===0?{skippedSleeping:true}:{applied:!!words[at],torque:[0,1,2].map(j=>wordsNumber(words.subarray(at+2+j*2,at+4+j*2))),torqueF32:floats(words.subarray(at+35,at+38)),angular:floats(words.subarray(d.bodies+i*64+3,d.bodies+i*64+6))};});
 return{scene,patches,fatBounds:Array.from({length:3},(_,i)=>floats(words.subarray(d.fatBounds+i*6,d.fatBounds+(i+1)*6)))};
}
export async function executeThreeBallFirstPostForTest(plan,options={}){assertThreeBallFirstPostPlan(plan);const out=await executeThreeBallFirstSpherePostForTest(plan,options);return{...out,kind:'resident-three-ball-first-post-host-test-result-v1',capability:THREE_BALL_FIRST_POST_CAPABILITY};}
export const THREE_BALL_FIRST_PHYSICAL_CAPABILITY=Object.freeze({...THREE_BALL_FIRST_POST_CAPABILITY,sceneApplicationQueues:false,angularPatchAfterSphereCcd:false,applicationNotStarted:true,allDynamicPostCcdComplete:true,physicalDraftOnly:true});
export async function executeThreeBallFirstPostPhysicalForTest(plan,options={}){
 assertThreeBallFirstPostPlan(plan);const out=await executeThreeBallFirstSpherePhysicalForTest(plan,options);if(!out.available)return{...out,kind:'resident-three-ball-first-physical-host-test-result-v1',capability:THREE_BALL_FIRST_PHYSICAL_CAPABILITY};
 const d=plan.layout,w=out.words;need(w[S.header.phase]===6&&w[d.postControl+H.phase]===1&&w[d.postControl+H.cursor]===0&&w[d.postControl+H.patchMask]===0&&w[d.postControl+H.completed]===0&&w[d.postControl+H.fatMask]===w[d.postControl+H.requiredMask]&&w[d.sphereControl+P.completed]===1,'all physical checks complete before any application');
 const physicalReceipt=Object.freeze({kind:'original-three-ball-first-physical-draft-host-receipt-v1',sourceIdentity:plan.sourceIdentity,applicationStarted:false,worldCommitted:false}),result=Object.freeze({...out,kind:'resident-three-ball-first-physical-host-test-result-v1',physicalReceipt,capability:THREE_BALL_FIRST_PHYSICAL_CAPABILITY});physicalReceipts.set(physicalReceipt,{plan,result,words:w,sealed:w.slice()});return result;
}
export function assertThreeBallFirstPostPhysicalReceipt(receipt,options){need(arguments.length===2&&options&&Object.keys(options).join(',')==='plan','exact receipt and original post plan');const r=physicalReceipts.get(receipt);need(r&&r.plan===options.plan,'locally owned physical draft from this exact post plan');assertThreeBallFirstPostPlan(r.plan);let okay=false;try{okay=r.words.length===r.sealed.length&&r.words.every((x,i)=>x===r.sealed[i]);}catch{}need(okay,'physical draft mutated or detached');return receipt;}
export function assertThreeBallFirstPostPhysicalResult(result,options){assertThreeBallFirstPostPhysicalReceipt(result?.physicalReceipt,options);need(physicalReceipts.get(result.physicalReceipt).result===result,'exact physical result identity, not copied words');return result;}
export function requireThreeBallFirstPostWorldCommit(plan){assertThreeBallFirstPostPlan(plan);throw Object.assign(new RangeError('Post body/fat/application queue draft only; current BVH/journal, cue/application clocks and latched outer-step commit remain uncomposed.'),{code:'three-ball-first-post-world-commit-unavailable'});}
